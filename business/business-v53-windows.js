/**
 * V5.3 多窗口频次统计 + 基础评分
 * 对应文档任务三 3.1 节 + 第二章 2.1-2.3
 */
const BusinessV53Windows = {
  /**
   * 计算所有5个窗口的频次
   * @returns {{'36':{}, '24':{}, '12':{}, '7':{}, '3':{}}}
   */
  computeWindowFreq: function(zodiacHistory) {
    var w = BusinessV53Config.WINDOWS;
    return {
      '36': BusinessV53Utils.countWindowFreq(zodiacHistory, w.FREQ_36),
      '24': BusinessV53Utils.countWindowFreq(zodiacHistory, w.FREQ_24),
      '12': BusinessV53Utils.countWindowFreq(zodiacHistory, w.FREQ_12),
      '7':  BusinessV53Utils.countWindowFreq(zodiacHistory, w.FREQ_7),
      '3':  BusinessV53Utils.countWindowFreq(zodiacHistory, w.FREQ_3)
    };
  },

  /**
   * 2.1 基础热度分 = Σ(窗口频次 × 权重)
   */
  computeBaseScore: function(windowFreq) {
    var wt = BusinessV53Config.BASE_WEIGHTS;
    var scores = {};
    for (var n = 1; n <= 12; n++) {
      scores[n] =
        (windowFreq['36'][n] || 0) * wt.W36 +
        (windowFreq['24'][n] || 0) * wt.W24 +
        (windowFreq['12'][n] || 0) * wt.W12 +
        (windowFreq['7'][n]  || 0) * wt.W7 +
        (windowFreq['3'][n]  || 0) * wt.W3;
    }
    return scores;
  },

  /**
   * 2.2 热度变化率 = (近3期 × 10) - (前3期 × 5)
   */
  computeChangeRate: function(zodiacHistory) {
    var rates = {};
    for (var n = 1; n <= 12; n++) rates[n] = 0;

    var len = zodiacHistory.length;
    if (len < 6) return rates;

    var last3 = zodiacHistory.slice(-3).reduce(function(a, p) { return a.concat(p); }, []);
    var prev3 = zodiacHistory.slice(-6, -3).reduce(function(a, p) { return a.concat(p); }, []);

    for (var n = 1; n <= 12; n++) {
      var c1 = last3.filter(function(x) { return x === n; }).length;
      var c2 = prev3.filter(function(x) { return x === n; }).length;
      rates[n] = c1 * 10 - c2 * 5;
    }
    return rates;
  },

  /**
   * 2.3 遗漏值分（倒U曲线）
   */
  computeMissScore: function(zodiacHistory, num) {
    var miss = BusinessV53Utils.getMissCount(zodiacHistory, num);
    if (miss <= 10)       return miss * 1.3;
    else if (miss <= 16)  return 13;
    else if (miss <= 22)  return 13 - (miss - 16) * 2;
    else                  return 0;
  }
};