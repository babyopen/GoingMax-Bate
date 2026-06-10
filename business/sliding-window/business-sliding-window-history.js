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

    var self = this;

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
        ? BusinessSlidingWindow.predict(simulateData, { crossResult: crossResult })
        : BusinessSlidingWindow.predict(simulateData); // 兜底：异常时退回原行为
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

  // ============================================================
  // 回测基准测试工具（V1.1 vs V1.2 对比）
  // 用法：在浏览器控制台执行 BusinessSlidingWindowHistory.runBenchmark()
  // ============================================================

  /**
   * 生肖→数字对应表（用于生成模拟数据的特码数字）
   */
  ZODIAC_NUMBER_MAP: {
    '鼠': [1, 13, 25, 37, 49],
    '牛': [2, 14, 26, 38],
    '虎': [3, 15, 27, 39],
    '兔': [4, 16, 28, 40],
    '龙': [5, 17, 29, 41],
    '蛇': [6, 18, 30, 42],
    '马': [7, 19, 31, 43],
    '羊': [8, 20, 32, 44],
    '猴': [9, 21, 33, 45],
    '鸡': [10, 22, 34, 46],
    '狗': [11, 23, 35, 47],
    '猪': [12, 24, 36, 48]
  },

  /** 12生肖数组（本地引用，避免跨模块依赖） */
  _ZODIAC_ALL: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  /**
   * 生成 100 期模拟历史数据
   * 内嵌 6 种行情模式：STEADY / CONSECUTIVE_2 / CONSECUTIVE_3 / ROTATION / HOT_RUN / COLD_REBOUND
   * 使用固定种子确保每次生成相同数据（可复现）
   *
   * @returns {Array} 100 条模拟历史记录
   */
  generateTestData: function() {
    var self = this;
    var zxAll = self._ZODIAC_ALL;
    var numMap = self.ZODIAC_NUMBER_MAP;

    // 固定种子 LCG（可复现）
    var seed = 42;
    function nextRand() {
      seed = (seed * 1664525 + 1013904223) | 0;
      return ((seed >>> 0) % 10000) / 10000;
    }

    function pickTeNum(zx) {
      var nums = numMap[zx];
      return nums[Math.floor(nextRand() * nums.length)];
    }

    function randZodiac() {
      return zxAll[Math.floor(nextRand() * 12)];
    }

    function numToZodiac(num) {
      if (num === 49) return '鼠';
      var r = num % 12;
      if (r === 0) r = 12;
      return zxAll[r - 1];  // 1→鼠, 2→牛, ..., 12→猪
    }

    var specialZodiacs = [];

    // ---- Phase 1: STEADY（1-25期）随机分布 ----
    for (var i = 0; i < 25; i++) {
      specialZodiacs.push(randZodiac());
    }

    // ---- Phase 2: CONSECUTIVE test（26-35期）连号嵌入 ----
    specialZodiacs.push('龙');    // 26
    specialZodiacs.push('龙');    // 27
    specialZodiacs.push('龙');    // 28 ← CONSECUTIVE_3 触发（27-28-29连续3期龙）
    specialZodiacs.push('龙');    // 29
    specialZodiacs.push('蛇');    // 30 ← 连号结束，不同生肖
    specialZodiacs.push('狗');    // 31
    specialZodiacs.push('狗');    // 32 ← CONSECUTIVE_2 触发（31-32连续2期狗）
    specialZodiacs.push('羊');    // 33
    specialZodiacs.push('马');    // 34
    specialZodiacs.push('马');    // 35 ← CONSECUTIVE_2 触发（34-35连续2期马）

    // ---- Phase 3: ROTATION test（36-55期）12生肖轮转 ----
    zxAll.forEach(function(zx) { specialZodiacs.push(zx); });  // 36-47: 鼠→猪
    zxAll.forEach(function(zx) { specialZodiacs.push(zx); });  // 48-59: 第二轮

    // ---- Phase 4: HOT_RUN（60-79期）鼠热号 ----
    specialZodiacs.push('鼠');  // 60
    specialZodiacs.push('狗');  // 61
    specialZodiacs.push('鼠');  // 62
    specialZodiacs.push('牛');  // 63
    specialZodiacs.push('鼠');  // 64
    specialZodiacs.push('虎');  // 65
    specialZodiacs.push('鼠');  // 66
    specialZodiacs.push('兔');  // 67
    specialZodiacs.push('狗');  // 68
    specialZodiacs.push('狗');  // 69 ← 68-69 CONSECUTIVE_2（热号中的连号）
    specialZodiacs.push('蛇');  // 70
    specialZodiacs.push('鼠');  // 71
    specialZodiacs.push('羊');  // 72
    specialZodiacs.push('猴');  // 73
    specialZodiacs.push('鸡');  // 74
    specialZodiacs.push('狗');  // 75
    specialZodiacs.push('鼠');  // 76
    specialZodiacs.push('牛');  // 77
    specialZodiacs.push('鼠');  // 78
    specialZodiacs.push('猪');  // 79

    // ---- Phase 5: COLD_REBOUND（80-90期）猪冷后反弹 ----
    // 猪在60-79期只出现1次（第79期），配合前一轮轮转后，累计遗漏缺口大
    specialZodiacs.push('兔');  // 80
    specialZodiacs.push('龙');  // 81
    specialZodiacs.push('蛇');  // 82
    specialZodiacs.push('猪');  // 83 ← 猪反弹
    specialZodiacs.push('猪');  // 84 ← 83-84 CONSECUTIVE_2（冷反弹后的连号）
    specialZodiacs.push('马');  // 85
    specialZodiacs.push('羊');  // 86
    specialZodiacs.push('猪');  // 87 ← 猪再次反弹
    specialZodiacs.push('猴');  // 88
    specialZodiacs.push('鸡');  // 89
    specialZodiacs.push('猪');  // 90

    // ---- Phase 6: MIXED（91-100期）随机收尾 ----
    for (var j = 0; j < 10; j++) {
      specialZodiacs.push(randZodiac());
    }

    // ---- 构建完整历史记录 ----
    var data = [];
    var startPeriod = 2026001;

    for (var k = 0; k < 100; k++) {
      var teZx = specialZodiacs[k];
      var teNum = pickTeNum(teZx);

      // 生成 6 个不重复的平码号码
      var otherNums = [];
      for (var n = 1; n <= 49; n++) {
        if (n !== teNum) otherNums.push(n);
      }
      for (var s = otherNums.length - 1; s > 0; s--) {
        var ri = Math.floor(nextRand() * (s + 1));
        var tmp = otherNums[s];
        otherNums[s] = otherNums[ri];
        otherNums[ri] = tmp;
      }
      var selectedOthers = otherNums.slice(0, 6);

      // 号码→生肖映射
      var allZodiacs = selectedOthers.map(function(n) { return numToZodiac(n); });
      allZodiacs.push(teZx);

      data.push({
        expect: String(startPeriod + k),
        opencode: selectedOthers.join(',') + ',' + teNum,
        zodiac: allZodiacs.join(','),
        time: '2026-06-' + String(15 - Math.floor(k / 7)).padStart(2, '0') + ' 12:00'
      });
    }

    return data;
  },

  /**
   * 单次回测（内部函数）
   * @param {Array} historyData - 完整历史数据
   * @param {boolean} useRhythm - true=V1.2节奏跟随, false=V1.1强制关闭
   * @returns {Array} 回测结果数组 [{period, actual, hit, rank, rhythm, top6, scores}, ...]
   */
  _runSingleBacktest: function(historyData, useRhythm) {
    var originalFn = BusinessSlidingWindow.detectRecentRhythm;

    // V1.1 模拟：强制返回 STEADY
    if (!useRhythm) {
      BusinessSlidingWindow.detectRecentRhythm = function() {
        return { pattern: 'STEADY', detail: 'V1.1仿真（强制关闭节奏识别）' };
      };
    }

    try {
      var results = [];
      var minHistory = 12;

      for (var i = minHistory; i < historyData.length; i++) {
        var historySlice = historyData.slice(0, i);
        var prediction = BusinessSlidingWindow.predict(historySlice);
        if (!prediction) continue;

        var actualItem = historyData[i];
        var zodArr = Utils.parseZodiacArr(actualItem);
        var actualZodiac = zodArr[6];

        var hit = false;
        var hitRank = 0;
        for (var j = 0; j < prediction.candidates.length; j++) {
          if (prediction.candidates[j].shengxiao === actualZodiac) {
            hit = true;
            hitRank = j + 1;
            break;
          }
        }

        results.push({
          period: actualItem.expect,
          actual: actualZodiac,
          hit: hit,
          rank: hitRank,
          rhythm: prediction.rhythm ? prediction.rhythm.pattern : 'STEADY',
          top6: prediction.candidates.map(function(c) { return c.shengxiao; }),
          scores: prediction.candidates.map(function(c) { return c.score; })
        });
      }

      return results;
    } finally {
      BusinessSlidingWindow.detectRecentRhythm = originalFn;
    }
  },

  /**
   * 诊断工具：追踪指定期号下某个生肖的详细评分过程
   * 用法：BusinessSlidingWindowHistory.diagnose(28, '龙')
   *
   * @param {number} dataIndex - 模拟数据索引（1-100）
   * @param {string} targetZx - 目标生肖
   */
  diagnose: function(dataIndex, targetZx) {
    var self = this;
    var testData = self.generateTestData();
    var idx = dataIndex - 1;
    if (idx < 12 || idx >= testData.length) {
      console.log('请指定 dataIndex ∈ [13, 100]（至少需要 12 期历史）');
      return;
    }

    var historySlice = testData.slice(0, idx);
    var actualItem = testData[idx];
    var zodArr = Utils.parseZodiacArr(actualItem);
    var actualZodiac = zodArr[6];

    var prediction1 = BusinessSlidingWindow.predict(historySlice);

    // 查看指定生肖的评分
    var targetScore = null;
    for (var i = 0; i < prediction1.allScores.length; i++) {
      if (prediction1.allScores[i].shengxiao === targetZx) {
        targetScore = prediction1.allScores[i];
        break;
      }
    }

    console.log('═══════════════════════════════════');
    console.log('  诊断：第' + actualItem.expect + '期 (数据索引' + dataIndex + ')');
    console.log('  实际特码：' + actualZodiac);
    console.log('  行情节奏：' + (prediction1.rhythm ? prediction1.rhythm.pattern + ' - ' + prediction1.rhythm.detail : '未知'));
    console.log('═══════════════════════════════════');
    console.log('');
    console.log('  Top6 候选：');
    for (var j = 0; j < prediction1.candidates.length; j++) {
      var c = prediction1.candidates[j];
      var marker = c.shengxiao === actualZodiac ? ' ← 命中' : '';
      var mx = c.shengxiao === targetZx ? ' ← 目标' : '';
      console.log('    #' + (j+1) + ' ' + c.emoji + ' ' + c.shengxiao + ' 评分:' + c.score + ' ' + (c.signals ? c.signals.join(',') : '') + marker + mx);
    }

    if (targetScore) {
      console.log('');
      console.log('  【' + targetZx + '】详细评分：');
      console.log('    评分: ' + targetScore.score);
      console.log('    信号: ' + (targetScore.signals ? targetScore.signals.join(', ') : '无'));
      console.log('    原因: ' + targetScore.reason);
      console.log('    w6:' + targetScore.window6 + ' w12:' + targetScore.window12 + ' w24:' + targetScore.window24 + ' w36:' + targetScore.window36);
      console.log('    区域: ' + targetScore.zone6 + ' / ' + targetScore.zone12 + ' / ' + targetScore.zone24 + ' / ' + targetScore.zone36);
      console.log('    遗漏: ' + targetScore.miss + '期');
      console.log('    在12生肖中的排名: ' + (prediction1.allScores.findIndex(function(s) { return s.shengxiao === targetZx; }) + 1));
    } else {
      console.log('  ⚠️ 未找到生肖 ' + targetZx);
    }

    console.log('');
    console.log('  12生肖完整排名：');
    prediction1.allScores.forEach(function(s, i) {
      console.log('    ' + (i+1) + '. ' + s.shengxiao + ' ' + s.score + ' [' + (s.signals ? s.signals.join(',') : '') + ']');
    });
  },

  /**
   * 运行 V1.1 vs V1.2 对比基准测试
   * 在浏览器控制台执行：BusinessSlidingWindowHistory.runBenchmark()
   *
   * 输出：
   *   - V1.1 vs V1.2 总命中率对比
   *   - 6 种行情模式下各版本命中率
   *   - 节奏跟随规则触发频次
   *   - 逐期差异明细（表格）
   */
  runBenchmark: function() {
    var self = this;

    console.log('═══════════════════════════════════════');
    console.log('  V1.1 vs V1.2 回测对比（100期模拟）');
    console.log('═══════════════════════════════════════');
    console.log('');

    // 1. 生成数据
    console.time('▶ 生成100期模拟数据');
    var testData = self.generateTestData();
    console.timeEnd('▶ 生成100期模拟数据');
    console.log('  数据量：' + testData.length + ' 期');
    console.log('  首期：第' + testData[0].expect + '期 → 末期：第' + testData[testData.length - 1].expect + '期');
    console.log('');

    // 2. V1.2 回测
    console.time('▶ V1.2（节奏跟随）回测');
    var v12Results = self._runSingleBacktest(testData, true);
    console.timeEnd('▶ V1.2（节奏跟随）回测');

    // 3. V1.1 回测
    console.time('▶ V1.1（无节奏跟随）回测');
    var v11Results = self._runSingleBacktest(testData, false);
    console.timeEnd('▶ V1.1（无节奏跟随）回测');

    var total = v12Results.length; // 100 - 12 = 88
    var v12Hits = v12Results.filter(function(r) { return r.hit; }).length;
    var v11Hits = v11Results.filter(function(r) { return r.hit; }).length;

    // 4. 总命中率
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  总命中率对比（' + total + ' 期回测）');
    console.log('═══════════════════════════════════════');
    console.log('  V1.1 (无节奏):  ' + v11Hits + '/' + total + ' = ' + (v11Hits/total*100).toFixed(1) + '%');
    console.log('  V1.2 (有节奏):  ' + v12Hits + '/' + total + ' = ' + (v12Hits/total*100).toFixed(1) + '%');
    var diff = v12Hits - v11Hits;
    if (diff > 0) {
      console.log('  差异:  +' + diff + ' 期  ✅ V1.2 节奏跟随有效');
    } else if (diff < 0) {
      console.log('  差异:  ' + diff + ' 期  ⚠️ V1.2 节奏跟随反而降低命中率');
    } else {
      console.log('  差异:  0 期  → 节奏跟随无影响');
    }
    console.log('');

    // 5. 按行情模式分组对比
    // 定义6个行情区间
    var phases = [
      { name: 'STEADY (平稳随机)',  start: 12, end: 24 },
      { name: 'CONSECUTIVE (连号模式)', start: 25, end: 34 },
      { name: 'ROTATION (轮转模式)', start: 35, end: 54 },
      { name: 'ROTATION-2 (第二轮转)', start: 47, end: 54 },
      { name: 'HOT_RUN (热号延续)', start: 55, end: 74 },
      { name: 'COLD_REBOUND (冷号反弹)', start: 75, end: 89 },
      { name: 'MIXED (随机混合)', start: 90, end: 99 }
    ];

    console.log('═══════════════════════════════════════');
    console.log('  各行情模式下命中率对比');
    console.log('═══════════════════════════════════════');

    var phaseResults = phases.map(function(phase) {
      var v12Phase = v12Results.filter(function(r) {
        var idx = parseInt(r.period) - parseInt(testData[0].expect);
        return idx >= phase.start && idx <= phase.end;
      });
      var v11Phase = v11Results.filter(function(r) {
        var idx = parseInt(r.period) - parseInt(testData[0].expect);
        return idx >= phase.start && idx <= phase.end;
      });
      var v12Hit = v12Phase.filter(function(r) { return r.hit; }).length;
      var v11Hit = v11Phase.filter(function(r) { return r.hit; }).length;
      var phaseDiff = v12Hit - v11Hit;

      var icon = phaseDiff > 0 ? '✅' : (phaseDiff < 0 ? '⚠️' : '→');
      console.log('  ' + icon + ' ' + phase.name + ':');
      console.log('      V1.1: ' + v11Hit + '/' + v12Phase.length + ' (' + (v11Hit/v12Phase.length*100).toFixed(1) + '%)');
      console.log('      V1.2: ' + v12Hit + '/' + v12Phase.length + ' (' + (v12Hit/v12Phase.length*100).toFixed(1) + '%)');
      console.log('      差异: ' + (phaseDiff >= 0 ? '+' : '') + phaseDiff);

      return { name: phase.name, v11Hit: v11Hit, v12Hit: v12Hit, total: v12Phase.length, diff: phaseDiff };
    });
    console.log('');

    // 6. 节奏跟随规则触发频次
    var rhythmCounts = {};
    v12Results.forEach(function(r) {
      var pattern = r.rhythm || 'STEADY';
      rhythmCounts[pattern] = (rhythmCounts[pattern] || 0) + 1;
    });

    console.log('═══════════════════════════════════════');
    console.log('  节奏模式触发频次（V1.2 识别）');
    console.log('═══════════════════════════════════════');
    Object.keys(rhythmCounts).sort().forEach(function(key) {
      console.log('  ' + key + ': ' + rhythmCounts[key] + ' 期');
    });

    // 按节奏模式看命中率
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  各节奏模式下 V1.2 命中率');
    console.log('═══════════════════════════════════════');
    var rhythmHitMap = {};
    v12Results.forEach(function(r) {
      var p = r.rhythm || 'STEADY';
      if (!rhythmHitMap[p]) rhythmHitMap[p] = { hits: 0, total: 0 };
      rhythmHitMap[p].total++;
      if (r.hit) rhythmHitMap[p].hits++;
    });
    Object.keys(rhythmHitMap).sort().forEach(function(key) {
      var d = rhythmHitMap[key];
      console.log('  ' + key + ': ' + d.hits + '/' + d.total + ' (' + (d.hits/d.total*100).toFixed(1) + '%)');
    });
    console.log('');

    // 7. 差异明细（逐期差异）
    var diffPeriods = [];
    for (var i = 0; i < v12Results.length; i++) {
      if (v12Results[i].hit !== v11Results[i].hit) {
        diffPeriods.push({
          period: v12Results[i].period,
          actual: v12Results[i].actual,
          rhythm: v12Results[i].rhythm,
          v11: v11Results[i].hit ? '命中 #' + v11Results[i].rank : '未中',
          v12: v12Results[i].hit ? '命中 #' + v12Results[i].rank : '未中',
          effect: v12Results[i].hit ? '✅ V1.2修正命中' : '⚠️ V1.2误杀'
        });
      }
    }

    if (diffPeriods.length > 0) {
      console.log('═══════════════════════════════════════');
      console.log('  逐期差异明细（共 ' + diffPeriods.length + ' 期不一致）');
      console.log('═══════════════════════════════════════');
      console.table(diffPeriods);
    } else {
      console.log('  → 两版本结果完全一致（无差异）');
    }
    console.log('');

    // 8. 汇总
    console.log('═══════════════════════════════════════');
    var conclusion = diff > 0
      ? '结论：V1.2 节奏随正在 100 期模拟数据中提升命中率 +' + diff + ' 期 ✅'
      : (diff < 0
        ? '结论：V1.2 节奏跟随反而降低命中率 ' + diff + ' 期，需调整权重 ⚠️'
        : '结论：V1.2 节奏跟随无影响，需更多数据验证 →');
    console.log('  ' + conclusion);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('💡 提示：如需重新运行，执行 BusinessSlidingWindowHistory.runBenchmark()');

    return {
      total: total,
      v11Hits: v11Hits,
      v12Hits: v12Hits,
      v11Rate: (v11Hits/total*100).toFixed(1),
      v12Rate: (v12Hits/total*100).toFixed(1),
      diff: diff,
      phases: phaseResults,
      rhythmCounts: rhythmCounts,
      diffPeriods: diffPeriods
    };
  },

  /**
   * 用真实历史数据运行 V1.1 vs V1.2 对比回测
   * 浏览器控制台执行：BusinessSlidingWindowHistory.runRealBacktest()
   *
   * 数据来源：StateManager._state.analysis.historyData（真实开奖记录）
   */
  runRealBacktest: function() {
    var self = this;
    var historyData = StateManager._state.analysis.historyData;

    if (!Array.isArray(historyData) || historyData.length < 13) {
      console.log('⚠️ 历史数据不足（至少需要 13 期，当前 ' + (historyData ? historyData.length : 0) + ' 期）');
      return null;
    }

    // ===== 诊断：原始数据中是否有相邻重复生肖 =====
    var rawZodiacs = [];
    for (var ri = 0; ri < historyData.length; ri++) {
      var arr = Utils.parseZodiacArr(historyData[ri]);
      rawZodiacs.push({ expect: historyData[ri].expect, zx: arr[6] || '?' });
    }
    var consec2Count = 0;
    var consec3Count = 0;
    for (var rj = 0; rj < rawZodiacs.length - 1; rj++) {
      if (rawZodiacs[rj].zx === rawZodiacs[rj + 1].zx) {
        consec2Count++;
        if (rj < rawZodiacs.length - 2 && rawZodiacs[rj + 1].zx === rawZodiacs[rj + 2].zx) {
          consec3Count++;
        }
      }
    }
    console.log('🔍 原始数据诊断：' + historyData.length + '期');
    console.log('  相邻重复(2连): ' + consec2Count + ' 次');
    console.log('  相邻重复(3连): ' + consec3Count + ' 次');
    // 列出前5次重复的具体期号
    if (consec2Count > 0) {
      var shown = 0;
      for (var rk = 0; rk < rawZodiacs.length - 1 && shown < 5; rk++) {
        if (rawZodiacs[rk].zx === rawZodiacs[rk + 1].zx) {
          console.log('    例: ' + rawZodiacs[rk + 1].expect + '期(' + rawZodiacs[rk + 1].zx + ') ← ' + rawZodiacs[rk].expect + '期(' + rawZodiacs[rk].zx + ')');
          shown++;
        }
      }
    }
    console.log('');

    // ===== 诊断：detectRecentRhythm 在完整数据上的结果 =====
    var fullZodiacSeq = BusinessSlidingWindow.convertHistoryToZodiacSequence(historyData);
    var fullRhythm = BusinessSlidingWindow.detectRecentRhythm(fullZodiacSeq);
    console.log('🔍 detectRecentRhythm(全量数据): ' + fullRhythm.pattern + ' - ' + fullRhythm.detail);
    console.log('  zodiacSeq 长度: ' + fullZodiacSeq.length);
    if (fullZodiacSeq.length >= 6) {
      var lastZx = fullZodiacSeq.slice(-6).map(function(s) { return s.shengxiao; });
      console.log('  最近6期: ' + lastZx.join(' → '));
    }
    console.log('');

    // 反转数据为旧→新顺序（_runSingleBacktest 要求旧期在前）
    var reversedData = historyData.slice().reverse();
    console.log('🔍 数据反转: 新→旧 → 旧→新 (data[0]=' + reversedData[0].expect + ' → data[' + (reversedData.length-1) + ']=' + reversedData[reversedData.length-1].expect + ')');
    console.log('');

    console.log('═══════════════════════════════════════');
    console.log('  V1.1 vs V1.2 真实数据回测对比');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('  数据量：' + reversedData.length + ' 期');
    console.log('  首期：第' + reversedData[0].expect + '期 → 末期：第' + reversedData[reversedData.length - 1].expect + '期');
    console.log('');

    // V1.2 回测
    var t0 = performance.now();
    var v12Results = self._runSingleBacktest(reversedData, true);
    var t1 = performance.now();
    console.log('▶ V1.2（节奏跟随）回测: ' + (t1 - t0).toFixed(2) + ' ms');

    // V1.1 回测
    var v11Results = self._runSingleBacktest(reversedData, false);
    var t2 = performance.now();
    console.log('▶ V1.1（无节奏跟随）回测: ' + (t2 - t1).toFixed(2) + ' ms');

    var total = v12Results.length;
    var v12Hits = v12Results.filter(function(r) { return r.hit; }).length;
    var v11Hits = v11Results.filter(function(r) { return r.hit; }).length;

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  总命中率对比（' + total + ' 期回测）');
    console.log('═══════════════════════════════════════');
    console.log('  V1.1 (无节奏):  ' + v11Hits + '/' + total + ' = ' + (v11Hits / total * 100).toFixed(1) + '%');
    console.log('  V1.2 (有节奏):  ' + v12Hits + '/' + total + ' = ' + (v12Hits / total * 100).toFixed(1) + '%');

    var diff = v12Hits - v11Hits;
    if (diff > 0) {
      console.log('  差异:  +' + diff + ' 期  ✅ V1.2 节奏跟随有效');
    } else if (diff < 0) {
      console.log('  差异:  ' + diff + ' 期  ⚠️ V1.2 节奏跟随反而降低命中率');
    } else {
      console.log('  差异:  0 期  → 节奏跟随无影响');
    }
    console.log('');

    // 节奏模式触发频次
    var rhythmCounts = {};
    v12Results.forEach(function(r) {
      var pattern = r.rhythm || 'STEADY';
      rhythmCounts[pattern] = (rhythmCounts[pattern] || 0) + 1;
    });

    console.log('═══════════════════════════════════════');
    console.log('  节奏模式触发频次（V1.2 识别）');
    console.log('═══════════════════════════════════════');
    Object.keys(rhythmCounts).sort().forEach(function(key) {
      console.log('  ' + key + ': ' + rhythmCounts[key] + ' 期');
    });

    // 按节奏模式看命中率
    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  各节奏模式下 V1.2 命中率');
    console.log('═══════════════════════════════════════');
    var rhythmHitMap = {};
    v12Results.forEach(function(r) {
      var p = r.rhythm || 'STEADY';
      if (!rhythmHitMap[p]) rhythmHitMap[p] = { hits: 0, total: 0 };
      rhythmHitMap[p].total++;
      if (r.hit) rhythmHitMap[p].hits++;
    });
    Object.keys(rhythmHitMap).sort().forEach(function(key) {
      var d = rhythmHitMap[key];
      console.log('  ' + key + ': ' + d.hits + '/' + d.total + ' (' + (d.hits / d.total * 100).toFixed(1) + '%)');
    });
    console.log('');

    // 逐期差异
    var diffPeriods = [];
    for (var i = 0; i < v12Results.length; i++) {
      if (v12Results[i].hit !== v11Results[i].hit) {
        diffPeriods.push({
          period: v12Results[i].period,
          actual: v12Results[i].actual,
          rhythm: v12Results[i].rhythm,
          v11: v11Results[i].hit ? '命中 #' + v11Results[i].rank : '未中',
          v12: v12Results[i].hit ? '命中 #' + v12Results[i].rank : '未中',
          effect: v12Results[i].hit ? '✅ V1.2修正命中' : '⚠️ V1.2误杀'
        });
      }
    }

    if (diffPeriods.length > 0) {
      console.log('═══════════════════════════════════════');
      console.log('  逐期差异明细（共 ' + diffPeriods.length + ' 期不一致）');
      console.log('═══════════════════════════════════════');
      console.table(diffPeriods);
    } else {
      console.log('→ 两版本结果完全一致（无差异）');
    }
    console.log('');

    console.log('═══════════════════════════════════════');
    var conclusion = diff > 0
      ? '  结论：V1.2 节奏跟随在真实数据中提升命中率 +' + diff + ' 期 ✅'
      : (diff < 0
        ? '  结论：V1.2 节奏跟随在真实数据中降低命中率 ' + diff + ' 期，需调整 ⚠️'
        : '  结论：V1.2 节奏跟随在真实数据中无影响 →');
    console.log(conclusion);
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('💡 重新运行：BusinessSlidingWindowHistory.runRealBacktest()');

    return {
      total: total,
      v11Hits: v11Hits,
      v12Hits: v12Hits,
      v11Rate: (v11Hits / total * 100).toFixed(1),
      v12Rate: (v12Hits / total * 100).toFixed(1),
      diff: diff,
      diffPeriods: diffPeriods,
      rhythmCounts: rhythmCounts,
      rhythmHitMap: rhythmHitMap
    };
  },

  /**
   * 运行 无排除 vs 有排除 对比回测
   * 测试交叉排除逻辑对命中率的影响
   * 浏览器控制台执行：BusinessSlidingWindowHistory.runExclusionBenchmark()
   */
  runExclusionBenchmark: function() {
    var self = this;
    var state = StateManager._state;
    var historyData = state.analysis.historyData;
    if (!historyData || !historyData.length) {
      historyData = Storage.get('historyCache', []);
    }
    if (!historyData || historyData.length < 30) {
      console.log('数据不足，至少需要 30 期历史数据');
      return;
    }

    var reversedData = historyData.slice().reverse();

    console.log('═══════════════════════════════════════');
    console.log('  无排除 vs 有排除 回测对比');
    console.log('═══════════════════════════════════════');
    console.log('');
    console.log('  数据量：' + reversedData.length + ' 期');
    console.log('  首期：第' + reversedData[0].expect + '期 → 末期：第' + reversedData[reversedData.length - 1].expect + '期');
    console.log('');

    var N = Math.min(30, reversedData.length);
    var withoutExclusion = [];
    var withExclusion = [];

    for (var i = 0; i < N; i++) {
      var actualItem = reversedData[i];
      var simulateData = reversedData.slice(i + 1);
      if (simulateData.length < 12) continue;

      var expect = Number(actualItem.expect || 0);
      if (!expect) continue;

      var actualZodArr = Utils.parseZodiacArr(actualItem);
      var actualZodiac = actualZodArr[6] || '';
      if (!actualZodiac) continue;

      // 无排除版本
      var predNoExcl = BusinessSlidingWindow.predict(simulateData);
      if (predNoExcl && predNoExcl.candidates) {
        var hitRankNo = 0;
        for (var j = 0; j < predNoExcl.candidates.length; j++) {
          if (predNoExcl.candidates[j].shengxiao === actualZodiac) {
            hitRankNo = j + 1;
            break;
          }
        }
        withoutExclusion.push({
          period: expect,
          actual: actualZodiac,
          hit: hitRankNo > 0,
          rank: hitRankNo,
          candidates: predNoExcl.candidates.map(function(c) { return c.shengxiao; })
        });
      }

      // 有排除版本（[V1.4.2 优化] 一次性传完整 crossResult，避免 predict 内部重复调用 collectAllRecommend）
      var crossResult = null;
      try {
        crossResult = BusinessCrossExclusion.collectAllRecommend(simulateData);
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BusinessSlidingWindowHistory] 交叉排除收集失败：', e);
        }
      }

      var predWithExcl = BusinessSlidingWindow.predict(simulateData, { crossResult: crossResult });
      if (predWithExcl && predWithExcl.candidates) {
        var hitRankWith = 0;
        for (var k = 0; k < predWithExcl.candidates.length; k++) {
          if (predWithExcl.candidates[k].shengxiao === actualZodiac) {
            hitRankWith = k + 1;
            break;
          }
        }
        withExclusion.push({
          period: expect,
          actual: actualZodiac,
          hit: hitRankWith > 0,
          rank: hitRankWith,
          candidates: predWithExcl.candidates.map(function(c) { return c.shengxiao; }),
          excludedCount: excluded.length
        });
      }
    }

    var total = withoutExclusion.length;
    var noHits = 0, withHits = 0;
    var diffPeriods = [];

    for (var i = 0; i < total; i++) {
      if (withoutExclusion[i].hit) noHits++;
      if (withExclusion[i].hit) withHits++;

      if (withoutExclusion[i].hit !== withExclusion[i].hit) {
        diffPeriods.push({
          period: withoutExclusion[i].period,
          actual: withoutExclusion[i].actual,
          without: withoutExclusion[i].hit ? ('命中 #' + withoutExclusion[i].rank) : '未中',
          withExcl: withExclusion[i].hit ? ('命中 #' + withExclusion[i].rank) : '未中',
          effect: withExclusion[i].hit ? '✅ 排除修正命中' : '⚠️ 排除误杀',
          excludedCount: withExclusion[i].excludedCount
        });
      }
    }

    console.log('');
    console.log('═══════════════════════════════════════');
    console.log('  总命中率对比（' + total + ' 期回测）');
    console.log('═══════════════════════════════════════');
    console.log('  无排除: ' + noHits + '/' + total + ' = ' + (noHits / total * 100).toFixed(1) + '%');
    console.log('  有排除: ' + withHits + '/' + total + ' = ' + (withHits / total * 100).toFixed(1) + '%');
    var diff = withHits - noHits;
    if (diff > 0) {
      console.log('  差异:  +' + diff + ' 期  ✅ 交叉排除更优');
    } else if (diff < 0) {
      console.log('  差异:  ' + diff + ' 期  ⚠️ 交叉排除不如原版');
    } else {
      console.log('  差异:  0 期  → 两种策略无差异');
    }
    console.log('');

    if (diffPeriods.length > 0) {
      console.log('═══════════════════════════════════════');
      console.log('  逐期差异明细（共 ' + diffPeriods.length + ' 期不一致）');
      console.log('═══════════════════════════════════════');
      console.table(diffPeriods);
    } else {
      console.log('→ 两版本结果完全一致（无差异）');
    }
    console.log('');

    console.log('💡 重新运行：BusinessSlidingWindowHistory.runExclusionBenchmark()');

    return {
      total: total,
      noHits: noHits,
      withHits: withHits,
      noRate: (noHits / total * 100).toFixed(1),
      withRate: (withHits / total * 100).toFixed(1),
      diff: diff,
      diffPeriods: diffPeriods
    };
  },

};
