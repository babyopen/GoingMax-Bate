/**
 * 业务层 - 通用回测工具（2026-06-24 新增）
 *
 * 职责：将 4 组回测函数（大小 / 单双 / 五行 / 波色）抽取为通用逻辑：
 *   - 通用回测入口（runGeneric）
 *   - 通用 sequence 构造（buildSequence）
 *   - 通用回测汇总（summarizeResults）
 *
 * 拆分记录：
 *   - 2026-06-24 从 business/zodiac/business-zodiac-backtest.js 中
 *     5 个函数（_runGenericBacktest + runSizeBacktest + runOddEvenBacktest +
 *     runWuxingBacktest + runColorBacktest）抽取为 3 个通用方法 + 1 个 helper。
 *   - 保留原 ZodiacPrediction.* 调用方式（通过 Object.assign 兼容挂载，**本文件不挂载**）
 *
 * 设计要点：
 *   - 不操作 DOM（业务层红线 6）
 *   - 不写死 DOM 元素 / CONFIG，所有差异点通过 config 传入
 *   - 支持两种预测路径：
 *     A. trendPredictor + buildSequence：使用业务方的趋势预测器（与实际推荐一致）
 *     B. extractValue + weights：通用打分逻辑（连出 / 交替 / 重复 / 惯性 / 统计）
 *   - 字段命名可配置（fieldNames.predicted / actual）
 *
 * 依赖方向：被 business/zodiac/business-zodiac-backtest.js 调用
 * 跨项目复用：仅需保证 historyData 项结构 + extractValue / getNumber / buildSequence 等回调
 */
