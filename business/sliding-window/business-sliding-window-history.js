/**
 * 滑动窗口预测历史记录 · 业务层
 * 职责：记录每期主推候选、与实际开奖比对、持久化存储、统计命中率
 *
 * 数据结构 (单条记录):
 * {
 *   period: 155,                    // 推荐的目标期号
 *   recommendTime: 1735689600000,   // 推荐时间戳(首次推荐)
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

  /** 算法版本（升级时修改此处） */
  ALGORITHM_VERSION: '滑动窗口V1.0',

  /**
   * 校验单条记录格式，过滤掉非法记录
   * @param {any} rec - 待校验记录
   * @returns {boolean} 是否合法
   * @private
   */
  _isValidRecord: function(rec) {
    return rec &&
      typeof rec === 'object' &&
      typeof rec.period === 'number' &&
      rec.period > 0 &&
      Array.isArray(rec.candidates) &&
      rec.candidates.length > 0;
  },

  /**
   * 按 period 去重（保留首次出现的）
   * @param {Array} records - 原始记录列表
   * @returns {Array} 去重后列表
   * @private
   */
  _dedupeByPeriod: function(records) {
    if (!Array.isArray(records)) return [];
    var seen = {};
    var result = [];
    for (var i = 0; i < records.length; i++) {
      var r = records[i];
      if (!this._isValidRecord(r)) continue;
      if (seen[r.period]) continue;
      seen[r.period] = true;
      result.push(r);
    }
    return result;
  },

  /**
   * 读取所有历史记录（按推荐期号倒序）
   * @returns {Array} 记录列表
   */
  loadAll: function() {
    var records = Storage.get(Storage.KEYS.SLIDING_WINDOW_RECORDS, []);
    if (!Array.isArray(records)) records = [];
    // 过滤非法记录 + 去重 + 按 period 倒序
    var cleaned = this._dedupeByPeriod(records);
    cleaned.sort(function(a, b) { return (b.period || 0) - (a.period || 0); });
    return cleaned;
  },

  /**
   * 持久化保存记录（自动裁剪到30条 + 去重）
   * @param {Array} records - 完整记录列表
   * @returns {boolean} 是否成功
   */
  saveAll: function(records) {
    if (!Array.isArray(records)) return false;
    // 去重 → 排序 → 裁剪到30条
    var deduped = this._dedupeByPeriod(records);
    deduped.sort(function(a, b) {
      return (b.period || 0) - (a.period || 0);
    });
    var trimmed = deduped.slice(0, this.MAX_RECORDS);
    var ok = Storage.set(Storage.KEYS.SLIDING_WINDOW_RECORDS, trimmed);
    if (!ok) {
      console.error('[SlidingWindowHistory] 持久化失败', trimmed.length, '条记录');
    }
    return ok;
  },

  /**
   * 添加一条新推荐记录
   * 重要：若同期记录已存在，**保留首次推荐时间与首次候选**，避免用户切走切回时丢失历史
   *
   * @param {Object} prediction - BusinessSlidingWindow.predict() 的返回结果
   * @returns {Object|null} 记录（已持久化），失败返回 null
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

    if (existingIdx >= 0) {
      // 已存在：完全保留原记录（candidates/recommendTime/核对结果都不变）
      // 原因：算法是确定性的，重复 addRecord 不会产生新信息
      return records[existingIdx];
    }

    // 新建记录
    var newRecord = {
      period: prediction.nextExpect,
      recommendTime: prediction.timestamp || Date.now(),
      candidates: candidates,
      candidateScores: candidateScores,
      algorithm: prediction.algorithm || this.ALGORITHM_VERSION,
      // 保存推荐当时的 allScores（用于回填实际开奖前的窗口区域）
      // 关键：这里的 allScores 是推荐时计算的，对应"开出之前"的窗口统计
      allScores: prediction.allScores || [],
      actualZodiac: '',
      actualPeriod: prediction.nextExpect,
      hitRank: 0,
      hitStatus: 'pending',
      checkedTime: 0
    };

    records.unshift(newRecord);
    var ok = this.saveAll(records);
    return ok ? newRecord : null;
  },

  /**
   * 从历史开奖数据中匹配记录的实际开奖生肖
   * @param {Array} records - 记录列表
   * @param {Array} historyData - 完整历史数据
   * @param {Array} [allScores] - BusinessSlidingWindow.predict() 返回的 allScores
   *   用于回填实际开奖生肖当时所处的 12/24/36 期窗口区域
   * @returns {Array} 更新后的记录列表
   */
  checkResults: function(records, historyData, allScores) {
    if (!Array.isArray(records) || !Array.isArray(historyData)) return records;

    // 构建 period -> 实际生肖 的快速查找表
    var zodiacMap = {};
    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var expect = Number(item.expect || 0);
      if (!expect) continue;
      var zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
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

    // 构建 zodiac -> {zone12, zone24, zone36} 映射（用于回填实际开奖时所在的区域）
    var zoneMap = {};
    if (Array.isArray(allScores)) {
      for (var s = 0; s < allScores.length; s++) {
        var sc = allScores[s];
        if (sc && sc.shengxiao) {
          zoneMap[sc.shengxiao] = {
            z12: sc.zone12 || '',
            z24: sc.zone24 || '',
            z36: sc.zone36 || ''
          };
        }
      }
    }

    var updated = false;
    for (var j = 0; j < records.length; j++) {
      var rec = records[j];
      var period = rec.period;
      if (zodiacMap[period]) {
        var actual = zodiacMap[period];
        var needUpdate = rec.actualZodiac !== actual || rec.hitStatus === 'pending';
        if (needUpdate) {
          rec.actualZodiac = actual;
          rec.actualPeriod = period;
          rec.hitRank = this.computeHitRank(rec.candidates, actual);
          rec.hitStatus = rec.hitRank > 0 ? 'hit' : 'miss';
          rec.checkedTime = Date.now();
          // 回填实际开奖时所在窗口区域
          // 优先使用 rec.allScores（推荐当时的快照，对应"开出之前"的窗口统计）
          // 兼容老数据：若无 rec.allScores 则回退到当前的 allScores
          var recZoneMap = {};
          var recScores = rec.allScores && rec.allScores.length > 0 ? rec.allScores : allScores;
          if (Array.isArray(recScores)) {
            for (var s = 0; s < recScores.length; s++) {
              var sc = recScores[s];
              if (sc && sc.shengxiao) {
                recZoneMap[sc.shengxiao] = {
                  z12: sc.zone12 || '',
                  z24: sc.zone24 || '',
                  z36: sc.zone36 || ''
                };
              }
            }
          }
          if (recZoneMap[actual]) {
            rec.actualZones = {
              zone12: recZoneMap[actual].z12,
              zone24: recZoneMap[actual].z24,
              zone36: recZoneMap[actual].z36
            };
          }
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
   * @param {Object} prediction - 预测结果（含 allScores 用于回填窗口区域）
   * @param {Array} historyData - 历史开奖数据
   * @returns {Array} 全部历史记录(已核对)
   */
  saveAndCheck: function(prediction, historyData) {
    // 1. 先添加新推荐（addRecord 内部已持久化）
    this.addRecord(prediction);

    // 2. 重新读取（含新记录），再统一核对一次（仅一次持久化）
    var records = this.loadAll();
    if (historyData && historyData.length) {
      this.checkResults(records, historyData, prediction && prediction.allScores);
      records = this.loadAll();
    }
    return records;
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

    // 升序遍历（从最早到最新），正确计算连续命中
    var sortedAsc = records.slice().sort(function(a, b) { return (a.period || 0) - (b.period || 0); });

    for (var i = 0; i < sortedAsc.length; i++) {
      var r = sortedAsc[i];
      if (r.hitStatus === 'pending') {
        pending++;
        // pending 不打断连中计数（视为"未开奖"而非"中断"）
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
   * 清空所有历史记录（无确认，直接清空，谨慎调用）
   * @returns {boolean}
   */
  clearAll: function() {
    return Storage.set(Storage.KEYS.SLIDING_WINDOW_RECORDS, []);
  },

  /**
   * 二次确认后清空所有历史记录
   * 确认后会自动清空并回调 onCleared（用于刷新界面）
   * @param {Function} onCleared - 清空成功后的回调
   */
  confirmAndClearAll: function(onCleared) {
    var self = this;
    // 平台层弹窗：传入的回调是异步的
    GIONGBETA_CONFIRM_MODAL.show(
      '确定要清空所有主推历史记录吗？\n该操作不可恢复。',
      function(confirmed) {
        if (!confirmed) return;
        var ok = self.clearAll();
        if (ok) {
          Toast.show('历史记录已清空');
          if (typeof onCleared === 'function') onCleared();
        } else {
          Toast.show('清空失败，请重试');
        }
      }
    );
  },

  /**
   * 清理已无法核对的老记录（其 period 在当前 historyData 范围之外且仍为 pending）
   * 用于避免老数据永久 pending 占用 30 期名额
   *
   * @param {Array} historyData - 当前历史数据
   * @returns {number} 清理掉的记录数
   */
  cleanupStaleRecords: function(historyData) {
    if (!Array.isArray(historyData) || !historyData.length) return 0;

    // 计算当前历史数据的最早期号
    var minExpect = Infinity;
    for (var i = 0; i < historyData.length; i++) {
      var exp = Number(historyData[i].expect || 0);
      if (exp && exp < minExpect) minExpect = exp;
    }
    if (minExpect === Infinity) return 0;

    var records = this.loadAll();
    var originalLen = records.length;
    var filtered = records.filter(function(r) {
      // 保留：已核对 OR period 在历史数据范围内
      return r.hitStatus !== 'pending' || r.period >= minExpect;
    });

    if (filtered.length < originalLen) {
      this.saveAll(filtered);
    }
    return originalLen - filtered.length;
  }
};
