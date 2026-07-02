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
    if (!historyData || historyData.length < 14) return null;
    // 修复 #6：testCount 上限改为 historyData.length - 14（保证有足够窗口），
    //    同时上限不超过 30；UI 展示时直接读取 results.length，避免"显示 20 实际跑 11"
    testCount = Math.min(testCount || 20, 30, historyData.length - 14);
    if (testCount <= 0) return null;
    var results = [];

    for (var offset = 0; offset < testCount; offset++) {
      var targetItem = historyData[offset];
      if (!targetItem) break;
      // 至少需要：1 期最新 + 12 期窗口 + 1 期跟随统计 = 14 期
      if (historyData.length < offset + 14) break;

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
          var preS = Utils.SpecialCalculator.getSpecial(historyData[fi]);
          var curS = Utils.SpecialCalculator.getSpecial(historyData[fi + 1]);
          if (preS.zod === latestZodiac && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curS.zod)) {
            followCount[curS.zod] = (followCount[curS.zod] || 0) + 1;
          }
        }
        followZodiacs = Object.entries(followCount)
          .sort(function(a, b) { return b[1] - a[1]; })
          .slice(0, 3)
          .map(function(e) { return e[0]; });
      }
      // 修复 #4：followZodiacs 为空时（如数据稀疏或首期回测），使用全部 12 生肖兜底，
      //    避免"W_FOLLOW 维度永远 0 分"造成命中率骤降
      if (!followZodiacs.length) {
        followZodiacs = (CONFIG.ANALYSIS.ZODIAC_ALL || []).slice(0, 3);
      }

      // 3. 调用 5 维核心算法得到 top 30 推荐号码
      var recommend = Business._calcFinalZodiacRecommend(list, 30, followZodiacs);
      var recommendedNums = recommend.numbers || [];
      // 获取候选号码的分数用于排序展示
      var candidateNums = recommend.candidateNums || [];

      // 4. 实际特码对比（按展示集合判定，下面展示什么这里就判什么）
      var actualSpecial = Utils.SpecialCalculator.getSpecial(targetItem);
      var actualNum = actualSpecial.te || 0;

      // 5. 按得分排序推荐号码（得分高的在前）
      var sortedRecommendedNums = recommendedNums.map(function(num) {
        var candidate = candidateNums.find(function(c) { return c.num === num; });
        return { num: num, score: candidate ? candidate.score : 0 };
      }).sort(function(a, b) { return b.score - a.score || a.num - b.num; });

      // 方案 C：展示 30 个推荐号 = 算法排序后后 25 个（未选中推荐）+ 从 1-49 中 24 个
//    非推荐号随机抽 5 个补足。前 5 名（算法选中）不展示但保留在排序结果中。
//    isHit 基于展示集合判定，所见即所判。
      var displayNums = sortedRecommendedNums.slice(5);     // 后 25 名（未选中推荐）

      // 从 1-49 中排除「未选中推荐 25 个」，剩 24 个非推荐号码中随机抽 5 个补足
      var existingSet = new Set(displayNums.map(function(item2) {
        return typeof item2 === 'object' ? item2.num : item2;
      }));
      var allPool = [];
      for (var n = 1; n <= 49; n++) {
        if (!existingSet.has(n)) allPool.push(n);
      }
      // Fisher-Yates 洗牌，取前 5 个
      for (var si = allPool.length - 1; si > 0; si--) {
        var sj = Math.floor(Math.random() * (si + 1));
        var tmp = allPool[si]; allPool[si] = allPool[sj]; allPool[sj] = tmp;
      }
      var randomFill = allPool.slice(0, 5).map(function(num) {
        return { num: num, score: 0, isRandom: true };   // isRandom 标记便于前端区分
      });
      displayNums = displayNums.concat(randomFill);

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
    var recentResults = results.slice(0, 12);
    var recentHits = recentResults.filter(function(r) { return r.isHit; }).length;
    var recentHitRate = recentResults.length > 0 ? Math.round((recentHits / recentResults.length) * 100) : 0;
    // 修复 #7：currentStreak 实际为"最近 12 期（含全部回测期）的连续命中次数"，
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
  }
};

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionBacktest);
}