const BusinessCommonBacktest = {

  /**
   * 通用 sequence 构造
   * 替代 4 个回测函数中重复的 buildSequence 闭包
   *
   * @param {Array} historyData - 历史数据（[0] 最新）
   * @param {number} offset - 起始偏移
   * @param {Object} options
   * @param {number} [options.windowSize=10] - 窗口大小
   * @param {Function} options.entryBuilder - (item, idx) => sequence entry
   *   通常返回 { expect, number, [fieldName]: value }
   * @returns {Array} sequence
   */
  buildSequence: function(historyData, offset, options) {
    var windowSize = (options && options.windowSize) || 10;
    var entryBuilder = options && options.entryBuilder;
    if (typeof entryBuilder !== 'function') return [];

    return historyData.slice(offset + 1, offset + 1 + windowSize).map(function(item, idx) {
      return entryBuilder(item, idx);
    });
  },

  /**
   * 计算回测汇总数据
   * 通用逻辑：totalHits / totalHitRate / recentHits / recentHitRate / currentStreak
   *
   * @param {Array} results - 单期回测结果数组（每项含 isHit 字段）
   * @param {number} [recentCount=10] - 最近 N 期
   * @returns {Object|null} { totalTests, totalHits, totalHitRate, recentTests, recentHits, recentHitRate, currentStreak, details }
   */
  summarizeResults: function(results, recentCount) {
    if (!results || !results.length) return null;

    var recentN = recentCount || 10;
    var hitCount = results.filter(function(r) { return r.isHit; }).length;
    var hitRate = Math.round((hitCount / results.length) * 100);

    var recentResults = results.slice(0, recentN);
    var recentHitCount = recentResults.filter(function(r) { return r.isHit; }).length;
    var recentHitRate = recentResults.length > 0
      ? Math.round((recentHitCount / recentResults.length) * 100)
      : 0;

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

  /**
   * 通用回测（端到端）
   * 替代原 _runGenericBacktest / runSizeBacktest / runOddEvenBacktest /
   *       runWuxingBacktest / runColorBacktest 5 个函数
   *
   * @param {Array} historyData - 历史数据
   * @param {Object} config
   *
   * ── 必需参数 ──
   * @param {string[]} config.categories - 分类数组
   *   - 大小：['大','小']
   *   - 单双：['单','双']
   *   - 五行：['金','木','水','火','土']
   *   - 波色：['红','蓝','绿']
   * @param {Function} config.extractValue - (special, item) => category
   * @param {Function} config.getNumber - (special, item) => number（实际特码）
   * @param {Object} config.fieldNames - 字段名 { predicted, actual }
   *   - 大小：{ predicted: 'predictedSize', actual: 'actualSize' }
   *   - 单双：{ predicted: 'predictedType', actual: 'actualType' }
   *   - 五行：{ predicted: 'predictedWuxing', actual: 'actualWuxing' }
   *   - 波色：{ predicted: 'predictedColor', actual: 'actualColor' }
   *
   * ── 路径 A（推荐，与实际推荐算法一致）──
   * @param {Function} [config.trendPredictor] - (sequence) => { prediction, confidence }
   * @param {Function} [config.buildSequence] - (historyData, offset) => sequence
   *   两者同时提供时启用路径 A；否则回退到路径 B
   *
   * ── 路径 B（通用打分）──
   * @param {Object} [config.weights] - 权重（仅路径 B 使用）
   *   - consecutive: 连续3期同号加分
   *   - alternate: 交替加分
   *   - repeat: 第 3 期重复加分
   *   - inertia: 最近 2 期同号加分
   *   - statistical: 占比 40-60% 略占优加分（仅二分类生效）
   * @param {number} [config.maxConfidence=70] - 最大可信度
   * @param {number} [config.baseConfidence=42] - 基础可信度
   * @param {number} [config.confidenceRange=28] - 可信度区间
   * @param {number} [config.fallbackConfidence=40] - 无信号时回退可信度
   *
   * ── 公共可选 ──
   * @param {number} [config.testCount=12] - 回测期数（上限 12）
   * @param {number} [config.recentCount=10] - 汇总最近 N 期
   *
   * @returns {Object|null} { totalTests, totalHits, totalHitRate, recentTests, recentHits, recentHitRate, currentStreak, details }
   */
  runGeneric: function(historyData, config) {
    if (!historyData || historyData.length < 10) return null;
    if (!config || !config.categories || !config.extractValue || !config.getNumber) return null;

    var testCount = Math.min(config.testCount || 12, 12);
    var recentCount = config.recentCount || 10;
    var results = [];
    var maxOffset = Math.min(testCount, historyData.length - 6);

    var useTrendPredictor = !!config.trendPredictor &&
                            typeof config.buildSequence === 'function';

    for (var offset = 0; offset < maxOffset; offset++) {
      var targetItem = historyData[offset];
      if (!targetItem) continue;

      var predictedValue = '-';
      var confidence = 45;

      // 路径 A：使用业务方 trendPredictor（与实际推荐算法一致）
      if (useTrendPredictor) {
        var trendSequence = config.buildSequence(historyData, offset);
        if (!trendSequence || trendSequence.length < 5) continue;
        var trendResult = config.trendPredictor(trendSequence);
        predictedValue = trendResult.prediction;
        confidence = trendResult.confidence || 45;
      } else {
        // 路径 B：通用打分（连出 / 交替 / 重复 / 惯性 / 统计）
        if (!config.weights) continue;

        var recentData = historyData.slice(offset + 1, offset + 7);
        if (recentData.length < 5) continue;

        var lastValues = [];
        for (var i = 0; i < Math.min(5, recentData.length); i++) {
          var val = config.extractValue(null, recentData[i]);
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
            confidence = Math.min(
              config.maxConfidence != null ? config.maxConfidence : 70,
              (config.baseConfidence != null ? config.baseConfidence : 42) +
              Math.round((maxScore / 50) * (config.confidenceRange != null ? config.confidenceRange : 28))
            );
          } else {
            predictedValue = lastValues[0];
            confidence = config.fallbackConfidence != null ? config.fallbackConfidence : 40;
          }
        }
      }

      if (predictedValue === '-') continue;

      var actualValue = config.extractValue(null, targetItem);
      if (!actualValue) actualValue = config.categories[0];

      var isHit = predictedValue === actualValue;
      var resultItem = {
        expect: targetItem.expect,
        actualNumber: config.getNumber(null, targetItem),
        confidence: confidence,
        isHit: isHit
      };

      resultItem[config.fieldNames.predicted || 'predictedValue'] = predictedValue;
      resultItem[config.fieldNames.actual || 'actualValue'] = actualValue;

      results.push(resultItem);
    }

    return BusinessCommonBacktest.summarizeResults(results, recentCount);
  }
};
