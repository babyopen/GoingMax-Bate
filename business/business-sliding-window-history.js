/**
 * 滑动窗口预测历史记录 · 业务层
 * 职责：记录每期主推候选、与实际开奖比对、持久化存储、统计命中率
 *
 * 数据结构 (单条记录):
 * {
 *   period: 155,                    // 推荐的目标期号
 *   recommendTime: 1735689600000,   // 推荐时间戳
 *   candidates: ['马','牛','兔'],   // 6个候选生肖(按评分排序)
 *   candidateScores: [80, 80, 80],  // 候选评分
 *   algorithm: '滑动窗口V1.0',        // 算法版本
 *   actualZodiac: '狗',              // 实际开奖生肖(已开奖后回填)
 *   actualPeriod: 155,              // 实际开奖期号
 *   hitRank: 1,                     // 命中的排名(1-6), 未命中=0
 *   hitStatus: 'hit' | 'miss' | 'pending',  // 命中状态
 *   checkedTime: 1735776000000      // 核对时间戳
 * }
 *
 * 依赖方向: views/ -> business/ -> core/
 * 禁止DOM操作
 */
const BusinessSlidingWindowHistory = {

  /** 最大保留期数 */
  MAX_RECORDS: 30,

  /**
   * 读取所有历史记录（按推荐期号倒序）
   * @returns {Array} 记录列表
   */
  loadAll: function() {
    var records = Storage.get(Storage.KEYS.SLIDING_WINDOW_RECORDS, []);
    if (!Array.isArray(records)) records = [];
    // 按 period 倒序
    records.sort(function(a, b) { return (b.period || 0) - (a.period || 0); });
    return records;
  },

  /**
   * 持久化保存记录（自动裁剪到30条）
   * @param {Array} records - 完整记录列表
   * @returns {boolean} 是否成功
   */
  saveAll: function(records) {
    if (!Array.isArray(records)) return false;
    // 按 period 倒序，保留最新30期
    var sorted = records.slice().sort(function(a, b) {
      return (b.period || 0) - (a.period || 0);
    });
    var trimmed = sorted.slice(0, this.MAX_RECORDS);
    return Storage.set(Storage.KEYS.SLIDING_WINDOW_RECORDS, trimmed);
  },

  /**
   * 添加一条新推荐记录
   * @param {Object} prediction - BusinessSlidingWindow.predict() 的返回结果
   * @returns {Object|null} 新增的记录（已持久化）
   */
  addRecord: function(prediction) {
    if (!prediction || !prediction.candidates || !prediction.candidates.length) return null;
    if (!prediction.nextExpect) return null;

    var records = this.loadAll();

    // 检查是否已存在同期的记录
    var existingIdx = -1;
    for (var i = 0; i < records.length; i++) {
      if (records[i].period === prediction.nextExpect) {
        existingIdx = i;
        break;
      }
    }

    // 提取候选生肖和评分
    var candidates = prediction.candidates.map(function(c) { return c.shengxiao; });
    var candidateScores = prediction.candidates.map(function(c) { return c.score; });

    var newRecord = {
      period: prediction.nextExpect,
      recommendTime: prediction.timestamp || Date.now(),
      candidates: candidates,
      candidateScores: candidateScores,
      algorithm: prediction.algorithm || '滑动窗口V1.0',
      actualZodiac: '',
      actualPeriod: prediction.nextExpect,
      hitRank: 0,
      hitStatus: 'pending',
      checkedTime: 0
    };

    if (existingIdx >= 0) {
      // 已存在：保留已核对的结果，只更新候选
      var existing = records[existingIdx];
      newRecord.actualZodiac = existing.actualZodiac || '';
      newRecord.actualPeriod = existing.actualPeriod || existing.period;
      newRecord.hitRank = existing.hitRank || 0;
      newRecord.hitStatus = existing.hitStatus || 'pending';
      newRecord.checkedTime = existing.checkedTime || 0;
      records[existingIdx] = newRecord;
    } else {
      records.unshift(newRecord);
    }

    this.saveAll(records);
    return newRecord;
  },

  /**
   * 从历史开奖数据中匹配记录的实际开奖生肖
   * @param {Array} records - 记录列表
   * @param {Array} historyData - 完整历史数据
   * @returns {Array} 更新后的记录列表
   */
  checkResults: function(records, historyData) {
    if (!Array.isArray(records) || !Array.isArray(historyData)) return records;

    // 构建 period -> 实际生肖 的快速查找表
    var zodiacMap = {};
    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var expect = Number(item.expect || 0);
      if (!expect) continue;
      var zodArrRaw = (item.zodiac || '').split(',');
      var zodArr = zodArrRaw.map(function(z) {
        return CONFIG && CONFIG.ANALYSIS && CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP
          ? (CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z)
          : z;
      });
      var specialZodiac = zodArr[6] || '';
      if (specialZodiac) {
        zodiacMap[expect] = specialZodiac;
      }
    }

    var updated = false;
    for (var j = 0; j < records.length; j++) {
      var rec = records[j];
      var period = rec.period;
      if (zodiacMap[period]) {
        var actual = zodiacMap[period];
        if (rec.actualZodiac !== actual || rec.hitStatus === 'pending') {
          rec.actualZodiac = actual;
          rec.actualPeriod = period;
          rec.hitRank = this.computeHitRank(rec.candidates, actual);
          rec.hitStatus = rec.hitRank > 0 ? 'hit' : 'miss';
          rec.checkedTime = Date.now();
          updated = true;
        }
      }
    }

    if (updated) {
      this.saveAll(records);
    }
    return records;
  },

  /**
   * 计算实际生肖在候选中的排名（1-6），未命中返回0
   * @param {Array} candidates - 候选生肖数组
   * @param {string} actual - 实际生肖
   * @returns {number} 命中排名(0=未命中)
   */
  computeHitRank: function(candidates, actual) {
    if (!Array.isArray(candidates) || !actual) return 0;
    for (var i = 0; i < candidates.length; i++) {
      if (candidates[i] === actual) return i + 1;
    }
    return 0;
  },

  /**
   * 一站式：保存推荐 + 自动核对 + 返回最新记录
   * @param {Object} prediction - 预测结果
   * @param {Array} historyData - 历史开奖数据
   * @returns {Array} 全部历史记录(已核对)
   */
  saveAndCheck: function(prediction, historyData) {
    if (!prediction || !prediction.nextExpect) return this.loadAll();

    // 1. 先批量核对已有记录
    var records = this.loadAll();
    if (historyData && historyData.length) {
      this.checkResults(records, historyData);
      records = this.loadAll(); // 重新读取(已更新)
    }

    // 2. 添加新推荐记录
    var added = this.addRecord(prediction);
    if (added && historyData && historyData.length) {
      // 3. 立即核对刚添加的记录(可能开奖数据已包含)
      var list2 = this.loadAll();
      this.checkResults(list2, historyData);
    }

    return this.loadAll();
  },

  /**
   * 计算统计信息（命中率、连续命中、总记录数等）
   * @param {Array} records - 记录列表
   * @returns {Object} 统计信息
   */
  getStats: function(records) {
    if (!Array.isArray(records)) records = [];
    var total = records.length;
    var checked = 0, hit = 0, miss = 0, pending = 0;
    var rankStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    var consecutiveHit = 0, maxConsecutiveHit = 0;

    // 由于是倒序（最新在前），从前往后遍历计算连续命中
    var sortedAsc = records.slice().sort(function(a, b) { return (a.period || 0) - (b.period || 0); });

    for (var i = 0; i < sortedAsc.length; i++) {
      var r = sortedAsc[i];
      if (r.hitStatus === 'pending') {
        pending++;
        consecutiveHit = 0;
        continue;
      }
      checked++;
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

    var hitRate = checked > 0 ? (hit / checked * 100) : 0;
    var top3Rate = checked > 0 ? ((rankStats[1] + rankStats[2] + rankStats[3]) / checked * 100) : 0;
    var firstRankRate = checked > 0 ? (rankStats[1] / checked * 100) : 0;

    return {
      total: total,
      checked: checked,
      hit: hit,
      miss: miss,
      pending: pending,
      hitRate: hitRate,
      top3Rate: top3Rate,
      firstRankRate: firstRankRate,
      rankStats: rankStats,
      maxConsecutiveHit: maxConsecutiveHit
    };
  },

  /**
   * 清空所有历史记录
   * @returns {boolean}
   */
  clearAll: function() {
    return Storage.set(Storage.KEYS.SLIDING_WINDOW_RECORDS, []);
  }
};
