const BusinessUltimate = {

  CYCLE_CONFIG: {
    V1: {
      name: 'V1冷号周期',
      mainPool: [2, 3, 6, 8, 11, 12],
      coldPool: [1, 4, 5, 7, 9, 10],
      transitionPool: [1, 4],
      cycleChain: [2, 6, 12, 8, 3, 11],
      maxMiss: 6,
      averageHitRate: '82%-83%'
    },
    V2: {
      name: 'V2热号周期',
      mainPool: [1, 4, 5, 7, 9, 10],
      coldPool: [2, 3, 6, 8, 11, 12],
      transitionPool: [3, 6],
      cycleChain: [1, 5, 7, 9, 4, 10],
      maxMiss: 5,
      averageHitRate: '86%-87%'
    }
  },

  CYCLE_STAGES: {
    V1_STABLE: 'V1稳定运行期',
    V2_STABLE: 'V2稳定运行期',
    TRANSITION: '过渡混沌期',
    INSUFFICIENT_DATA: '数据不足无法判断'
  },

  RISK_LEVELS: {
    LOW: '低风险',
    MEDIUM: '中风险',
    HIGH: '极高风险',
    UNKNOWN: '未知风险'
  },

  NUM_TO_ZODIAC: {
    1: '马', 2: '蛇', 3: '龙', 4: '兔', 5: '虎', 6: '牛',
    7: '鼠', 8: '猪', 9: '狗', 10: '鸡', 11: '猴', 12: '羊'
  },

  ZODIAC_TO_NUM: {},

  init: function() {
    var self = this;
    Object.keys(this.NUM_TO_ZODIAC).forEach(function(num) {
      self.ZODIAC_TO_NUM[self.NUM_TO_ZODIAC[num]] = Number(num);
    });
  },

  _getZodiacByNum: function(num) {
    return this.NUM_TO_ZODIAC[num] || '';
  },

  _getNumByZodiac: function(zodiac) {
    return this.ZODIAC_TO_NUM[zodiac] || 0;
  },

  countFrequency: function(history, n) {
    var freq = {};
    for (var i = 1; i <= 12; i++) freq[i] = 0;
    var recent = history.slice(-n);
    recent.forEach(function(item) {
      if (item.number >= 1 && item.number <= 12) {
        freq[item.number]++;
      }
    });
    return freq;
  },

  getNextInCycle: function(current, cycleChain) {
    var index = cycleChain.indexOf(current);
    return index === -1 ? null : cycleChain[(index + 1) % cycleChain.length];
  },

  checkConsecutive: function(history, pool, n) {
    if (history.length < n) return false;
    var recent = history.slice(-n);
    return recent.every(function(item) { return pool.indexOf(item.number) !== -1; });
  },

  getRecentMainNumbers: function(history, mainPool, n) {
    n = n || 3;
    return history
      .slice(-n)
      .map(function(item) { return item.number; })
      .filter(function(num) { return mainPool.indexOf(num) !== -1; })
      .reverse();
  },

  WINDOW_SIZE: 12,
  AUX_WINDOW_SIZE: 24,
  DOWN_WEIGHT_LIMIT: 3,
  COOLING_PERIOD: 2,

  getCurrent12Freq: function(history) {
    return this.countFrequency(history, this.WINDOW_SIZE);
  },

  getCurrent24Freq: function(history) {
    return this.countFrequency(history, this.AUX_WINDOW_SIZE);
  },

  getNext12Freq: function(history) {
    if (history.length <= this.WINDOW_SIZE) {
      return this.getCurrent12Freq(history);
    }
    var newHistory = history.slice(1);
    return this.countFrequency(newHistory, this.WINDOW_SIZE);
  },

  getNumberPositions: function(history, num, windowSize) {
    var positions = [];
    var recent = history.slice(-windowSize);
    for (var i = 0; i < recent.length; i++) {
      if (recent[i].number === num) {
        positions.push(recent.length - 1 - i);
      }
    }
    return positions;
  },

  getCoolingInfo: function() {
    return Storage.get('ultimateCooling', {});
  },

  saveCoolingInfo: function(coolingInfo) {
    Storage.set('ultimateCooling', coolingInfo);
  },

  updateCoolingInfo: function(history, blackList) {
    var cooling = this.getCoolingInfo();
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    var i, num, positions, count;
    for (num = 1; num <= 12; num++) {
      positions = this.getNumberPositions(history, num, this.WINDOW_SIZE);
      count = positions.length;

      if (count >= 3) {
        if (!cooling[num]) cooling[num] = { count: 0, coolingCount: 0 };
        cooling[num].count = count;
        cooling[num].lastSeen = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].issue : 0;
        if (blackList.indexOf(num) !== -1) {
          cooling[num].coolingCount = 0;
        }
      } else {
        if (cooling[num]) {
          cooling[num].coolingCount = (cooling[num].coolingCount || 0) + 1;
        }
      }
    }

    this.saveCoolingInfo(cooling);
    return cooling;
  },

  getDownWeightBlackList: function(history) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });
    var currFreq12 = this.getCurrent12Freq(history);
    var nextFreq12 = this.getNext12Freq(history);
    var currFreq24 = this.getCurrent24Freq(history);
    var cooling = this.getCoolingInfo();
    var blackList = [];

    for (var num = 1; num <= 12; num++) {
      var curr12 = currFreq12[num] || 0;
      var next12 = nextFreq12[num] || 0;
      var curr24 = currFreq24[num] || 0;

      if (curr12 >= this.DOWN_WEIGHT_LIMIT) {
        if (next12 >= 3) {
          blackList.push(num);
        } else if (next12 === 2) {
          // 临界预判：即将从3降到2，提前解权（不需要等冷却）
          blackList.push(num);
        } else {
          blackList.push(num);
        }
      }
    }

    this.updateCoolingInfo(history, blackList);

    return blackList;
  },

  filterByWeight: function(history, candidateNums, config) {
    var blackList = this.getDownWeightBlackList(history);
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    var main = [];
    var backup = [];
    var i, num;

    for (i = 0; i < candidateNums.length; i++) {
      num = candidateNums[i];
      if (blackList.indexOf(num) === -1) {
        main.push(num);
      }
    }

    if (main.length < 4) {
      var chain = config.cycleChain;
      for (i = 0; i < chain.length && main.length < 4; i++) {
        num = chain[i];
        if (main.indexOf(num) === -1 && blackList.indexOf(num) === -1) {
          main.push(num);
        }
      }
    }

    return {
      main: main.slice(0, 4),
      backup: backup,
      downWeight: blackList
    };
  },

  detectCycleStage: function(history) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    if (sortedHistory.length < 20) {
      return {
        stage: this.CYCLE_STAGES.INSUFFICIENT_DATA,
        signals: [],
        advice: '历史数据仅有' + sortedHistory.length + '期，需要至少20期才能准确判断周期',
        requiredData: 20 - sortedHistory.length
      };
    }

    var freq20 = this.countFrequency(sortedHistory, 20);
    var v1Config = this.CYCLE_CONFIG.V1;
    var v2Config = this.CYCLE_CONFIG.V2;

    var v1Count = 0;
    var v2Count = 0;
    v1Config.mainPool.forEach(function(num) { v1Count += freq20[num]; });
    v2Config.mainPool.forEach(function(num) { v2Count += freq20[num]; });

    var cons3V1 = this.checkConsecutive(sortedHistory, v1Config.mainPool, 3);
    var cons3V2 = this.checkConsecutive(sortedHistory, v2Config.mainPool, 3);
    var cons2V1 = this.checkConsecutive(sortedHistory, v1Config.mainPool, 2);
    var cons2V2 = this.checkConsecutive(sortedHistory, v2Config.mainPool, 2);

    var recent4 = sortedHistory.slice(-4).map(function(item) { return item.number; });
    var chainValidV1 = 0;
    var chainValidV2 = 0;
    for (var i = 0; i < recent4.length - 1; i++) {
      if (v1Config.mainPool.indexOf(recent4[i]) !== -1 && this.getNextInCycle(recent4[i], v1Config.cycleChain) === recent4[i + 1]) {
        chainValidV1++;
      }
      if (v2Config.mainPool.indexOf(recent4[i]) !== -1 && this.getNextInCycle(recent4[i], v2Config.cycleChain) === recent4[i + 1]) {
        chainValidV2++;
      }
    }

    var dominantCycle = null;

    if (v2Count >= v1Count + 1) {
      if (cons3V2 || cons2V2 || chainValidV2 >= 1) dominantCycle = v2Config;
    }
    if (v1Count >= v2Count + 1) {
      if (cons3V1 || cons2V1 || chainValidV1 >= 1) dominantCycle = v1Config;
    }

    if (Math.abs(v1Count - v2Count) <= 1) {
      if (cons3V2 || (cons2V2 && chainValidV2 >= 1)) dominantCycle = v2Config;
      else if (cons3V1 || (cons2V1 && chainValidV1 >= 1)) dominantCycle = v1Config;
    }

    if (!dominantCycle) {
      return {
        stage: this.CYCLE_STAGES.TRANSITION,
        dominantCycle: '双池并行',
        transitionSignals: ['近20期出号持平+近期无连续同池+循环链断裂，真实混沌期'],
        v1MainCount: v1Count,
        v2MainCount: v2Count
      };
    }

    var otherCycle = dominantCycle === v1Config ? v2Config : v1Config;

    var newCycleSignals = [];
    if (this.checkConsecutive(sortedHistory, otherCycle.mainPool, 3)) {
      newCycleSignals.push('连续3期开出新周期号码');
    }
    if (this.checkConsecutive(sortedHistory, dominantCycle.coldPool, 3)) {
      newCycleSignals.push('原周期连续3期空号');
    }

    if (newCycleSignals.length >= 1) {
      return {
        stage: otherCycle === v1Config ? this.CYCLE_STAGES.V1_STABLE : this.CYCLE_STAGES.V2_STABLE,
        dominantCycle: otherCycle.name,
        v1MainCount: v1Count,
        v2MainCount: v2Count
      };
    }

    return {
      stage: dominantCycle === v1Config ? this.CYCLE_STAGES.V1_STABLE : this.CYCLE_STAGES.V2_STABLE,
      dominantCycle: dominantCycle.name,
      v1MainCount: v1Count,
      v2MainCount: v2Count,
      chainStatus: chainValidV1 > chainValidV2 ? 'V1循环链正常' : 'V2循环链正常'
    };
  },

  checkReHeatAndRelock: function(history) {
    var currFreq = this.getCurrent12Freq(history);
    var cooling = this.getCoolingInfo();
    var updated = false;
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    for (var num = 1; num <= 12; num++) {
      if (cooling[num]) {
        var currentCount = currFreq[num] || 0;
        if (currentCount >= 3 && !cooling[num].reLocked) {
          cooling[num].reLocked = true;
          cooling[num].reLockIssue = sortedHistory.length > 0 ? sortedHistory[sortedHistory.length - 1].issue : 0;
          updated = true;
        }
      }
    }

    if (updated) {
      this.saveCoolingInfo(cooling);
    }
    return cooling;
  },

  generateStableNumbers: function(history, config) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    var cycleChain = config.cycleChain;

    var recentV2Numbers = this.getRecentMainNumbers(sortedHistory, config.mainPool, 3);

    var chainIndex = -1;
    var startNum = null;
    if (recentV2Numbers.length > 0) {
      startNum = recentV2Numbers[0];
      chainIndex = cycleChain.indexOf(startNum);
    }

    if (chainIndex === -1) {
      startNum = cycleChain[0];
      chainIndex = 0;
    }

    var candidate = [];
    for (var i = 0; i < 6; i++) {
      var idx = (chainIndex + i) % cycleChain.length;
      candidate.push(cycleChain[idx]);
    }

    var filterRes = this.filterByWeight(sortedHistory, candidate, config);
    var result = filterRes.main;
    var backup = filterRes.backup;

    return {
      mainNumbers: result,
      alternativeNumbers: backup,
      hotNumbers: [startNum],
      warmNumbers: result.slice(1),
      configUsed: config.name,
      downWeightList: filterRes.downWeight
    };
  },

  generateTransitionNumbers: function(history) {
    var sortedHistory = history.slice().sort(function(a, b) { return a.issue - b.issue; });

    var oldPoolNumbers = this.getRecentMainNumbers(sortedHistory, this.CYCLE_CONFIG.V1.mainPool, 3);
    var newPoolNumbers = this.getRecentMainNumbers(sortedHistory, this.CYCLE_CONFIG.V2.mainPool, 3);

    var oldHot = oldPoolNumbers[0] || this.CYCLE_CONFIG.V1.mainPool[0];
    var newHot = newPoolNumbers[0] || this.CYCLE_CONFIG.V2.mainPool[0];

    var candidate = [oldHot, newHot];
    var filterRes = this.filterByWeight(sortedHistory, candidate, this.CYCLE_CONFIG.V2);

    var validNums = filterRes.main.filter(function(n) { return candidate.indexOf(n) !== -1; });

    if (validNums.length === 0) {
      return {
        transitionNumbers: [],
        note: '过渡期仅推荐非降权2码',
        downWeightList: filterRes.downWeight
      };
    }

    return {
      transitionNumbers: validNums.sort(function(a, b) { return a - b; }),
      oldPoolHot: oldHot,
      newPoolHot: newHot,
      note: '过渡期仅推荐非降权2码',
      downWeightList: filterRes.downWeight
    };
  },

  generateOperationAdvice: function(stage) {
    switch (stage) {
      case this.CYCLE_STAGES.V1_STABLE:
      case this.CYCLE_STAGES.V2_STABLE:
        var maxMiss = stage === this.CYCLE_STAGES.V1_STABLE ? '6' : '5';
        return {
          riskLevel: this.RISK_LEVELS.LOW,
          mustDo: [
            '使用对应周期的稳定期算法生成主推4码',
            '按"2个热号+2个顺位号"的规则投注',
            '过渡区号码作为备选'
          ],
          forbidden: [
            '不要重仓冷门区号码',
            '不要追超过' + maxMiss + '期的深冷号'
          ]
        };

      case this.CYCLE_STAGES.TRANSITION:
        return {
          riskLevel: this.RISK_LEVELS.HIGH,
          mustDo: [
            '优先空仓观望，仅小资金试水',
            '只买过渡期2码，不投4码',
            '投注金额降至平时的20%以下',
            '最多连追3期，不中立即停手'
          ],
          forbidden: [
            '绝对不要使用稳定期算法',
            '不要追任何顺位号',
            '不要买超过2个号码',
            '禁止重仓操作'
          ]
        };

      case this.CYCLE_STAGES.INSUFFICIENT_DATA:
      default:
        return {
          riskLevel: this.RISK_LEVELS.UNKNOWN,
          mustDo: ['补充至少20期历史数据后再进行分析'],
          forbidden: ['不要盲目投注，数据不足时任何推荐都不可靠']
        };
    }
  },

  generateFullReport: function(history) {
    var cycleStatus = this.detectCycleStage(history);
    var advice = this.generateOperationAdvice(cycleStatus.stage);

    this.checkReHeatAndRelock(history);

    var numbersResult = null;

    if (cycleStatus.stage !== this.CYCLE_STAGES.INSUFFICIENT_DATA) {
      if (cycleStatus.stage === this.CYCLE_STAGES.V1_STABLE) {
        numbersResult = this.generateStableNumbers(history, this.CYCLE_CONFIG.V1);
      } else if (cycleStatus.stage === this.CYCLE_STAGES.V2_STABLE) {
        numbersResult = this.generateStableNumbers(history, this.CYCLE_CONFIG.V2);
      } else if (cycleStatus.stage === this.CYCLE_STAGES.TRANSITION) {
        numbersResult = this.generateTransitionNumbers(history);
      }
    }

    return {
      generatedAt: new Date().toISOString(),
      currentStage: cycleStatus.stage,
      riskLevel: advice.riskLevel,
      cycleStatus: cycleStatus,
      numbers: numbersResult,
      advice: advice,
      quickNote: '十二号码分两池，八十周期轮流转。两热两顺推四码，过渡一旧加一新。'
    };
  },

  historyDataToUltimateFormat: function(historyData) {
    var result = [];
    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
      var zodArr = zodArrRaw.map(function(z) {
        return CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z;
      });
      var zod = zodArr[6] || '';
      var num = this.ZODIAC_TO_NUM[zod];
      if (num) {
        result.push({
          issue: Number(item.expect || 0),
          number: num
        });
      }
    }
    result.sort(function(a, b) { return a.issue - b.issue; });
    return result;
  },

  formatNumbersToDisplay: function(numbers) {
    return numbers.map(function(num) {
      return { num: num, zodiac: BusinessUltimate._getZodiacByNum(num) };
    });
  },

  BACKTEST_KEY: 'ultimateBacktest',
  RECOMMEND_HISTORY_KEY: 'ultimateRecommendHistory',

  getRecommendHistory: function() {
    return Storage.get(this.RECOMMEND_HISTORY_KEY, []);
  },

  saveRecommendHistory: function(issue, numbers) {
    var history = this.getRecommendHistory();
    history.unshift({ issue: issue, numbers: numbers, timestamp: Date.now() });
    if (history.length > 50) history = history.slice(0, 50);
    Storage.set(this.RECOMMEND_HISTORY_KEY, history);
  },

  isNumberDowngraded: function(num, windowSize) {
    windowSize = windowSize || 12;
    var history = this.getRecommendHistory();
    var recentHistory = history.slice(0, windowSize);
    var count = 0;
    for (var i = 0; i < recentHistory.length; i++) {
      if (recentHistory[i].numbers.indexOf(num) !== -1) {
        count++;
        if (count >= 3) return true;
      }
    }
    return false;
  },

  runBacktest: function(historyData) {
    if (!historyData || historyData.length < 25) return null;

    var records = [];
    var maxBacktest = Math.min(40, historyData.length - 20);
    var self = this;

    for (var i = 0; i < maxBacktest; i++) {
      var futureHistory = historyData.slice(0, historyData.length - i);
      if (futureHistory.length < 20) break;

      var report = this.generateFullReport(futureHistory);

      if (!report || !report.numbers) continue;

      var targetItem = historyData[historyData.length - i - 1];
      if (!targetItem) continue;

      var predictedNums = report.numbers.mainNumbers || report.numbers.transitionNumbers || [];
      var actualNum = targetItem.number;

      var hitRank = 0;
      for (var j = 0; j < predictedNums.length; j++) {
        if (predictedNums[j] === actualNum) {
          hitRank = j + 1;
          break;
        }
      }

      records.push({
        expect: targetItem.issue,
        topN: predictedNums.map(function(n) { return self._getZodiacByNum(n); }),
        actualZodiac: this._getZodiacByNum(actualNum),
        hit: hitRank > 0,
        hitRank: hitRank,
        stage: report.currentStage
      });

      if (targetItem.issue >= 2026130) {
        console.log('[回测分析] ' + targetItem.issue + '期: 预测=' + predictedNums.map(function(n) { return self._getZodiacByNum(n); }).join(',') + ', 实际=' + this._getZodiacByNum(actualNum) + ', stage=' + report.currentStage);
      }
    }

    if (!records.length) return null;

    var hits = 0;
    var top1Hits = 0;
    var top2Hits = 0;
    var top3Hits = 0;
    records.forEach(function(r) {
      if (r.hit) {
        hits++;
        if (r.hitRank === 1) top1Hits++;
        if (r.hitRank <= 2) top2Hits++;
        if (r.hitRank <= 3) top3Hits++;
      }
    });

    var summary = {
      total: records.length,
      hits: hits,
      hitRate: Math.round((hits / records.length) * 100),
      top1Hits: top1Hits,
      top2Hits: top2Hits,
      top3Hits: top3Hits,
      records: records
    };

    Storage.set(this.BACKTEST_KEY, summary);
    return summary;
  },

  getBacktestSummary: function() {
    return Storage.get(this.BACKTEST_KEY, null);
  }
};

BusinessUltimate.init();
