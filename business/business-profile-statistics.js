/**
 * 业务层：资料页 - 数据统计（生肖/号码/分级）
 * @namespace BusinessProfileStatistics
 * 职责：从历史开奖数据计算出现次数、概率、间隔、遗漏等统计指标
 * 依赖：core/config.js（生肖映射、号码→生肖）、core/state.js（historyData）
 * 红线：不操作 DOM
 */
const BusinessProfileStatistics = {

  // ============================================================
  // 内部辅助
  // ============================================================

  /**
   * 把号码写入对应生肖的"出现期号数组"
   * @private
   */
  _bucket: function(map, key, issueIdx) {
    if (!map[key]) map[key] = [];
    map[key].push(issueIdx);
  },

  /**
   * 计算间隔统计（平均/最大/最小）
   * @param {Array<number>} indices - 出现的期号下标（升序）
   * @returns {{avgGap:string,maxGap:string|number,minGap:string|number}}
   * @private
   */
  _calcGaps: function(indices) {
    if (indices.length < 2) {
      return { avgGap: '-', maxGap: '-', minGap: '-' };
    }
    var gaps = [];
    for (var i = 1; i < indices.length; i++) {
      gaps.push(indices[i] - indices[i - 1]);
    }
    var sum = 0;
    for (var j = 0; j < gaps.length; j++) sum += gaps[j];
    return {
      avgGap: (sum / gaps.length).toFixed(2),
      maxGap: Math.max.apply(null, gaps),
      minGap: Math.min.apply(null, gaps)
    };
  },

  /**
   * 计算"当前遗漏"（从最后一次出现到现在的期数差）
   * @param {Array<number>} indices - 出现的期号下标（升序）
   * @param {number} totalIssues - 总期数
   * @returns {number}
   * @private
   */
  _calcCurrentMiss: function(indices, totalIssues) {
    if (indices.length === 0) return totalIssues;
    return totalIssues - 1 - indices[indices.length - 1];
  },

  /**
   * 把 rawHistoryData 解析为统一格式：[{issueIdx, codes:[number,...]}, ...]
   * 按 expect 升序（旧→新），issueIdx 0 = 最旧
   * @private
   */
  _prepareDraws: function(historyData) {
    if (!Array.isArray(historyData) || historyData.length === 0) return [];
    var sorted = historyData.slice().sort(function(a, b) {
      return Number(a.expect || 0) - Number(b.expect || 0);
    });
    return sorted.map(function(item) {
      var code = (item.openCode || '').split(',');
      return code.map(Number).filter(function(n) { return n >= 1 && n <= 49; });
    }).filter(function(arr) { return arr.length > 0; });
  },

  // ============================================================
  // 公开 API
  // ============================================================

  /**
   * 计算 12 生肖统计
   * @param {Array} historyData
   * @returns {Array<{zodiac:string,count:number,probability:string,avgGap:string,maxGap:string|number,minGap:string|number,currentMiss:number}>}
   */
  calcZodiacStats: function(historyData) {
    var zodiacs = CONFIG.ANALYSIS.ZODIAC_ALL;
    var draws = this._prepareDraws(historyData);
    var totalIssues = draws.length;

    var appearanceMap = {};
    zodiacs.forEach(function(z) { appearanceMap[z] = []; });

    draws.forEach(function(codes, issueIdx) {
      var seen = {};
      for (var i = 0; i < codes.length; i++) {
        var z = CONFIG.NUM_TO_ZODIAC[codes[i]];
        if (z && appearanceMap[z]) seen[z] = true;
      }
      Object.keys(seen).forEach(function(z) {
        appearanceMap[z].push(issueIdx);
      });
    });

    return zodiacs.map(function(z) {
      var indices = appearanceMap[z];
      var count = indices.length;
      var probability = totalIssues > 0 ? (count / totalIssues * 100).toFixed(2) + '%' : '0.00%';
      var gaps = BusinessProfileStatistics._calcGaps(indices);
      var currentMiss = BusinessProfileStatistics._calcCurrentMiss(indices, totalIssues);
      return {
        zodiac: z,
        count: count,
        probability: probability,
        avgGap: gaps.avgGap,
        maxGap: gaps.maxGap,
        minGap: gaps.minGap,
        currentMiss: currentMiss
      };
    });
  },

  /**
   * 计算 49 号码分级（按"当前遗漏"区间）
   * 极冷 ≥ 100、冷 50-99、温 30-50、热 0-29
   * @param {Array} numberStats - 来自 Business.calcFullAnalysis().numStatistics
   * @returns {Array<{level:string,emoji:string,minMiss:number,maxMiss:number|string,color:string,count:number,percentage:string,samples:Array<number>,nums:Array<number>}>}
   */
  calcNumberGrades: function(numberStats) {
    var gradeDefs = [
      { level: '极冷', emoji: '🔴', minMiss: 100, maxMiss: Infinity, color: '#FF3B30', sampleLimit: 99 },
      { level: '冷',   emoji: '🟠', minMiss: 50,  maxMiss: 99,       color: '#FF9500', sampleLimit: 8 },
      { level: '温',   emoji: '🟡', minMiss: 30,  maxMiss: 50,       color: '#FFCC00', sampleLimit: 6 },
      { level: '热',   emoji: '🟢', minMiss: 0,   maxMiss: 29,       color: '#34C759', sampleLimit: 5 }
    ];

    // 按 currentMiss 降序排（极冷在前）
    var sorted = numberStats.slice().sort(function(a, b) {
      return b.currentMiss - a.currentMiss;
    });

    return gradeDefs.map(function(def) {
      var nums = sorted.filter(function(s) {
        return s.currentMiss >= def.minMiss && s.currentMiss <= def.maxMiss;
      });
      var numList = nums.map(function(s) { return Number(s.num); });
      var samples = numList.slice(0, def.sampleLimit);
      return {
        level: def.level,
        emoji: def.emoji,
        minMiss: def.minMiss,
        maxMiss: def.maxMiss === Infinity ? '∞' : def.maxMiss,
        color: def.color,
        count: numList.length,
        percentage: ((numList.length / 49) * 100).toFixed(1) + '%',
        samples: samples,
        nums: numList,
        omitted: numList.length - samples.length
      };
    });
  }
};