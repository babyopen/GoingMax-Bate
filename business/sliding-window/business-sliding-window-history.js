/**
 * 滑动窗口预测 · 回测追踪 · 业务层
 * 职责：用历史 N 期数据模拟"过去每期"的预测，与该期实际开奖比对
 *
 * 历史背景：
 *   - 2026-06-10 之前：包含实时推荐记录（addRecord / saveAndCheck / getStats 等）
 *   - 2026-06-10：因"实时推荐记录"与"回测追踪记录"为同一份数据，移除实时推荐模块
 *     只保留回测追踪核心逻辑
 *
 * 依赖方向: views/ -> business/ -> core/
 * 禁止 DOM 操作
 */
const BusinessSlidingWindowHistory = {

  /** 默认回测窗口大小（最近 N 期） */
  DEFAULT_BACKTEST_COUNT: 30,

  // ============================================================
  // 2026-06-23 新增：回测结果持久化（V1.4.5 优化 #1）
  // 目的：避免每次刷新/重进主推页都重跑 30 期回测（90 次外源调用）
  // 策略：缓存命中条件 = (算法版本一致) AND (历史数据时间戳一致) AND (未过期)
  // 约束：core/storage.js 是只读文件，不能修改 KEYS；本模块自管缓存 key
  // ============================================================

  /** 回测缓存的 Storage Key（不放入 storage.js KEYS，避免修改只读文件） */
  BACKTEST_CACHE_KEY: 'mainPredictBacktestCache',

  /** 缓存过期时间（24 小时；过期后强制重跑，避免长期脏数据） */
  BACKTEST_CACHE_TTL_MS: 24 * 60 * 60 * 1000,

  /**
   * 读取历史数据时间戳（取第 0 期，即最新一期）
   * 用于判断"是否同一份历史数据"
   * @param {Array} historyData - 完整历史数据
   * @returns {number} 时间戳（毫秒），无数据时返回 0
   * @private
   */
  _getHistoryTimestamp: function(historyData) {
    if (!Array.isArray(historyData) || historyData.length === 0) return 0;
    var first = historyData[0];
    if (!first) return 0;
    // 优先用 timestamp 字段（fetch 时已写入），无则用 expect
    return Number(first.timestamp || 0);
  },

  /**
   * 读取回测缓存（命中条件：算法版本一致 + 历史数据时间戳一致 + 未过期）
   * @param {Array} historyData - 当前历史数据（用于时间戳校验）
   * @returns {Object|null} 命中返回 { records, stats, timestamp, algorithmVersion }；未命中返回 null
   */
  getCachedBacktest: function(historyData) {
    var historyTs = this._getHistoryTimestamp(historyData);
    var cache = Storage.get(this.BACKTEST_CACHE_KEY, null);
    if (!cache || typeof cache !== 'object') return null;
    // 校验 1：算法版本必须一致（升级算法后必须重跑）
    if (cache.algorithmVersion !== BusinessSlidingWindow.ALGORITHM_VERSION) return null;
    // 校验 2：历史数据时间戳必须一致（数据更新后必须重跑）
    if (cache.historyTimestamp !== historyTs) return null;
    // 校验 3：未过期
    if (typeof cache.timestamp !== 'number') return null;
    if (Date.now() - cache.timestamp > this.BACKTEST_CACHE_TTL_MS) return null;
    // 校验 4：records 必须是数组且非空
    if (!Array.isArray(cache.records) || cache.records.length === 0) return null;
    return cache;
  },

  /**
   * 持久化回测结果到 Storage
   * @param {Array} historyData - 历史数据（用于记录数据时间戳）
   * @param {Array} records - 回测记录
   * @param {Object} [stats] - 统计结果（可选）
   * @returns {boolean} 是否写入成功
   */
  saveBacktestCache: function(historyData, records, stats) {
    if (!Array.isArray(records) || records.length === 0) return false;
    var historyTs = this._getHistoryTimestamp(historyData);
    var payload = {
      algorithmVersion: BusinessSlidingWindow.ALGORITHM_VERSION,
      historyTimestamp: historyTs,
      timestamp: Date.now(),
      records: records,
      stats: stats || null
    };
    return Storage.set(this.BACKTEST_CACHE_KEY, payload);
  },

  /**
   * 带缓存的回测入口（推荐替代 runBacktest）
   * 命中缓存 → 直接返回；未命中 → 调原 runBacktest + 写缓存
   *
   * @param {Array} historyData - 完整历史数据
   * @param {number} [count] - 回测期数，默认 30
   * @returns {Object} { records, stats, fromCache: boolean }
   */
  runBacktestWithCache: function(historyData, count) {
    // 1. 尝试读缓存
    var cache = this.getCachedBacktest(historyData);
    if (cache) {
      return {
        records: cache.records,
        stats: cache.stats || this.computeBacktestStats(cache.records),
        fromCache: true
      };
    }

    // 2. 未命中 → 调原 runBacktest（不修改原方法，纯复用）
    var records = this.runBacktest(historyData, count);
    if (!Array.isArray(records) || records.length === 0) {
      return { records: [], stats: null, fromCache: false };
    }

    // 3. 算统计 + 写缓存
    var stats = this.computeBacktestStats(records);
    this.saveBacktestCache(historyData, records, stats);

    return {
      records: records,
      stats: stats,
      fromCache: false
    };
  },

  /**
   * 清除回测缓存
   * 适用场景：历史数据强制更新、用户主动刷新、算法手动调参
   * @returns {boolean} 是否移除成功
   */
  clearBacktestCache: function() {
    return Storage.remove(this.BACKTEST_CACHE_KEY);
  },

  // ============================================================
  // 2026-06-23 新增：V1.4.5 优化 #2 —— 按 signal 维度统计命中率
  // 目的：识别每条评分规则的真实贡献率，定位低效/负贡献规则
  // 设计：复制 runBacktest 结构（避免破坏原函数），新增 candidatesSignals 字段
  //       配套 computeSignalStats 把信号-命中率关联起来
  // ============================================================

  /**
   * 增强版回测：除原 record 字段外，额外保留每个候选生肖的 signals 列表
   * 用于按 signal 维度统计命中率
   *
   * 与 runBacktest 的差异（仅"追加"，不破坏原 API）：
   *   - 多了 candidatesSignals 字段（与 candidates 等长，每个元素是该候选的 signal 数组）
   *
   * @param {Array} historyData - 完整历史数据
   * @param {number} [count] - 回测期数，默认 30
   * @returns {Array} 回测记录（每条 record 含 candidatesSignals 字段）
   */
  runBacktestEnriched: function(historyData, count) {
    if (!Array.isArray(historyData) || historyData.length < 12) return [];

    // 2026-06-23 V1.4.9：未指定 count 时按数据量自适应
    var N = (typeof count === 'number' && count > 0) ? count : this.getAdaptiveBacktestCount(historyData.length);
    var testCount = Math.min(N, historyData.length);

    var results = [];

    for (var i = 0; i < testCount; i++) {
      var actualItem = historyData[i];
      var simulateData = historyData.slice(i + 1);
      if (!actualItem || simulateData.length < 12) continue;

      var expect = Number(actualItem.expect || 0);
      if (!expect) continue;

      // 收集交叉排除结果（与原 runBacktest 一致）
      var crossResult = null;
      try {
        if (typeof BusinessCrossExclusion !== 'undefined' && BusinessCrossExclusion.collectAllRecommend) {
          crossResult = BusinessCrossExclusion.collectAllRecommend(simulateData);
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BusinessSlidingWindowHistory] 第' + expect + '期交叉排除收集失败：', e);
        }
      }

      // 跑主算法
      var prediction = crossResult
        ? BusinessSlidingWindow.predict(simulateData, { crossResult: crossResult })
        : BusinessSlidingWindow.predict(simulateData);
      if (!prediction || !prediction.candidates || !prediction.candidates.length) continue;

      // 2026-06-23 V1.4.9.2 修复：在本作用域内算 zodiacSeq（V1.4.9 漏掉，导致 miss 计算报 ReferenceError）
      var zodiacSeq = BusinessSlidingWindow.convertHistoryToZodiacSequence(simulateData);

      // 提取开奖答案
      var actualZodArr = Utils.parseZodiacArr(actualItem);
      var actualZodiac = actualZodArr[6] || '';
      var actualCodeArr = (actualItem.openCode || '').split(',');
      var actualTe = Number(actualCodeArr[6] || 0);
      if (!actualZodiac) continue;

      // 提取候选 + 评分 + signals（★ 新增 candidatesSignals）
      var candidates = prediction.candidates.map(function(c) { return c.shengxiao; });
      var candidateScores = prediction.candidates.map(function(c) { return c.score; });
      var candidatesSignals = prediction.candidates.map(function(c) {
        return Array.isArray(c.signals) ? c.signals : [];
      });
      // 2026-06-23 V1.4.5 新增：完整 candidates 对象（用于降权系数网格搜索）
      var candidatesDetail = prediction.candidates.map(function(c) {
        // 2026-06-23 V1.4.9 新增：计算候选生肖的 miss（用于 miss 区间统计）
        var miss = 0;
        for (var j = 0; j < zodiacSeq.length; j++) {
          if (zodiacSeq[j].shengxiao === c.shengxiao) { miss = j; break; }
        }
        return {
          shengxiao: c.shengxiao,
          score: c.score,
          originalScore: c.originalScore != null ? c.originalScore : c.score,
          downweighted: !!c.downweighted,
          signals: Array.isArray(c.signals) ? c.signals.slice() : [],
          miss: miss  // ★ V1.4.9 新增
        };
      });

      // 命中排名
      var hitRank = 0;
      for (var k = 0; k < candidates.length; k++) {
        if (candidates[k] === actualZodiac) { hitRank = k + 1; break; }
      }

      results.push({
        period: expect,
        candidates: candidates,
        candidateScores: candidateScores,
        candidatesSignals: candidatesSignals,        // ★ Step 2 新增字段
        algorithm: BusinessSlidingWindow.ALGORITHM_VERSION,
        actualZodiac: actualZodiac,
        actualTe: actualTe,
        hitRank: hitRank,
        hitStatus: hitRank > 0 ? 'hit' : 'miss',
        source: 'backtest',
        // 2026-06-23 V1.4.5 Step 4 新增字段
        rhythm: prediction.rhythm ? prediction.rhythm.pattern : 'UNKNOWN',  // STEADY / CONSECUTIVE_2 / CONSECUTIVE_3 / ALL_DIFFERENT / UNKNOWN
        candidatesDetail: candidatesDetail,                                 // 完整 candidate 对象（含 originalScore + downweighted）
        crossExclusion: crossResult ? {
          rule2Triggered: crossResult.rule2Triggered === true,
          downweighted: crossResult.downweighted || [],
          downweightFactor: crossResult.downweightFactor || 0,
          excluded: crossResult.excluded || []
        } : null
      });
    }

    return results;
  },

  /**
   * 按 signal 维度统计命中率
   * 算法：遍历每条 record，如果命中 → 统计命中位置的 signal；如果未命中 → 统计所有 top6 signal
   *       这样能区分"高 signal 命中率高（规则有用）" vs "高 signal 但都是未命中（规则噪声）"
   *
   * @param {Array} records - runBacktestEnriched 返回的记录
   * @returns {Array<{signal, total, hit, miss, hitRate, rank1Hit, rank2Hit, rank3Hit, top3HitRate}>}
   *   按命中率降序排列
   */
  computeSignalStats: function(records) {
    if (!Array.isArray(records) || records.length === 0) return [];

    var signalMap = {};   // signal 字符串 -> 统计对象

    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!Array.isArray(rec.candidatesSignals)) continue;

      var hitIdx = rec.hitRank > 0 ? (rec.hitRank - 1) : -1;
      var isHit = hitIdx >= 0;

      // 收集该 record 内出现的所有 signal（去重，按 record 计一次）
      var seenInThisRecord = {};
      for (var j = 0; j < rec.candidatesSignals.length; j++) {
        var sigArr = rec.candidatesSignals[j] || [];
        for (var s = 0; s < sigArr.length; s++) {
          var sig = sigArr[s];
          if (!sig || typeof sig !== 'string') continue;
          if (seenInThisRecord[sig]) continue;   // 同一 record 内同 signal 只计一次
          seenInThisRecord[sig] = true;

          if (!signalMap[sig]) {
            signalMap[sig] = {
              signal: sig,
              total: 0,        // 该 signal 在 top6 中出现的期数
              hit: 0,          // 该 signal 出现且当期命中的期数
              miss: 0,         // 该 signal 出现但当期未命中的期数
              rank1Hit: 0,     // 命中且命中位置在第 1 名
              rank2Hit: 0,
              rank3Hit: 0
            };
          }
          var entry = signalMap[sig];
          entry.total++;
          if (isHit) {
            entry.hit++;
            if (j === 0) entry.rank1Hit++;
            else if (j === 1) entry.rank2Hit++;
            else if (j === 2) entry.rank3Hit++;
          } else {
            entry.miss++;
          }
        }
      }
    }

    // 转为数组 + 算命中率 + 排序
    var arr = [];
    for (var k in signalMap) {
      if (!Object.prototype.hasOwnProperty.call(signalMap, k)) continue;
      var e = signalMap[k];
      e.hitRate = e.total > 0 ? Math.round(e.hit / e.total * 100) : 0;
      e.top3HitRate = e.total > 0 ? Math.round((e.rank1Hit + e.rank2Hit + e.rank3Hit) / e.total * 100) : 0;
      arr.push(e);
    }
    arr.sort(function(a, b) {
      // 优先按命中率降序；命中率相同时按总期数降序（样本量大的更可信）
      if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate;
      if (b.total !== a.total) return b.total - a.total;
      return a.signal.localeCompare(b.signal);
    });
    return arr;
  },

  // ============================================================
  // 2026-06-23 新增：V1.4.5 优化 #4 —— 节奏回测 + Rule 2 降权系数网格搜索
  // 目的：
  //   - 节奏回测：识别 STEADY / CONSECUTIVE_2 / CONSECUTIVE_3 / ALL_DIFFERENT 各自的命中率
  //   - 降权系数网格搜索：跨 5 个候选 factor 找最优 Rule 2 降权系数
  // 设计：
  //   - computeRhythmStats：纯遍历，O(N)
  //   - _rescoreWithFactor：内存操作，O(N × K)，N=期数，K=top6 数量
  //   - gridSearchDownweightFactor：复用 enriched 回测结果，不重复跑 predict
  // ============================================================

  /**
   * 2026-06-23 V1.4.9 新增：按 miss 区间分组统计命中率
   * 算法：遍历每条 record 的 top6 candidate，统计每个候选的 miss 区间
   *       命中时归到 hit，未命中时归到 miss
   * 区间：0-2（极热）/ 3-5（热）/ 6-14（温）/ 15+（冷）
   *
   * @param {Array} records - runBacktestEnriched 返回的记录
   * @returns {Array<{range, label, total, hit, miss, hitRate}>}
   */
  computeMissStats: function(records) {
    if (!Array.isArray(records) || records.length === 0) return [];
    var RANGES = [
      { range: '0-2',   min: 0,  max: 2,  label: '极热' },
      { range: '3-5',   min: 3,  max: 5,  label: '热' },
      { range: '6-14',  min: 6,  max: 14, label: '温' },
      { range: '15+',   min: 15, max: 999, label: '冷' }
    ];
    var stats = {};
    for (var i = 0; i < RANGES.length; i++) {
      var r = RANGES[i];
      stats[r.range] = { range: r.range, label: r.label, total: 0, hit: 0, miss: 0, hitRate: 0 };
    }
    for (var ri = 0; ri < records.length; ri++) {
      var rec = records[ri];
      var detail = rec.candidatesDetail || [];
      var actual = rec.actualZodiac;
      for (var ci = 0; ci < detail.length; ci++) {
        var c = detail[ci];
        var m = c.miss;
        var matchedRange = null;
        for (var ri2 = 0; ri2 < RANGES.length; ri2++) {
          if (m >= RANGES[ri2].min && m <= RANGES[ri2].max) { matchedRange = RANGES[ri2].range; break; }
        }
        if (!matchedRange) continue;
        stats[matchedRange].total++;
        if (c.shengxiao === actual) stats[matchedRange].hit++;
        else stats[matchedRange].miss++;
      }
    }
    // 计算 hitRate 并按降序输出
    var result = [];
    for (var k in stats) {
      if (Object.prototype.hasOwnProperty.call(stats, k)) {
        var s = stats[k];
        s.hitRate = s.total > 0 ? Math.round(s.hit / s.total * 100) : 0;
        result.push(s);
      }
    }
    result.sort(function(a, b) { return b.hitRate - a.hitRate; });
    return result;
  },

  // ============================================================

  /**
   * 按节奏（rhythm）分组统计命中率（2026-06-23 新增）
   * 输入：runBacktestEnriched 返回的 records（每条 record 含 rhythm 字段）
   *
   * @param {Array} records - enriched 回测记录
   * @returns {Array<{rhythm, label, total, hit, hitRate, top3HitRate}>}
   *   按命中率降序排列
   */
  computeRhythmStats: function(records) {
    if (!Array.isArray(records) || records.length === 0) return [];

    // 节奏类型 → 描述映射
    var RHYTHM_LABELS = {
      'STEADY': '平稳期',
      'CONSECUTIVE_2': '2期连号',
      'CONSECUTIVE_3': '3期连号',
      'ALL_DIFFERENT': '6期全不同',
      'UNKNOWN': '未知'
    };

    var rhythmMap = {};
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec || !rec.rhythm) continue;
      var rhythm = rec.rhythm;
      if (!rhythmMap[rhythm]) {
        rhythmMap[rhythm] = {
          rhythm: rhythm,
          label: RHYTHM_LABELS[rhythm] || rhythm,
          total: 0,
          hit: 0,
          rank1Hit: 0,
          rank2Hit: 0,
          rank3Hit: 0
        };
      }
      var e = rhythmMap[rhythm];
      e.total++;
      if (rec.hitStatus === 'hit') {
        e.hit++;
        if (rec.hitRank === 1) e.rank1Hit++;
        else if (rec.hitRank === 2) e.rank2Hit++;
        else if (rec.hitRank === 3) e.rank3Hit++;
      }
    }

    var arr = [];
    for (var k in rhythmMap) {
      if (!Object.prototype.hasOwnProperty.call(rhythmMap, k)) continue;
      var e = rhythmMap[k];
      e.hitRate = e.total > 0 ? Math.round(e.hit / e.total * 100) : 0;
      e.top3HitRate = e.total > 0 ? Math.round((e.rank1Hit + e.rank2Hit + e.rank3Hit) / e.total * 100) : 0;
      arr.push(e);
    }
    arr.sort(function(a, b) {
      if (b.hitRate !== a.hitRate) return b.hitRate - a.hitRate;
      return b.total - a.total;
    });
    return arr;
  },

  /**
   * 2026-06-23 V1.4.9 新增：节奏串行窗口统计
   * 算法：识别"连续 N 次同节奏"窗口，统计每段窗口内的命中率
   * 应用：识别"连续平稳期"、"连续连号期"等长段对命中率的影响
   *
   * @param {Array} records - enriched records
   * @param {number} [minLength=2] - 最小连续长度（默认 2，即至少 2 期连续才统计）
   * @returns {Array<{rhythm, length, startIndex, endIndex, total, hit, hitRate}>}
   */
  computeRhythmSerialStats: function(records, minLength) {
    if (!Array.isArray(records) || records.length === 0) return [];
    var min = (typeof minLength === 'number' && minLength > 0) ? minLength : 2;
    var segments = [];
    var i = 0;
    while (i < records.length) {
      var r = records[i].rhythm || 'UNKNOWN';
      var j = i;
      while (j < records.length && (records[j].rhythm || 'UNKNOWN') === r) j++;
      var len = j - i;
      if (len >= min) {
        var hitCount = 0;
        for (var k = i; k < j; k++) {
          if (records[k].hitStatus === 'hit') hitCount++;
        }
        segments.push({
          rhythm: r,
          length: len,
          startIndex: i,
          endIndex: j - 1,
          total: len,
          hit: hitCount,
          hitRate: len > 0 ? Math.round(hitCount / len * 100) : 0
        });
      }
      i = j;
    }
    // 按 length 降序
    segments.sort(function(a, b) { return b.length - a.length; });
    return segments;
  },

  /**
   * 根据自定义 downweightFactor 重新计算每期 top6 + hitRank（2026-06-23 新增）
   * 输入：enriched records（每条 record 含 candidatesDetail 字段）
   * 输出：浅拷贝 records，candidates/candidateScores/hitRank/hitStatus 都被按 factor 重算
   *
   * 算法：
   *   1. 对每条 record：
   *      a. 遍历 candidatesDetail，重算 finalScore
   *         - if downweighted: finalScore = originalScore * factor
   *         - else: finalScore = originalScore
   *      b. 按 finalScore 降序重排，取前 6
   *      c. 用 actualZodiac 在新 top6 里查 hitRank
   *
   * @param {Array} records - enriched records
   * @param {number} factor - 新的降权系数（0~1，0=不降权，1=完全扣光）
   * @returns {Array} 新的 records（深拷贝 hitRank/candidates/candidateScores，保留原 candidatesDetail）
   * @private
   */
  _rescoreWithFactor: function(records, factor) {
    if (!Array.isArray(records)) return [];
    var newRecords = [];
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      if (!rec || !Array.isArray(rec.candidatesDetail)) {
        newRecords.push(rec);
        continue;
      }
      // 重算每个 candidate 的 finalScore
      var rescored = rec.candidatesDetail.map(function(c) {
        var finalScore = c.downweighted && factor > 0
          ? c.originalScore * factor
          : c.originalScore;
        return {
          shengxiao: c.shengxiao,
          score: finalScore,
          downweighted: c.downweighted
        };
      });
      // 按 finalScore 降序排（同分保持原顺序）
      rescored.sort(function(a, b) {
        return b.score - a.score;
      });
      // 取前 6 作为新 top6
      var top6 = rescored.slice(0, 6);
      var newCandidates = top6.map(function(c) { return c.shengxiao; });
      var newScores = top6.map(function(c) { return c.score; });
      // 重算 hitRank
      var newHitRank = 0;
      for (var k = 0; k < newCandidates.length; k++) {
        if (newCandidates[k] === rec.actualZodiac) { newHitRank = k + 1; break; }
      }
      // 浅拷贝 + 覆盖
      newRecords.push({
        period: rec.period,
        candidates: newCandidates,
        candidateScores: newScores,
        actualZodiac: rec.actualZodiac,
        actualTe: rec.actualTe,
        hitRank: newHitRank,
        hitStatus: newHitRank > 0 ? 'hit' : 'miss',
        // 保留原字段
        rhythm: rec.rhythm,
        candidatesDetail: rec.candidatesDetail,
        crossExclusion: rec.crossExclusion
      });
    }
    return newRecords;
  },

  /**
   * 网格搜索 Rule 2 降权系数最优值（2026-06-23 新增）
   * 跑一次 enriched 回测，然后对每个候选 factor 重算分数，统计命中率，找出最优
   *
   * 性能：enriched 回测 30 期 ≈ 1-2s；后续重算 O(N × 5) ≈ 几十 ms
   * 不会重复调 predict，纯内存操作
   *
   * @param {Array} historyData - 历史数据
   * @param {Array<number>} [factors] - 候选 factor 列表，默认 [0.3, 0.4, 0.5, 0.6, 0.7]
   * @param {number} [count] - 回测期数，默认 30
   * @returns {Object} {
   *   candidates: Array<{factor, total, hit, miss, hitRate, top3Rate, firstRankRate}>,
   *   best: { factor, hitRate, ... } | null,
   *   recommended: number,        // 推荐的最优 factor
   *   baseline: { factor, hitRate, ... } | null  // 0.5 的结果作为基线
   * }
   */
  gridSearchDownweightFactor: function(historyData, factors, count) {
    if (!Array.isArray(historyData) || historyData.length < 12) {
      return { candidates: [], best: null, recommended: 0.5, baseline: null };
    }
    factors = Array.isArray(factors) && factors.length > 0
      ? factors
      : [0.3, 0.4, 0.5, 0.6, 0.7];

    // 1. 跑一次 enriched 回测
    var records = this.runBacktestEnriched(historyData, count);
    if (!Array.isArray(records) || records.length === 0) {
      return { candidates: [], best: null, recommended: 0.5, baseline: null };
    }

    // 2. 对每个 factor 重算 + 统计
    var results = [];
    for (var i = 0; i < factors.length; i++) {
      var factor = factors[i];
      var rescored = this._rescoreWithFactor(records, factor);
      var stats = this.computeBacktestStats(rescored);
      results.push({
        factor: factor,
        total: stats.total,
        hit: stats.hit,
        miss: stats.miss,
        hitRate: stats.hitRate,
        top3Rate: stats.top3Rate,
        firstRankRate: stats.firstRankRate
      });
    }

    // 3. 找最优（按 hitRate 降序，并列时按 top3Rate 降序）
    var best = results[0];
    for (var j = 1; j < results.length; j++) {
      if (results[j].hitRate > best.hitRate) best = results[j];
      else if (results[j].hitRate === best.hitRate && results[j].top3Rate > best.top3Rate) best = results[j];
    }

    // 4. 找基线（factor=0.5）
    var baseline = null;
    for (var k = 0; k < results.length; k++) {
      if (results[k].factor === 0.5) { baseline = results[k]; break; }
    }

    return {
      candidates: results,
      best: best,
      recommended: best ? best.factor : 0.5,
      baseline: baseline
    };
  },

  // ============================================================
  // 2026-06-23 新增：V1.4.5 优化 #5 —— 权重配置化
  // 目的：让每条 base rule 的"贡献度"可量化、可调优
  // 设计（严格遵守"不修改原 calculateScore"原则）：
  //   - _buildBaseRuleIndex：从 SW_BASE_RULES 数组构建 signal→{weight, idx} 索引
  //   - computeRuleCoverage：遍历 records，统计每条 base rule 的触发数/命中率/lift
  //   - getRecommendedBaseWeights：基于 lift 输出权重调优建议
  // 调优工作流：
  //   1. 调 computeRuleCoverage 获取每条规则的命中率/lift
  //   2. 调 getRecommendedBaseWeights 获取推荐权重
  //   3. 开发者根据建议手动改 SW_BASE_RULES 数组里的 weight
  //   4. 同步更新 ALGORITHM_VERSION 触发缓存失效
  // ============================================================

  /**
   * 构建 base rule 索引：signal → { weight, idx, rule }
   * @returns {Object} 索引对象
   * @private
   */
  _buildBaseRuleIndex: function() {
    var index = {};
    var rules = (typeof BusinessSlidingWindow !== 'undefined' && BusinessSlidingWindow.SW_BASE_RULES)
      ? BusinessSlidingWindow.SW_BASE_RULES
      : [];
    for (var i = 0; i < rules.length; i++) {
      var r = rules[i];
      if (!r || !r.signal) continue;
      index[r.signal] = { weight: r.weight || 0, idx: i, rule: r };
    }
    return index;
  },

  /**
   * 识别一条 record 触发的 base rule
   * 策略：取 candidatesSignals[0]（最高分候选）的 signal 列表，找属于 SW_BASE_RULES 的第一个 signal
   *
   * @param {Object} rec - enriched record
   * @param {Object} baseRuleIndex - _buildBaseRuleIndex 返回的索引
   * @returns {string|null} 命中的 base rule signal，未命中返回 null
   * @private
   */
  _detectRecordBaseRule: function(rec, baseRuleIndex) {
    if (!rec || !Array.isArray(rec.candidatesSignals) || rec.candidatesSignals.length === 0) return null;
    // 取最高分候选的 signals（第 0 名）
    var topSignals = rec.candidatesSignals[0] || [];
    for (var i = 0; i < topSignals.length; i++) {
      var sig = topSignals[i];
      if (sig && baseRuleIndex[sig]) return sig;
    }
    return null;
  },

  /**
   * 统计每条 base rule 的覆盖率与命中率（2026-06-23 新增）
   * 输出每条 base rule 的：
   *   - currentWeight：当前权重（从 SW_BASE_RULES 读）
   *   - total：触发该规则的 record 数
   *   - hit：触发且命中
   *   - hitRate：触发时命中率
   *   - overallRate：整体命中率（baseline）
   *   - lift：hitRate - overallRate（正=有效，负=噪声）
   *   - sampleStatus：'sufficient' / 'low' / 'none'
   *
   * @param {Array} records - enriched records
   * @returns {Array<{signal, currentWeight, total, hit, hitRate, overallRate, lift, sampleStatus, idx}>}
   *   按 lift 降序排列
   */
  computeRuleCoverage: function(records) {
    if (!Array.isArray(records) || records.length === 0) return [];
    var baseRuleIndex = this._buildBaseRuleIndex();
    if (Object.keys(baseRuleIndex).length === 0) return [];

    // 1. 整体命中率（baseline）
    var totalRecords = records.length;
    var totalHit = 0;
    for (var r = 0; r < totalRecords; r++) {
      if (records[r] && records[r].hitStatus === 'hit') totalHit++;
    }
    var overallRate = totalRecords > 0 ? Math.round(totalHit / totalRecords * 100) : 0;

    // 2. 遍历每条 record，识别其 base rule
    var ruleStats = {};   // signal -> { total, hit }
    for (var i = 0; i < totalRecords; i++) {
      var rec = records[i];
      var ruleSignal = this._detectRecordBaseRule(rec, baseRuleIndex);
      if (!ruleSignal) continue;
      if (!ruleStats[ruleSignal]) ruleStats[ruleSignal] = { total: 0, hit: 0 };
      ruleStats[ruleSignal].total++;
      if (rec.hitStatus === 'hit') ruleStats[ruleSignal].hit++;
    }

    // 3. 装配输出（每条 SW_BASE_RULE 一项）
    var result = [];
    for (var sig in baseRuleIndex) {
      if (!Object.prototype.hasOwnProperty.call(baseRuleIndex, sig)) continue;
      var info = baseRuleIndex[sig];
      var stats = ruleStats[sig] || { total: 0, hit: 0 };
      var hitRate = stats.total > 0 ? Math.round(stats.hit / stats.total * 100) : 0;
      var lift = hitRate - overallRate;
      var sampleStatus = stats.total >= 5 ? 'sufficient' : (stats.total > 0 ? 'low' : 'none');
      result.push({
        signal: sig,
        idx: info.idx,
        currentWeight: info.weight,
        total: stats.total,
        hit: stats.hit,
        hitRate: hitRate,
        overallRate: overallRate,
        lift: lift,
        sampleStatus: sampleStatus
      });
    }
    // 按 lift 降序
    result.sort(function(a, b) {
      if (b.lift !== a.lift) return b.lift - a.lift;
      // lift 相同时按 total 降序（样本量大的更可信）
      if (b.total !== a.total) return b.total - a.total;
      return a.idx - b.idx;
    });
    return result;
  },

  /**
   * 基于覆盖率数据输出权重调优建议（2026-06-23 新增）
   *
   * 算法：
   *   recommendedWeight = clamp(currentWeight * (1 + lift/100), 0, 100)
   *   例：currentWeight=70, lift=15 → 70 × 1.15 = 80
   *   例：currentWeight=100, lift=-10 → 100 × 0.9 = 90
   *   例：currentWeight=20, lift=-30 → 20 × 0.7 = 14
   *
   * action 分级（基于 |delta|）：
   *   - |delta| ≤ 5：'keep'（保持）
   *   - delta > 5：'increase'（建议加权重）
   *   - delta < -5 && recommendedWeight > 0：'decrease'（建议降权）
   *   - recommendedWeight === 0：'consider_remove'（建议移除）
   *
   * 注意：recommendedWeight = 0 的规则是"考虑删除"，开发者可决定是否彻底删除
   *
   * @param {Array} coverage - computeRuleCoverage 的输出
   * @returns {Array<{signal, currentWeight, recommendedWeight, delta, action, lift, sampleStatus, note}>}
   *   按 |delta| 降序排列（变动最大的在前）
   */
  getRecommendedBaseWeights: function(coverage) {
    if (!Array.isArray(coverage) || coverage.length === 0) return [];
    var result = [];
    for (var i = 0; i < coverage.length; i++) {
      var c = coverage[i];
      // 样本不足的规则不出调优建议（避免误导）
      if (c.sampleStatus === 'none') continue;

      // 计算推荐权重
      var factor = 1 + (c.lift || 0) / 100;
      var recommended = Math.round((c.currentWeight || 0) * factor);
      // clamp 到 [0, 100]
      if (recommended < 0) recommended = 0;
      if (recommended > 100) recommended = 100;

      var delta = recommended - (c.currentWeight || 0);
      var action;
      if (recommended === 0 && c.currentWeight > 0) action = 'consider_remove';
      else if (delta > 5) action = 'increase';
      else if (delta < -5) action = 'decrease';
      else action = 'keep';

      // 备注
      var note = '';
      if (c.sampleStatus === 'low') {
        note = '样本不足（' + c.total + '期），建议参考但需更多数据验证';
      } else if (c.lift >= 20) {
        note = '强正贡献（lift +' + c.lift + '）';
      } else if (c.lift >= 10) {
        note = '中等正贡献（lift +' + c.lift + '）';
      } else if (c.lift <= -20) {
        note = '强负贡献（lift ' + c.lift + '），可能为噪声';
      } else if (c.lift <= -10) {
        note = '中等负贡献（lift ' + c.lift + '）';
      } else {
        note = '中性（lift ' + c.lift + '）';
      }

      result.push({
        signal: c.signal,
        currentWeight: c.currentWeight || 0,
        recommendedWeight: recommended,
        delta: delta,
        action: action,
        lift: c.lift,
        sampleStatus: c.sampleStatus,
        note: note
      });
    }
    // 按 |delta| 降序（变动最大的在前）
    result.sort(function(a, b) {
      var absA = Math.abs(a.delta);
      var absB = Math.abs(b.delta);
      if (absB !== absA) return absB - absA;
      return b.lift - a.lift;
    });
    return result;
  },

  /**
   * 带缓存的增强版回测入口（含 signal 维度统计 + 持久化）
   * 命中条件同 runBacktestWithCache：算法版本 + 历史时间戳 + 未过期
   *
   * @param {Array} historyData - 完整历史数据
   * @param {number} [count] - 回测期数，默认 30
   * @returns {Object} { records, stats, signalStats, fromCache: boolean }
   */
  runBacktestEnrichedWithCache: function(historyData, count) {
    // 1. 尝试读缓存
    var historyTs = this._getHistoryTimestamp(historyData);
    var cache = Storage.get(this.BACKTEST_CACHE_KEY, null);
    if (cache && typeof cache === 'object'
        && cache.algorithmVersion === BusinessSlidingWindow.ALGORITHM_VERSION
        && cache.historyTimestamp === historyTs
        && typeof cache.timestamp === 'number'
        && Date.now() - cache.timestamp <= this.BACKTEST_CACHE_TTL_MS
        && Array.isArray(cache.records) && cache.records.length > 0
        && Array.isArray(cache.signalStats) /* signalStats 必须存在才算增强缓存命中 */
       ) {
      return {
        records: cache.records,
        stats: cache.stats || this.computeBacktestStats(cache.records),
        signalStats: cache.signalStats,
        fromCache: true
      };
    }

    // 2. 未命中 → 调 enriched 版回测
    var records = this.runBacktestEnriched(historyData, count);
    if (!Array.isArray(records) || records.length === 0) {
      return { records: [], stats: null, signalStats: [], fromCache: false };
    }

    // 3. 算 stats + signalStats
    var stats = this.computeBacktestStats(records);
    var signalStats = this.computeSignalStats(records);

    // 4. 写缓存（覆盖原缓存，因为 schema 已扩展）
    var payload = {
      algorithmVersion: BusinessSlidingWindow.ALGORITHM_VERSION,
      historyTimestamp: historyTs,
      timestamp: Date.now(),
      records: records,
      stats: stats,
      signalStats: signalStats
    };
    Storage.set(this.BACKTEST_CACHE_KEY, payload);

    return {
      records: records,
      stats: stats,
      signalStats: signalStats,
      fromCache: false
    };
  },

  /**
   * 回测核心：遍历最近 N 期历史，每期用『截至上一期』的历史数据跑算法
   * 关键：第 i 期模拟预测时，传入 historyData 必须是剔除 i 之后的数据
   *       （即站在第 i 期开奖前那一刻的视角）
   *
   * V1.4.2 增强：每期使用 BusinessCrossExclusion 收集 crossResult 后传入 predict，
   *             保证回测候选生肖与实时推荐完全一致（包括 Rule 1 硬排除 + Rule 2 软降权）
   *
   * @param {Array} historyData - 完整历史数据（[0] 最新，[length-1] 最旧）
   * @param {number} [count] - 回测期数，默认 30
   * @returns {Array<{
   *   period, candidates, candidateScores, actualZodiac, actualTe, hitRank, hitStatus,
   *   algorithm, source: 'backtest', crossExclusion?: { rule2Triggered, downweighted, downweightFactor }
   * }>}
   */
  runBacktest: function(historyData, count) {
    if (!Array.isArray(historyData) || historyData.length < 12) return [];

    var N = (typeof count === 'number' && count > 0) ? count : this.DEFAULT_BACKTEST_COUNT;
    // 实际回测期数 = min(用户指定的N, 数据总量)
    var testCount = Math.min(N, historyData.length);

    var results = [];

    for (var i = 0; i < testCount; i++) {
      // 第 i 期的实际数据（开奖答案）
      var actualItem = historyData[i];
      // 模拟预测用的历史数据：剔除 i 之前（含 i）的所有数据
      var simulateData = historyData.slice(i + 1);
      if (!actualItem || simulateData.length < 12) {
        continue;
      }

      var expect = Number(actualItem.expect || 0);
      if (!expect) continue;

      // [V1.4.2] 收集交叉排除结果（与实时推荐同源），保证回测候选生肖与实时推荐完全一致
      var crossResult = null;
      try {
        if (typeof BusinessCrossExclusion !== 'undefined' && BusinessCrossExclusion.collectAllRecommend) {
          crossResult = BusinessCrossExclusion.collectAllRecommend(simulateData);
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BusinessSlidingWindowHistory] 第' + expect + '期交叉排除收集失败：', e);
        }
      }

      // 跑滑动窗口算法（传入 crossResult，与实时推荐同源）
      var prediction = crossResult
        ? BusinessSlidingWindow._predictWithLRU(simulateData, { crossResult: crossResult })
        : BusinessSlidingWindow._predictWithLRU(simulateData); // 兜底：异常时退回原行为
      if (!prediction || !prediction.candidates || !prediction.candidates.length) continue;

      // 提取特码生肖（第 7 位）和特码数字
      var actualZodArr = Utils.parseZodiacArr(actualItem);
      var actualZodiac = actualZodArr[6] || '';
      var actualCodeArr = (actualItem.openCode || '').split(',');
      var actualTe = Number(actualCodeArr[6] || 0);
      if (!actualZodiac) continue;

      // 计算命中排名（基于 prediction.candidates 顺序）
      var candidates = prediction.candidates.map(function(c) { return c.shengxiao; });
      var candidateScores = prediction.candidates.map(function(c) { return c.score; });
      // [V1.4.2 新增] 降权标记：哪些生肖被 Rule 2 软降权（用于视图层渲染）
      var downweightedMap = {};
      prediction.candidates.forEach(function(c) {
        if (c.downweighted) downweightedMap[c.shengxiao] = true;
      });
      var hitRank = 0;
      for (var k = 0; k < candidates.length; k++) {
        if (candidates[k] === actualZodiac) {
          hitRank = k + 1;
          break;
        }
      }

      results.push({
        period: expect,
        candidates: candidates,
        candidateScores: candidateScores,
        algorithm: BusinessSlidingWindow.ALGORITHM_VERSION,
        actualZodiac: actualZodiac,
        actualTe: actualTe,                           // 实际特码数字（用于渲染层"开:X生02"）
        hitRank: hitRank,
        hitStatus: hitRank > 0 ? 'hit' : 'miss',
        source: 'backtest',                          // 标记来源（区别于已废弃的实时推荐）
        // [V1.4.2 新增] 交叉排除元信息（供视图层展示降权状态）
        crossExclusion: crossResult ? {
          rule2Triggered: crossResult.rule2Triggered === true,
          downweighted: crossResult.downweighted || [],
          downweightFactor: crossResult.downweightFactor || 0,
          excluded: crossResult.excluded || []
        } : null
      });
    }

    return results;
  },

  /**
   * 回测统计（命中率、连续命中、排名分布等）
   * @param {Array} records - 回测记录列表
   * @returns {Object} { total, hit, miss, hitRate, top3Rate, firstRankRate, rankStats, maxConsecutiveHit }
   */
  computeBacktestStats: function(records) {
    if (!Array.isArray(records)) records = [];
    var total = records.length;
    var hit = 0, miss = 0;
    var rankStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    var consecutiveHit = 0, maxConsecutiveHit = 0;

    // 按期号升序遍历（从最早到最新），正确计算连续命中
    var sortedAsc = records.slice().sort(function(a, b) {
      return (a.period || 0) - (b.period || 0);
    });

    for (var i = 0; i < sortedAsc.length; i++) {
      var r = sortedAsc[i];
      if (r.hitStatus === 'hit') {
        hit++;
        consecutiveHit++;
        if (consecutiveHit > maxConsecutiveHit) maxConsecutiveHit = consecutiveHit;
        if (r.hitRank >= 1 && r.hitRank <= 6) {
          rankStats[r.hitRank] = (rankStats[r.hitRank] || 0) + 1;
        }
      } else if (r.hitStatus === 'miss') {
        miss++;
        consecutiveHit = 0;
      }
    }

    var hitRate = total > 0 ? (hit / total * 100) : 0;
    var top3Rate = total > 0 ? ((rankStats[1] + rankStats[2] + rankStats[3]) / total * 100) : 0;
    var firstRankRate = total > 0 ? (rankStats[1] / total * 100) : 0;

    return {
      total: total,
      hit: hit,
      miss: miss,
      hitRate: hitRate,
      top3Rate: top3Rate,
      firstRankRate: firstRankRate,
      rankStats: rankStats,
      maxConsecutiveHit: maxConsecutiveHit
    };
  },

  /**
   * 2026-06-23 V1.4.9 新增：扩展版回测统计（排名分布到 12 名）
   * 用途：原 computeBacktestStats 只统计 1-6 名，本方法统计 1-12 名
   * 价值：评估"近 top6 命中"是否稳定（rank 7-12 命中说明候选质量不错）
   *
   * @param {Array} records - runBacktest 返回的记录（需含 hitRank）
   * @returns {Object} { rank1Count, rank2Count, ..., rank12Count, total, hit, ... }
   */
  computeBacktestStatsExtended: function(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return { total: 0, hit: 0, miss: 0, hitRate: 0, rank1Rate: 0, rank1Count: 0, top12Distribution: [] };
    }
    var total = records.length;
    var hit = 0;
    var rankDist = [];
    for (var _k = 0; _k < 12; _k++) rankDist.push(0);
    var top3Hit = 0;
    var top6Hit = 0;
    var top12Hit = 0;
    var missBeyond12 = 0;
    for (var i = 0; i < records.length; i++) {
      var r = records[i].hitRank || 0;
      if (r <= 0) { missBeyond12++; continue; }
      hit++;
      if (r <= 3) top3Hit++;
      if (r <= 6) top6Hit++;
      top12Hit++;
      if (r >= 1 && r <= 12) rankDist[r - 1]++;
    }
    var result = {
      total: total,
      hit: hit,
      miss: total - hit,
      hitRate: Math.round(hit / total * 100),
      top3Rate: Math.round(top3Hit / total * 100),
      top6Rate: Math.round(top6Hit / total * 100),
      top12Rate: Math.round(top12Hit / total * 100),
      rank1Count: rankDist[0],
      rank1Rate: Math.round(rankDist[0] / total * 100)
    };
    var top12Distribution = [];
    for (var k = 0; k < 12; k++) {
      top12Distribution.push({ rank: k + 1, count: rankDist[k], rate: Math.round(rankDist[k] / total * 100) });
    }
    result.top12Distribution = top12Distribution;
    result.missBeyond12 = missBeyond12;
    return result;
  },

  /**
   * 2026-06-23 V1.4.9 新增：未推荐候选分析
   * 用途：识别"实际开出但未进主推 top6"的生肖
   * 价值：揭示"主推算法偏差"问题
   * 2026-06-23 V1.4.9.3 精简：删除 4 个无意义 API 字段（占位 0）、未使用 options 参数、重复 wouldHit 累加、冗余 j < detail.length 条件
   *
   * @param {Array} records - enriched records（每条含 candidatesDetail + actualZodiac）
   * @returns {Object} { totalRecords, wouldHitTotal, wouldHitRate, topRejectedList }
   */
  computeRejectedCandidates: function(records) {
    if (!Array.isArray(records) || records.length === 0) {
      return { totalRecords: 0, wouldHitTotal: 0, wouldHitRate: 0, topRejectedList: [] };
    }
    var rejectedMap = {};
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      var detail = rec.candidatesDetail || [];
      var actual = rec.actualZodiac;
      if (!actual) continue;
      // 检查 actual 是否在 top6
      var inTop6 = false;
      for (var j = 0; j < 6; j++) {
        if (detail[j] && detail[j].shengxiao === actual) { inTop6 = true; break; }
      }
      if (inTop6) continue;
      if (!rejectedMap[actual]) rejectedMap[actual] = 0;
      rejectedMap[actual]++;
    }
    var totalRecords = records.length;
    var wouldHitTotal = 0;
    var topRejectedList = [];
    for (var k in rejectedMap) {
      if (Object.prototype.hasOwnProperty.call(rejectedMap, k)) {
        wouldHitTotal += rejectedMap[k];
        topRejectedList.push({ shengxiao: k, missed: rejectedMap[k] });
      }
    }
    topRejectedList.sort(function(a, b) { return b.missed - a.missed; });
    return {
      totalRecords: totalRecords,
      wouldHitTotal: wouldHitTotal,
      wouldHitRate: Math.round(wouldHitTotal / totalRecords * 100),
      topRejectedList: topRejectedList.slice(0, 12)
    };
  }

};
