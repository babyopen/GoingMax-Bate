/**
 * V5.3 最终热度分计算引擎
 * 对应文档第二章完整公式 + 第三章五区制 + 第五章冷号缩权
 *
 * 最终分 = (基础分 + 变化率 + 遗漏分 + 挂靠分 + 马尔可夫分 + 物理分)
 *         × 连出修正 × 风控系数 × 冷号缩权
 */
const BusinessV53Scoring = {
  /**
   * 2.6 物理特征加分（上限5分）
   */
  computePhysicalScores: function(zodiacHistory) {
    var scores = {};
    for (var i = 1; i <= 12; i++) scores[i] = 0;

    var recent20 = zodiacHistory.slice(-20);
    if (recent20.length < 10) return scores;

    // 奇偶比例
    var allNums = [];
    recent20.forEach(function(p) { allNums = allNums.concat(p); });
    var oddCount = allNums.filter(function(x) { return x % 2 === 1; }).length;
    var oddRatio = oddCount / allNums.length;
    var predictEven = oddRatio > 0.6; // 奇数>60% 预测偶数

    // 和值预测（四舍五入取整）
    var sumList = recent20.map(function(p) { return p.reduce(function(a,b){return a+b;}, 0); });
    var avgSum = sumList.reduce(function(a,b){return a+b;}, 0) / sumList.length;
    var roundedAvg = Math.round(avgSum);

    for (var n = 1; n <= 12; n++) {
      var s = 0;
      // 奇偶 ±3分
      var isOdd = n % 2 === 1;
      if ((predictEven && !isOdd) || (!predictEven && isOdd)) s += 3;
      // 和值 ±2分
      if (n >= roundedAvg - 2 && n <= roundedAvg + 2) s += 2;
      scores[n] = Math.min(s, 5);
    }
    return scores;
  },

  /**
   * 2.7 连出修正系数
   */
  getConsecutiveFactor: function(zodiacHistory, num) {
    var consecutive = 0;
    for (var i = zodiacHistory.length - 1; i >= 0; i--) {
      if (zodiacHistory[i].indexOf(num) !== -1) consecutive++;
      else break;
    }
    var f = BusinessV53Config.CONSECUTIVE_FACTOR;
    return consecutive >= 3 ? f[3] : (f[consecutive] || 1.0);
  },

  /**
   * 2.8 + 第三章 自适应风控系数（直接查表 + 解权）
   */
  computeRiskCoefficient: function(freq12, trend, freq11) {
    var table = BusinessV53Config.ZONE_RISK_TABLE[trend];
    if (!table) return 1.0;

    // 确定分区
    var zone;
    if (freq12 >= 4) zone = 'peak';
    else if (freq12 >= 3) zone = 'down';
    else if (freq12 >= 2) zone = 'rotate';
    else if (freq12 >= 1) zone = 'wait';
    else zone = 'silent';

    var coeff = table[zone] || 1.0;

    // 解权：近11期≤2次 → 自动恢复1.0
    if (freq11 !== undefined && freq11 <= BusinessV53Config.RISK_RELEASE_FREQ11 && freq12 >= 3) {
      coeff = 1.0;
    }

    return coeff;
  },

  /**
   * 5.1 冷号缩权检查
   * 固定冷号 + 非冷→热观察 + 近2期出现 → ×0.1
   */
  getColdWeight: function(num, dynamicStates, zodiacHistory) {
    var coldPool = BusinessV53Config.FIXED_POOLS.COLD;
    var S = BusinessV53Config.STATUS;
    if (coldPool.indexOf(num) === -1) return 1.0;

    var state = dynamicStates[num];
    var isObservingHot = state && (
      state.status === S.COLD_TO_HOT_HARD_OBSERVE ||
      state.status === S.COLD_TO_HOT_SOFT_OBSERVE
    );
    if (isObservingHot) return 1.0;

    var recent2 = BusinessV53Utils.getRecentCount(zodiacHistory, num, 2);
    return recent2 > 0 ? BusinessV53Config.COLD_WEIGHT.FACTOR : 1.0;
  },

  /**
   * 主函数：计算所有号码的最终热度分
   */
  computeFinalScores: function(params) {
    var windowFreq = params.windowFreq;
    var changeRates = params.changeRates || {};
    var markovBonus = params.markovBonus || {};
    var physicalScores = params.physicalScores || {};
    var associationBonus = params.associationBonus || {};
    var dynamicStates = params.dynamicStates || {};
    var trend = params.trend || 'oscillation';
    var zodiacHistory = params.zodiacHistory;
    var freq11 = params.freq11 || {};

    // 基础热度分（2.1）
    var baseScores = BusinessV53Windows.computeBaseScore(windowFreq);

    var finalScores = {};
    for (var n = 1; n <= 12; n++) {
      var additive =
        (baseScores[n] || 0) +
        (changeRates[n] || 0) +
        BusinessV53Windows.computeMissScore(zodiacHistory, n) +
        (associationBonus[n] || 0) +
        (markovBonus[n] || 0) +
        (physicalScores[n] || 0);

      var consecutiveFactor = this.getConsecutiveFactor(zodiacHistory, n);
      var riskCoeff = this.computeRiskCoefficient(
        windowFreq['12'][n] || 0,
        trend,
        freq11[n] || 0
      );
      var coldWeight = this.getColdWeight(n, dynamicStates, zodiacHistory);

      finalScores[n] = Math.max(0, additive * consecutiveFactor * riskCoeff * coldWeight);
    }
    return finalScores;
  },

  /**
   * 按热度分降序排序
   */
  sortByScore: function(scores) {
    var arr = [];
    for (var n = 1; n <= 12; n++) {
      arr.push({ number: n, score: scores[n] || 0 });
    }
    arr.sort(function(a, b) { return b.score - a.score; });
    return arr;
  }
};