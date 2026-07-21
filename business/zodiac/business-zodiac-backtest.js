/**
 * 业务层：生肖通用回测 + 综合未推荐（拆分自 business-zodiac-prediction.js，2026-06-05）
 * @namespace ZodiacPredictionBacktest
 * 包含：
 *   - _runGenericBacktest
 *   - runSizeBacktest / runOddEvenBacktest / runWuxingBacktest / runColorBacktest
 *   - calcUnrecommendedZodiacs
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ZodiacPrediction.xxx() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - 内部使用 `Utils.SpecialCalculator.getSpecial / ZODIAC_ORDER / getZodiacEmoji` 引用门面上的共享数据/工具
 */
const ZodiacPredictionBacktest = {
  _runGenericBacktest: function(historyData, testCount, config) {
    if (!historyData || historyData.length < 10) return null;

    testCount = Math.min(testCount || 12, 12);
    var results = [];
    var maxOffset = Math.min(testCount, historyData.length - 6);

    // 2026-06-21 新增：与实际推荐算法一致模式
    //   - 当 config 提供 trendPredictor + buildSequence 时，启用"模拟当时推荐"路径：
    //     用 targetItem 之前 10 期构造 sequence，调 config.trendPredictor 计算预测值
    //   - 这样回测追踪每期的"预测" = 当时实际推荐算法的预测，确保回测与实际推荐一致
    var useTrendPredictor = !!config.trendPredictor && typeof config.buildSequence === 'function';

    for (var offset = 0; offset < maxOffset; offset++) {
      var targetItem = historyData[offset];
      if (!targetItem) continue;

      var predictedValue = '-';
      var confidence = 45;

      if (useTrendPredictor) {
        // 新增路径：用实际推荐算法（_predictXxxTrend）+ 当时 10 期数据
        var trendSequence = config.buildSequence(historyData, offset);
        if (!trendSequence || trendSequence.length < 5) continue;
        var trendResult = config.trendPredictor(trendSequence);
        predictedValue = trendResult.prediction;
        confidence = trendResult.confidence || 45;
      } else {
        // 原算法路径（完全保留，未做任何修改）
        var recentData = historyData.slice(offset + 1, offset + 7);
        if (recentData.length < 5) continue;

        var lastValues = [];
        for (var i = 0; i < Math.min(5, recentData.length); i++) {
          var val = config.extractValue(recentData[i]);
          if (config.categories.indexOf(val) !== -1) {
            lastValues.push(val);
          } else {
            lastValues.push(config.categories[0]);
          }
        }

        if (lastValues.length >= 3) {
          var scores = {};
          config.categories.forEach(function(cat) { scores[cat] = 0; });

          var last3 = lastValues.slice(0, 3);
          var allSame3 = last3.every(function(v) { return v === last3[0]; });

          if (allSame3) {
            var others = config.categories.filter(function(c) { return c !== last3[0]; });
            others.forEach(function(c) { scores[c] += config.weights.consecutive; });
          } else if (last3[0] !== last3[1] && last3[1] !== last3[2]) {
            scores[last3[0]] += config.weights.alternate;
          }

          var valueCount = {};
          lastValues.forEach(function(v) { valueCount[v] = (valueCount[v] || 0) + 1; });

          Object.keys(valueCount).forEach(function(val) {
            if (valueCount[val] >= 3) {
              var bonus = (valueCount[val] - 2) * 8;
              var otherVals = config.categories.filter(function(c) { return c !== val; });
              otherVals.forEach(function(c) { scores[c] += Math.max(5, bonus); });
            }
          });

          if (lastValues.length >= 4 && lastValues[2] === last3[0]) {
            scores[last3[0]] += config.weights.repeat;
          }

          if (last3[0] === last3[1]) {
            scores[last3[0]] += config.weights.inertia;
          }

          if (config.weights.statistical && config.categories.length === 2) {
            var firstRatio = (valueCount[lastValues[0]] || 0) / lastValues.length;
            if (firstRatio > 0.4 && firstRatio < 0.6) {
              if (firstRatio > 0.5) {
                scores[lastValues[0]] += config.weights.statistical;
              } else {
                var otherCat = config.categories.find(function(c) { return c !== lastValues[0]; });
                if (otherCat) scores[otherCat] += config.weights.statistical;
              }
            }
          }

          var maxScore = -1;
          var bestValue = '-';
          Object.keys(scores).forEach(function(val) {
            if (scores[val] > maxScore) {
              maxScore = scores[val];
              bestValue = val;
            }
          });

          if (maxScore > 0) {
            predictedValue = bestValue;
            confidence = Math.min(config.maxConfidence !== undefined ? config.maxConfidence : 72, (config.baseConfidence !== undefined ? config.baseConfidence : 42) + Math.round((maxScore / 50) * (config.confidenceRange !== undefined ? config.confidenceRange : 28)));
          } else {
            predictedValue = lastValues[0];
            confidence = config.fallbackConfidence !== undefined ? config.fallbackConfidence : 40;
          }
        }
      }

      if (predictedValue === '-') continue;

      var actualValue = config.extractValue(targetItem);
      if (!actualValue) actualValue = config.categories[0];

      var isHit = predictedValue === actualValue;
      var resultItem = {
        expect: targetItem.expect,
        actualNumber: config.getNumber(targetItem),
        confidence: confidence,
        isHit: isHit
      };

      resultItem[config.fieldNames.predicted || 'predictedValue'] = predictedValue;
      resultItem[config.fieldNames.actual || 'actualValue'] = actualValue;

      results.push(resultItem);
    }

    if (!results.length) return null;

    var hitCount = results.filter(function(r) { return r.isHit; }).length;
    var hitRate = Math.round((hitCount / results.length) * 100);

    var recentResults = results.slice(0, 10);
    var recentHitCount = recentResults.filter(function(r) { return r.isHit; }).length;
    var recentHitRate = recentResults.length > 0 ? Math.round((recentHitCount / recentResults.length) * 100) : 0;

    var currentStreak = 0;
    for (var j = 0; j < recentResults.length; j++) {
      if (recentResults[j].isHit) {
        currentStreak++;
      } else {
        break;
      }
    }

    return {
      totalTests: results.length,
      totalHits: hitCount,
      totalHitRate: hitRate,
      recentTests: recentResults.length,
      recentHits: recentHitCount,
      recentHitRate: recentHitRate,
      currentStreak: currentStreak,
      details: recentResults
    };
  },

  runSizeBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['大', '小'],
      extractValue: function(item) {
        var special = Utils.SpecialCalculator.getSpecial(item);
        return special.te >= CONFIG.BIG_RANGE[0] && special.te <= CONFIG.BIG_RANGE[1] ? '大' : '小';
      },
      getNumber: function(item) {
        return Utils.SpecialCalculator.getSpecial(item).te;
      },
      fieldNames: { predicted: 'predictedSize', actual: 'actualSize' },
      weights: {
        consecutive: 20,
        alternate: 0,
        repeat: 15,
        inertia: 12,
        statistical: 0
      },
      maxConfidence: 70,
      baseConfidence: 42,
      confidenceRange: 28,
      fallbackConfidence: 40,
      // 2026-06-21 新增：与实际推荐算法一致（_predictSizeTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictSizeTrend(sequence);
      },
      buildSequence: function(historyData, offset) {
        return historyData.slice(offset + 1, offset + 11).map(function(item) {
          var special = Utils.SpecialCalculator.getSpecial(item);
          var isBig = special.te >= CONFIG.BIG_RANGE[0] && special.te <= CONFIG.BIG_RANGE[1];
          return {
            expect: item.expect,
            number: special.te,
            size: isBig ? '大' : '小'
          };
        });
      }
    });
  },

  runOddEvenBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['单', '双'],
      extractValue: function(item) {
        var special = Utils.SpecialCalculator.getSpecial(item);
        return special.te % 2 !== 0 ? '单' : '双';
      },
      getNumber: function(item) {
        return Utils.SpecialCalculator.getSpecial(item).te;
      },
      fieldNames: { predicted: 'predictedType', actual: 'actualType' },
      weights: {
        consecutive: 35,
        alternate: 25,
        repeat: 15,
        inertia: 10,
        statistical: 12
      },
      maxConfidence: 72,
      baseConfidence: 48,
      confidenceRange: 24,
      fallbackConfidence: 45,
      // 2026-06-21 新增：与实际推荐算法一致（_predictOddEvenTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictOddEvenTrend(sequence);
      },
      buildSequence: function(historyData, offset) {
        return historyData.slice(offset + 1, offset + 11).map(function(item) {
          var special = Utils.SpecialCalculator.getSpecial(item);
          return {
            expect: item.expect,
            number: special.te,
            type: special.te % 2 !== 0 ? '单' : '双'
          };
        });
      }
    });
  },

  runWuxingBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['金', '木', '水', '火', '土'],
      extractValue: function(item) {
        var special = Utils.SpecialCalculator.getSpecial(item);
        return special.wuxing || '金';
      },
      getNumber: function(item) {
        return Utils.SpecialCalculator.getSpecial(item).te;
      },
      fieldNames: { predicted: 'predictedWuxing', actual: 'actualWuxing' },
      weights: {
        consecutive: 20,
        alternate: 0,
        repeat: 15,
        inertia: 12,
        statistical: 0
      },
      maxConfidence: 70,
      baseConfidence: 42,
      confidenceRange: 28,
      fallbackConfidence: 40,
      // 2026-06-21 新增：与实际推荐算法一致（_predictWuxingTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictWuxingTrend(sequence);
      },
      buildSequence: function(historyData, offset) {
        return historyData.slice(offset + 1, offset + 11).map(function(item) {
          var special = Utils.SpecialCalculator.getSpecial(item);
          return {
            expect: item.expect,
            number: special.te,
            wuxing: special.wuxing || '金'
          };
        });
      }
    });
  },

  runColorBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['红', '蓝', '绿'],
      extractValue: function(item) {
        var special = Utils.SpecialCalculator.getSpecial(item);
        var colorName = special.colorName || '红';
        if (!['红', '蓝', '绿'].includes(colorName)) colorName = '红';
        return colorName;
      },
      getNumber: function(item) {
        return Utils.SpecialCalculator.getSpecial(item).te;
      },
      fieldNames: { predicted: 'predictedColor', actual: 'actualColor' },
      weights: {
        consecutive: 20,
        alternate: 0,
        repeat: 15,
        inertia: 12,
        statistical: 0
      },
      maxConfidence: 70,
      baseConfidence: 42,
      confidenceRange: 28,
      fallbackConfidence: 40,
      // 2026-06-21 新增：与实际推荐算法一致（_predictColorTrend）+ 当时 10 期数据
      trendPredictor: function(sequence) {
        return ZodiacPrediction._predictColorTrend(sequence);
      },
      buildSequence: function(historyData, offset) {
        return historyData.slice(offset + 1, offset + 11).map(function(item) {
          var special = Utils.SpecialCalculator.getSpecial(item);
          var colorName = special.colorName || '红';
          if (!['红', '蓝', '绿'].includes(colorName)) colorName = '红';
          return {
            expect: item.expect,
            number: special.te,
            color: colorName
          };
        });
      }
    });
  },

  /**
   * 精选特码 5 维算法号码回测（用于 #zodiacFinalNum 点击弹窗）
   * 算法：对每一期回测目标，模拟"在那一期时"用前 12 期窗口跑 5 维算法
   *       得出 top N 推荐号码，与实际特码对比判定命中。
   * @param {Array} historyData - 历史数据（[0] 最新，[1] 次新，…）
   * @param {number} testCount - 回测期数（默认 20，上限 30）
   * @returns {Object|null} 回测汇总
   */
  runFinalZodiacBacktest: function(historyData, testCount) {
    if (!historyData || historyData.length < 25) return null;
    // 修复 #6：testCount 上限改为 historyData.length - 25（保证窗口 24 期 + 1 期跟随统计），
    //    同时上限不超过 50；UI 展示时直接读取 results.length，避免"显示 36 实际跑 11"
    testCount = Math.min(testCount || 36, 50, historyData.length - 25);
    if (testCount <= 0) return null;
    var results = [];

    // v2.5.0 性能优化：预计算全量 specials（一次 batchGetSpecial，循环内 O(1) 取值）
    var allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    for (var offset = 0; offset < testCount; offset++) {
      var targetItem = historyData[offset];
      if (!targetItem) break;
      // 至少需要：1 期最新 + 12 期窗口 + 1 期跟随统计 = 14 期
      if (historyData.length < offset + 25) break;

      // 1. 模拟"在那一期"可用数据：historyData[offset+1..offset+12] 共 12 期
      var list = historyData.slice(offset + 1, offset + 13);

      // 2. 计算"上期生肖的常跟随生肖"（修复 #1：只能用 targetItem 之前的历史数据，
      //    避免前视偏差/数据穿越。原版 historyData.slice(offset + 2, offset + 14) 包含了
      //    targetItem 之后的未来期开奖结果，导致回测命中率被人为虚高）
      var latestItem = list[0];
      var latestZodiac = '';
      if (latestItem) {
        var zodArr = Utils.parseZodiacArr(latestItem);
        latestZodiac = zodArr[6] || '';
      }
      var followZodiacs = [];
      if (latestZodiac && offset > 0) {
        // 修复 #1：用 offset 之前的历史数据累计"上期 = latestZodiac → 下期 = ?"
        var followCount = {};
        for (var fi = 0; fi < offset; fi++) {
          var preS = allSpecials[fi];
          var curS = allSpecials[fi + 1];
          if (preS.zod === latestZodiac && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curS.zod)) {
            followCount[curS.zod] = (followCount[curS.zod] || 0) + 1;
          }
        }
        followZodiacs = Object.entries(followCount)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, 3)
          .map(function(e) { return e[0]; });
      }
      // 2026-07-14 修复 #10：offset=0 时（最新一期回测，即"现在"对下期的预测），
      //    用全量 followMap 取 top 3，与精选特码 renderZodiacFinalNums 完全一致，
      //    确保弹窗顶部 🔮 下期预测 与未来该期进入回测后的号码一致
      else if (latestZodiac && offset === 0) {
        try {
          var _fullData = Business && Business.calcZodiacAnalysis
            ? Business.calcZodiacAnalysis()
            : null;
          var _fullFollowMap = _fullData && _fullData.followMap;
          var _fullFollow = _fullFollowMap && _fullFollowMap[latestZodiac];
          if (_fullFollow && typeof _fullFollow === 'object') {
            followZodiacs = Object.entries(_fullFollow)
              .sort(function(a, b) { return b[1] - a[1]; })
              .slice(0, 3)
              .map(function(e) { return e[0]; });
          }
        } catch (_e) { /* 计算失败走下面兜底 */ }
      }
      // 修复 #4：followZodiacs 为空时（如数据稀疏或首期回测 followMap 也为空），
      //    使用全部 12 生肖兜底，避免"W_FOLLOW 维度永远 0 分"造成命中率骤降
      if (!followZodiacs.length) {
        followZodiacs = (CONFIG.ANALYSIS.ZODIAC_ALL || []).slice(0, 3);
      }

      // 3. 调用 5 维核心算法得到 top 36 推荐号码（窗口 24 期，2026-07-14 调整）
      var recommend = Business._calcFinalZodiacRecommend(list, 36, followZodiacs, 24);
      var recommendedNums = recommend.numbers || [];
      // 获取候选号码的分数用于排序展示
      var candidateNums = recommend.candidateNums || [];

      // 4. 实际特码对比（按展示集合判定，下面展示什么这里就判什么）
      var actualSpecial = allSpecials[offset];
      var actualNum = actualSpecial.te || 0;

      // 5. 按得分排序推荐号码（得分高的在前）
      var sortedRecommendedNums = recommendedNums.map(function(num) {
        var candidate = candidateNums.find(function(c) { return c.num === num; });
        return { num: num, score: candidate ? candidate.score : 0 };
      }).sort(function(a, b) { return b.score - a.score || a.num - b.num; });

      // 方案 D：展示 36 个推荐号 = 算法选中前 5 名排除 + 剩余 31 个按分排序展示
      //    isHit 基于展示集合判定，所见即所判。
      var displayNums = sortedRecommendedNums.slice(5);     // 后 31 名（未选中推荐）

      var displayNumValues = displayNums.map(function(item2) {
        return typeof item2 === 'object' ? item2.num : item2;
      });
      var isHit = displayNumValues.indexOf(actualNum) !== -1;

      results.push({
        expect: targetItem.expect,
        recommendedNums: displayNums,
        actualNumber: actualNum,
        actualZodiac: actualSpecial.zod || '-',
        isHit: isHit
      });
    }

    if (!results.length) return null;

    var hitCount = results.filter(function(r) { return r.isHit; }).length;
    var hitRate = Math.round((hitCount / results.length) * 100);
    var recentResults = results.slice(0, 36);
    var recentHits = recentResults.filter(function(r) { return r.isHit; }).length;
    var recentHitRate = recentResults.length > 0 ? Math.round((recentHits / recentResults.length) * 100) : 0;
    // 修复 #7：currentStreak 实际为"最近 N 期（含全部回测期）的连续命中次数"，
    //    而不是"某个特定号码的连续出现次数"。results[0] 为最新一期，从最新一期开始累计命中
    var currentStreak = 0;
    for (var i = 0; i < recentResults.length; i++) {
      if (recentResults[i].isHit) currentStreak++;
      else break;
    }

    return {
      totalTests: results.length,
      totalHits: hitCount,
      totalHitRate: hitRate,
      recentTests: recentResults.length,
      recentHits: recentHits,
      recentHitRate: recentHitRate,
      currentStreak: currentStreak,
      // 修复 #7：currentStreak 语义标注——连续命中期数（按时间从最新到最旧累计，首次未中即停）
      currentStreakNote: '从最新一期开始累计的连续命中期数',
      details: recentResults
    };
  },

  /**
   * 综合三个推荐源，计算未被推荐的所有生肖
   * @param {Array} v1List - v1 推荐列表 [{zodiac}, ...]
   * @param {Array} v2List - v2 推荐列表 [{zodiac}, ...]
   * @param {Array} ultimateList - 终极推荐列表 [{zodiac}, ...] (主推+备选)
   * @returns {Object} { v1, v2, ultimate, allRecommended: string[], unrecommended: [{zodiac, emoji}] }
   */
  calcUnrecommendedZodiacs: function(v1List, v2List, ultimateList) {
    var all = ZodiacPrediction.ZODIAC_ORDER;
    var sources = {
      v1: {},
      v2: {},
      ultimate: {}
    };

    // 记录各推荐源已推荐生肖
    function markSource(list, srcKey) {
      if (!list || !list.length) return;
      list.forEach(function(item) {
        var z = typeof item === 'string' ? item : item.zodiac;
        if (z && all.indexOf(z) !== -1) sources[srcKey][z] = true;
      });
    }
    markSource(v1List, 'v1');
    markSource(v2List, 'v2');
    markSource(ultimateList, 'ultimate');

    // 合并去重的所有已推荐生肖
    var allRecommended = [];
    all.forEach(function(z) {
      if (sources.v1[z] || sources.v2[z] || sources.ultimate[z]) {
        allRecommended.push(z);
      }
    });

    // 找未被任一源推荐的生肖
    var unrecommended = [];
    all.forEach(function(z) {
      if (!sources.v1[z] && !sources.v2[z] && !sources.ultimate[z]) {
        unrecommended.push({
          zodiac: z,
          emoji: ZodiacPrediction.getZodiacEmoji(z)
        });
      }
    });

    return {
      v1: Object.keys(sources.v1),
      v2: Object.keys(sources.v2),
      ultimate: Object.keys(sources.ultimate),
      allRecommended: allRecommended,
      unrecommended: unrecommended
    };
  },

  /**
   * 维度命中率诊断工具（2026-07-14 用户需求：为动态权重提供数据基础）
   * 对每个维度独立判定"若该维度的预测命中，则命中"，统计：
   *   1) 各维度单独命中率
   *   2) 多维度交集命中率（AND）
   *   3) 联合推荐集合的命中率（任一维度命中就算）
   * 输出结果到 console，方便人工调整权重。
   *
   * 用法（浏览器 console）：
   *   ZodiacPrediction.analyzeDimensionHitRates(StateManager._state.analysis.historyData, 36)
   *
   * @param {Array} historyData - 历史数据
   * @param {number} testCount - 回测期数（默认 36）
   * @returns {Object} 各维度命中率统计
   */
  analyzeDimensionHitRates: function(historyData, testCount) {
    if (!historyData || historyData.length < 14) return null;
    testCount = Math.min(testCount || 36, historyData.length - 14);
    if (testCount <= 0) return null;

    // v2.5.0 性能优化：预计算全量 specials（一次 batchGetSpecial，循环内 O(1) 取值）
    var allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    // 7 个维度的命中计数
    var dimStats = {
      follow:   { hit: 0, total: 0, note: '跟随生肖（W=3）' },
      head:     { hit: 0, total: 0, note: '头数（W=2）' },
      tail:     { hit: 0, total: 0, note: '尾数（W=2）' },
      color:    { hit: 0, total: 0, note: '波色（W=1.5）' },
      wuxing:   { hit: 0, total: 0, note: '五行（W=1.5）' },
      neighbor: { hit: 0, total: 0, note: '邻号关联（候选新维度）' },
      inertia:  { hit: 0, total: 0, note: '特码惯性（候选新维度）' },
      miss:     { hit: 0, total: 0, note: '冷热加权（候选新维度）' }
    };

    // 各维度在本期的"预测号码集合"
    var dimSets = { follow: [], head: [], tail: [], color: [], wuxing: [], neighbor: [], inertia: [], miss: [] };

    var detailLog = [];  // 逐期明细（用于 console 输出）

    for (var offset = 0; offset < testCount; offset++) {
      var targetItem = historyData[offset];
      if (!targetItem) break;
      if (historyData.length < offset + 14) break;

      var list = historyData.slice(offset + 1, offset + 13);

      // 跟随生肖（复用回测逻辑：offset>0 用累计，offset=0 用全量）
      var latestItem = list[0];
      var latestZodiac = '';
      if (latestItem) {
        var zodArr = Utils.parseZodiacArr(latestItem);
        latestZodiac = zodArr[6] || '';
      }
      var followZodiacs = [];
      if (latestZodiac && offset > 0) {
        var fc = {};
        for (var fi = 0; fi < offset; fi++) {
          var ps = allSpecials[fi];
          var cs = allSpecials[fi + 1];
          if (ps.zod === latestZodiac && CONFIG.ANALYSIS.ZODIAC_ALL.includes(cs.zod)) {
            fc[cs.zod] = (fc[cs.zod] || 0) + 1;
          }
        }
        followZodiacs = Object.entries(fc).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return e[0];});
      } else if (latestZodiac && offset === 0) {
        try {
          var _fd = Business && Business.calcZodiacAnalysis ? Business.calcZodiacAnalysis() : null;
          var _ff = _fd && _fd.followMap && _fd.followMap[latestZodiac];
          if (_ff) followZodiacs = Object.entries(_ff).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return e[0];});
        } catch(_e){}
      }
      if (!followZodiacs.length) followZodiacs = (CONFIG.ANALYSIS.ZODIAC_ALL || []).slice(0, 3);

      // 头/尾/波色/五行 top（复用 _calcFinalZodiacRecommend 的统计逻辑）
      var DIAG_WINDOW = 24;  // 2026-07-14 同步窗口为 24 期，与推荐算法保持一致
      var headCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
      var tailCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
      var colorCount = { '红': 0, '蓝': 0, '绿': 0 };
      var wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
      var missMap = {};  // 号码→遗漏期数
      var lastTe = null;  // 上期特码
      var diagLimit = Math.min(DIAG_WINDOW, list.length);
      for (var di = 0; di < diagLimit; di++) {
        var s = allSpecials[offset + 1 + di];
        if (!s || !s.te || s.te < 1) continue;
        headCount[s.head] = (headCount[s.head] || 0) + 1;
        tailCount[s.tail] = (tailCount[s.tail] || 0) + 1;
        if (['红','蓝','绿'].includes(s.colorName)) colorCount[s.colorName] = (colorCount[s.colorName] || 0) + 1;
        if (['金','木','水','火','土'].includes(s.wuxing)) wuxingCount[s.wuxing] = (wuxingCount[s.wuxing] || 0) + 1;
        // 冷热统计：最近 N 期该号码出现 → miss=0；否则 miss++（简化：先累计出现，结尾统计）
        missMap[s.te] = 0;
      }
      if (latestItem) {
        var _lastSpec = allSpecials[offset + 1];
        if (_lastSpec && _lastSpec.te) lastTe = _lastSpec.te;
      }

      var topHeads = Object.entries(headCount).sort(function(a,b){return b[1]-a[1]}).slice(0,2).map(function(e){return Number(e[0]);});
      var topTails = Object.entries(tailCount).sort(function(a,b){return b[1]-a[1]}).slice(0,3).map(function(e){return Number(e[0]);});
      var topColors = Object.entries(colorCount).sort(function(a,b){return b[1]-a[1]}).slice(0,2).map(function(e){return e[0];});
      var topWuxing = Object.entries(wuxingCount).sort(function(a,b){return b[1]-a[1]}).slice(0,2).map(function(e){return e[0];});

      // 12 期窗口中每个号码的遗漏（未出现期数）
      for (var n = 1; n <= 49; n++) {
        missMap[n] = missMap[n] || 0;
        for (var k = 0; k < list.length; k++) {
          if (list[k].openCode && list[k].openCode.indexOf(',' + n + ',') >= 0) {
            missMap[n] = 0;
          } else if (list[k].openCode && (list[k].openCode.split(',')[0] === String(n))) {
            missMap[n] = 0;
          }
        }
      }

      // 实际特码
      var actualSpecial = allSpecials[offset];
      var actualNum = actualSpecial.te;
      var actualHead = actualSpecial.head;
      var actualTail = actualSpecial.tail;
      var actualColor = actualSpecial.colorName;
      var actualWx = actualSpecial.wuxing;
      var actualZod = actualSpecial.zod;

      // ---- 计算各维度的"预测号码集合" ----
      // 1) FOLLOW：生肖 = followZodiacs 的号码（用 12 期窗口投票的 numZodiacMap）
      var numZodiacMap = {};
      list.forEach(function(item){
        var ca = (item.openCode || '').split(',');
        var za = Utils.parseZodiacArr(item);
        ca.forEach(function(numStr, idx){
          var nv = Number(numStr);
          if (nv && za[idx]) {
            numZodiacMap[nv] = numZodiacMap[nv] || {};
            numZodiacMap[nv][za[idx]] = (numZodiacMap[nv][za[idx]] || 0) + 1;
          }
        });
      });
      var numZodiacFinal = {};
      Object.keys(numZodiacMap).forEach(function(numStr){
        var votes = numZodiacMap[numStr];
        numZodiacFinal[Number(numStr)] = Object.entries(votes).sort(function(a,b){return b[1]-a[1]})[0][0];
      });
      dimSets.follow = Object.keys(numZodiacFinal).filter(function(n){
        return followZodiacs.indexOf(numZodiacFinal[n]) >= 0;
      }).map(Number);

      // 2) HEAD
      dimSets.head = [];
      for (var h = 1; h <= 49; h++) if (topHeads.indexOf(Math.floor(h/10)) >= 0) dimSets.head.push(h);

      // 3) TAIL
      dimSets.tail = [];
      for (var t = 1; t <= 49; t++) if (topTails.indexOf(t % 10) >= 0) dimSets.tail.push(t);

      // 4) COLOR
      dimSets.color = [];
      for (var c1 = 1; c1 <= 49; c1++) if (topColors.indexOf(Utils.getColorName(c1)) >= 0) dimSets.color.push(c1);

      // 5) WUXING
      dimSets.wuxing = [];
      for (var w1 = 1; w1 <= 49; w1++) if (topWuxing.indexOf(Utils.getWuxing(w1)) >= 0) dimSets.wuxing.push(w1);

      // 6) NEIGHBOR：上期 7 个号码的邻号（±1），限制 1-49
      dimSets.neighbor = [];
      if (latestItem) {
        var prevArr = (latestItem.openCode || '').split(',');
        prevArr.forEach(function(numStr){
          var nv = Number(numStr);
          if (nv >= 1 && nv <= 49) {
            if (nv - 1 >= 1) dimSets.neighbor.push(nv - 1);
            if (nv + 1 <= 49) dimSets.neighbor.push(nv + 1);
          }
        });
        dimSets.neighbor = Array.from(new Set(dimSets.neighbor));
      }

      // 7) INERTIA：上期特码本身
      dimSets.inertia = lastTe ? [lastTe] : [];

      // 8) MISS：遗漏 ≥ 8 期的号码（12 期窗口中从没见过）
      dimSets.miss = [];
      for (var m = 1; m <= 49; m++) {
        var missVal = 0;
        for (var mk = 0; mk < list.length; mk++) {
          var codes = (list[mk].openCode || '').split(',').map(Number);
          if (codes.indexOf(m) >= 0) { missVal = 0; break; }
          missVal++;
        }
        if (missVal >= 8) dimSets.miss.push(m);
      }

      // ---- 统计各维度命中 ----
      var keys = Object.keys(dimStats);
      for (var dk = 0; dk < keys.length; dk++) {
        var k = keys[dk];
        dimStats[k].total++;
        if (dimSets[k].indexOf(actualNum) >= 0) dimStats[k].hit++;
      }

      detailLog.push({
        expect: targetItem.expect,
        actualNum: actualNum,
        sizes: {
          follow: dimSets.follow.length,
          head: dimSets.head.length,
          tail: dimSets.tail.length,
          color: dimSets.color.length,
          wuxing: dimSets.wuxing.length,
          neighbor: dimSets.neighbor.length,
          inertia: dimSets.inertia.length,
          miss: dimSets.miss.length
        }
      });
    }

    // 输出 console 报告
    var report = [];
    report.push('\n=== 📊 维度命中率诊断报告（基于最近 ' + testCount + ' 期回测）===');
    var totalK = Object.keys(dimStats);
    for (var i2 = 0; i2 < totalK.length; i2++) {
      var k = totalK[i2];
      var s = dimStats[k];
      var rate = s.total > 0 ? (s.hit / s.total * 100).toFixed(1) : 0;
      var avgSize = 0;
      for (var d = 0; d < detailLog.length; d++) avgSize += detailLog[d].sizes[k] || 0;
      avgSize = detailLog.length > 0 ? (avgSize / detailLog.length).toFixed(1) : 0;
      report.push('  ' + s.note.padEnd(28) + ' 命中=' + String(s.hit).padStart(3) + '/' + String(s.total).padStart(3) + ' = ' + rate + '%   平均集合大小=' + avgSize);
    }
    // 理论随机基线
    report.push('\n  --- 理论基线（纯随机命中 1 个号码）= ' + (100/49).toFixed(1) + '% ---');
    // 各维度相对增益
    report.push('\n  --- 相对增益（命中率 / 随机基线）---');
    var randomBase = 100/49;
    for (var i3 = 0; i3 < totalK.length; i3++) {
      var k3 = totalK[i3];
      var s3 = dimStats[k3];
      var rate3 = s3.total > 0 ? (s3.hit / s3.total * 100) : 0;
      var gain = (rate3 / randomBase).toFixed(2);
      report.push('  ' + s3.note.padEnd(28) + ' 增益=' + gain + 'x');
    }
    console.log(report.join('\n'));
    // 2026-07-14：同时把结果放到页面标题里，方便复制
    try { document.title = '[诊断] ' + report.join(' | ').slice(0, 200); } catch(_e){}

    return { stats: dimStats, details: detailLog };
  }
};

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionBacktest);
}
