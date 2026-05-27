/**
 * V5.3 数据转换工具
 * 将现有项目1-49号码数据转换为V5.3所需的1-12生肖号码空间
 */
const BusinessV53Utils = {
  /**
   * 将完整历史数据转换为生肖号码历史
   * @param {Array} history - [{number, expect, zodiac}, ...], 最新在前(history[0]=最新期)
   * @returns {Array} V5.3格式 [[n1], [n2], ...] 每期生肖号1-12, 按时间顺序排列(最旧在前)
   */
  convertToZodiacHistory: function(history) {
    if (!history || !history.length) return [];

    // 关键：现有项目 historyData[0] = 最新期(如2026144), 需要反转为时间顺序
    var reversed = history.slice().reverse();

    // 按项目约定从 zociac 字符串索引6提取特码生肖(与 Giong算法一致)
    // 注意：zodiac字符串可能包含多个生肖，但V5.3引擎每期只需特码生肖（索引6）
    return reversed.map(function(item) {
      var zodiacStr = item.zodiac || ',,,,,,,,,,,,';
      var zodArrRaw = zodiacStr.split(',');
      var zodArr = zodArrRaw.map(function(z) {
        return CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z;
      });
      var mainZod = zodArr[6] || '';

      var result = [];
      if (mainZod) {
        var num = BusinessUltimate.ZODIAC_TO_NUM[mainZod] || 0;
        if (num >= 1 && num <= 12) result.push(num);
      }

      return result;
    });
  },

  /**
   * 统计窗口内每个号码的次数
   * @param {Array} zodiacHistory - [[n1,n2,n3], ...]
   * @param {number} windowSize - 窗口大小
   * @returns {Object} {1: count, ... 12: count}
   */
  countWindowFreq: function(zodiacHistory, windowSize) {
    var freq = {};
    for (var i = 1; i <= 12; i++) freq[i] = 0;

    var recent = zodiacHistory.slice(-windowSize);
    recent.forEach(function(period) {
      period.forEach(function(num) {
        if (num >= 1 && num <= 12) freq[num]++;
      });
    });
    return freq;
  },

  /**
   * 最近N期内某号码中出次数
   */
  getRecentCount: function(zodiacHistory, num, n) {
    var recent = zodiacHistory.slice(-n);
    var count = 0;
    recent.forEach(function(p) { if (p.indexOf(num) !== -1) count++; });
    return count;
  },

  /**
   * 某号码的遗漏值
   */
  getMissCount: function(zodiacHistory, num) {
    var miss = 0;
    for (var i = zodiacHistory.length - 1; i >= 0; i--) {
      if (zodiacHistory[i].indexOf(num) !== -1) break;
      miss++;
    }
    return miss;
  },

  /**
   * 深拷贝
   */
  deepClone: function(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Array) {
      var arr = [];
      obj.forEach(function(item) { arr.push(BusinessV53Utils.deepClone(item)); });
      return arr;
    }
    var copy = {};
    Object.keys(obj).forEach(function(key) { copy[key] = BusinessV53Utils.deepClone(obj[key]); });
    return copy;
  },

  /**
   * 生肖号 -> 中文字
   */
  numToZodiac: function(num) {
    return BusinessUltimate.NUM_TO_ZODIAC[num] || '';
  }
};