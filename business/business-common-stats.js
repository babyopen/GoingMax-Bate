/**
 * 业务层 - 通用统计工具（2026-06-24 新增）
 *
 * 职责：将 4 组统计函数（大小 / 单双 / 五行 / 波色）抽取为通用逻辑：
 *   - 通用二分类统计（大小 / 单双）
 *   - 通用多分类统计（五行 / 波色）
 *   - 通用规律分析（连出 / 交替 / 热点）
 *   - 通用趋势预测（二分类 / 多分类）
 *
 * 拆分记录：
 *   - 2026-06-24 从 business/zodiac/business-zodiac-stats.js 中
 *     12 个重复函数（4 组统计 + 4 组规律分析 + 4 组趋势预测）抽取为 6 个通用函数。
 *   - 保留原 ZodiacPrediction.* 调用方式（通过 Object.assign 兼容挂载，**本文件不挂载**）
 *
 * 设计要点：
 *   - 只依赖 Utils.SpecialCalculator.getSpecial（core/utils.js 中已实现，跨项目可替换）
 *   - 不操作 DOM（业务层红线 6）
 *   - 不写死 CONFIG / DOM 元素，所有分类标签 / 字段名 / 类别数组由 config 传入
 *   - 字段命名可配置（fieldName），序列中按指定字段名写入
 *
 * 依赖方向：被 business/zodiac/business-zodiac-stats.js 调用
 * 跨项目复用：仅需保留 Utils.SpecialCalculator.getSpecial(item) → { te, colorName, wuxing, ... }
 */
const BusinessCommonStats = {

  // ============================================================
  // 1) 规律分析：二分类（大小 / 单双 通用）
  // ============================================================

  /**
   * 二分类规律分析：连出 + 交替频繁
   * 替代原 _analyzeSizePatterns / _analyzeOddEvenPatterns
   *
   * @param {Array} sequence - 序列数组，每项含 fieldName 字段（如 { size: '大' }）
   * @param {string} fieldName - 序列字段名（'size' / 'type'）
   * @param {Object} [opts] - 可选
   * @param {string} [opts.altName] - 交替描述中的分类中文名（如 '大小' / '单双'），默认由 fieldName 推断
   * @returns {Array} patterns
   */
  analyzeBinaryPatterns: function(sequence, fieldName, opts) {
    if (!sequence || sequence.length < 2) return [];

    var altName = (opts && opts.altName) ||
                  (fieldName === 'size' ? '大小' : fieldName === 'type' ? '单双' : '分类');

    var patterns = [];
    var currentStreak = 1;
    var streakType = sequence[0][fieldName];

    for (var i = 1; i < sequence.length; i++) {
      if (sequence[i][fieldName] === streakType) {
        currentStreak++;
      } else {
        if (currentStreak >= 2) {
          patterns.push({
            type: streakType + '连',
            count: currentStreak,
            startIdx: i - currentStreak,
            endIdx: i - 1
          });
        }
        streakType = sequence[i][fieldName];
        currentStreak = 1;
      }
    }

    if (currentStreak >= 2) {
      patterns.push({
        type: streakType + '连',
        count: currentStreak,
        startIdx: sequence.length - currentStreak,
        endIdx: sequence.length - 1
      });
    }

    var alternations = 0;
    for (var j = 1; j < sequence.length - 1; j++) {
      if (sequence[j][fieldName] !== sequence[j - 1][fieldName] &&
          sequence[j][fieldName] !== sequence[j + 1][fieldName]) {
        alternations++;
      }
    }
    if (alternations >= 3) {
      patterns.push({
        type: '交替频繁',
        count: alternations,
        description: '近期' + altName + '交替出现较频繁'
      });
    }

    return patterns;
  },

  // ============================================================
  // 2) 规律分析：多分类（五行 / 波色 通用）
  // ============================================================

  /**
   * 多分类规律分析：连出 + 热点
   * 替代原 _analyzeWuxingPatterns / _analyzeColorPatterns
   *
   * @param {Array} sequence - 序列数组
   * @param {string} fieldName - 'wuxing' / 'color'
   * @param {Object} [opts]
   * @param {number} [opts.hotThreshold=3] - 热点阈值
   * @returns {Array} patterns
   */
  analyzeMultiPatterns: function(sequence, fieldName, opts) {
    if (!sequence || sequence.length < 2) return [];

    var hotThreshold = (opts && opts.hotThreshold) || 3;

    var patterns = [];
    var currentStreak = 1;
    var streakType = sequence[0][fieldName];

    for (var i = 1; i < sequence.length; i++) {
      if (sequence[i][fieldName] === streakType) {
        currentStreak++;
      } else {
        if (currentStreak >= 2) {
          patterns.push({
            type: streakType + '连',
            count: currentStreak,
            startIdx: i - currentStreak,
            endIdx: i - 1
          });
        }
        streakType = sequence[i][fieldName];
        currentStreak = 1;
      }
    }

    if (currentStreak >= 2) {
      patterns.push({
        type: streakType + '连',
        count: currentStreak,
        startIdx: sequence.length - currentStreak,
        endIdx: sequence.length - 1
      });
    }

    var hot = {};
    sequence.forEach(function(item) {
      hot[item[fieldName]] = (hot[item[fieldName]] || 0) + 1;
    });

    var sortedKeys = Object.keys(hot).sort(function(a, b) {
      return hot[b] - hot[a];
    });

    if (sortedKeys.length > 0 && hot[sortedKeys[0]] >= hotThreshold) {
      patterns.push({
        type: sortedKeys[0] + '热',
        count: hot[sortedKeys[0]],
        description: sortedKeys[0] + '近期出现' + hot[sortedKeys[0]] + '次'
      });
    }

    return patterns;
  },

  // ============================================================
  // 3) 趋势预测：二分类（大小 / 单双 通用）
  // ============================================================

  /**
   * 二分类趋势预测
   * 替代原 _predictSizeTrend / _predictOddEvenTrend
   *
   * @param {Array} sequence - 序列
   * @param {Object} config
   * @param {string} config.fieldName - 'size' / 'type'
   * @param {string} config.labelA - 类别 A 标签（如 '大' / '单'）
   * @param {string} config.labelB - 类别 B 标签（如 '小' / '双'）
   * @param {string} [config.nameA] - 类别 A 中文名（用于文案，默认 = labelA）
   * @param {string} [config.nameB] - 类别 B 中文名（默认 = labelB）
   * @param {number} [config.maxConfidence=75] - 最大可信度
   * @param {number} [config.baseConfidence=45] - 基础可信度
   * @returns {{prediction: string, confidence: number, reason: string}}
   */
  predictBinaryTrend: function(sequence, config) {
    var fieldName = config.fieldName;
    var labelA = config.labelA;
    var labelB = config.labelB;
    var nameA = config.nameA || labelA;
    var nameB = config.nameB || labelB;
    var maxConf = config.maxConfidence != null ? config.maxConfidence : 75;
    var baseConf = config.baseConfidence != null ? config.baseConfidence : 45;

    if (!sequence || sequence.length < 5) {
      return { prediction: '-', confidence: 0 };
    }

    var last5 = sequence.slice(0, 5);
    var last3 = sequence.slice(0, 3);

    var countA = last5.filter(function(s) { return s[fieldName] === labelA; }).length;
    var countB = last5.filter(function(s) { return s[fieldName] === labelB; }).length;
    var ratioA = countA / 5;
    var ratioB = countB / 5;

    var scoreA = 0;
    var scoreB = 0;
    var reasons = [];

    var allA3 = last3.every(function(s) { return s[fieldName] === labelA; });
    var allB3 = last3.every(function(s) { return s[fieldName] === labelB; });

    if (allA3) {
      scoreB += 35;
      reasons.push('连续3期' + nameA + '(强反转信号)');
    } else if (allB3) {
      scoreA += 35;
      reasons.push('连续3期' + nameB + '(强反转信号)');
    } else if (last3[0][fieldName] !== last3[1][fieldName] &&
               last3[1][fieldName] !== last3[2][fieldName]) {
      // 三期交替：A-B-A 或 B-A-B
      if (last3[0][fieldName] === labelA) {
        // A-B-A 形态：反转给 A
        scoreA += 25;
        reasons.push(nameA + nameB + nameA + '交替中(延续交替)');
      } else {
        // B-A-B 形态：反转给 B
        scoreB += 25;
        reasons.push(nameB + nameA + nameB + '交替中(延续交替)');
      }
    }

    if (ratioA >= 0.8) {
      scoreB += 20 + (ratioA - 0.8) * 50;
      reasons.push('近期' + nameA + '占比' + Math.round(ratioA * 100) + '%(均值回归)');
    } else if (ratioB >= 0.8) {
      scoreA += 20 + (ratioB - 0.8) * 50;
      reasons.push('近期' + nameB + '占比' + Math.round(ratioB * 100) + '%(均值回归)');
    }

    if (sequence.length >= 7) {
      var prev2 = sequence[2][fieldName];
      if (prev2 === labelA && last3[0][fieldName] === labelB) {
        scoreA += 15;
        reasons.push(nameA + '→' + nameB + '后常转' + nameA);
      } else if (prev2 === labelB && last3[0][fieldName] === labelA) {
        scoreB += 15;
        reasons.push(nameB + '→' + nameA + '后常转' + nameB);
      }
    }

    var recent2Same = last3[0][fieldName] === last3[1][fieldName];
    if (recent2Same) {
      if (last3[0][fieldName] === labelA) {
        scoreA += 10;
        reasons.push('最近2期连' + nameA + '(惯性)');
      } else {
        scoreB += 10;
        reasons.push('最近2期连' + nameB + '(惯性)');
      }
    }

    if (ratioA > 0.4 && ratioA < 0.6) {
      if (ratioA > 0.5) {
        scoreA += 12;
        reasons.push(nameA + '略占优(' + Math.round(ratioA * 100) + '%)');
      } else {
        scoreB += 12;
        reasons.push(nameB + '略占优(' + Math.round(ratioB * 100) + '%)');
      }
    }

    var totalScore = scoreA + scoreB;
    var prediction, confidence;

    if (totalScore === 0) {
      return { prediction: '-', confidence: 40, reason: '无明显规律' };
    }

    if (scoreA > scoreB) {
      prediction = labelA;
      confidence = Math.min(maxConf, baseConf + Math.round((scoreA / totalScore) * 30));
    } else if (scoreB > scoreA) {
      prediction = labelB;
      confidence = Math.min(maxConf, baseConf + Math.round((scoreB / totalScore) * 30));
    } else {
      prediction = last3[0][fieldName];
      confidence = 48;
      reasons.push('势均力敌，跟随最新趋势');
    }

    var topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  },

  // ============================================================
  // 4) 趋势预测：多分类（五行 / 波色 通用）
  // ============================================================

  /**
   * 多分类趋势预测
   * 替代原 _predictWuxingTrend / _predictColorTrend
   *
   * @param {Array} sequence - 序列
   * @param {Object} config
   * @param {string} config.fieldName - 'wuxing' / 'color'
   * @param {string[]} config.categories - 分类数组
   *   - 五行：['金','木','水','火','土']
   *   - 波色：['红','蓝','绿']
   * @param {string[]} [config.nextOrder] - 顺位数组（可选）
   *   - 五行：['金','木','水','火','土']（相生顺序）
   *   - 波色：null（无顺位概念）
   * @param {number} [config.maxConfidence=72] - 最大可信度
   * @param {number} [config.baseConfidence=42] - 基础可信度
   * @returns {{prediction: string, confidence: number, reason: string}}
   */
  predictMultiTrend: function(sequence, config) {
    var fieldName = config.fieldName;
    var categories = config.categories || [];
    var nextOrder = config.nextOrder || null;
    var maxConf = config.maxConfidence != null ? config.maxConfidence : 72;
    var baseConf = config.baseConfidence != null ? config.baseConfidence : 42;

    if (!sequence || sequence.length < 5) {
      return { prediction: '-', confidence: 0 };
    }

    var last5 = sequence.slice(0, 5);
    var last3 = sequence.slice(0, 3);

    var scores = {};
    categories.forEach(function(c) { scores[c] = 0; });
    var reasons = [];

    // 1) 连续3期同色 → 其他加分（分散信号）
    var allSame3 = last3.every(function(s) { return s[fieldName] === last3[0][fieldName]; });
    if (allSame3) {
      var others = categories.filter(function(c) { return c !== last3[0][fieldName]; });
      others.forEach(function(c) { scores[c] += 20; });
      reasons.push('连续3期' + last3[0][fieldName] + '(分散信号)');
    }

    // 2) 占比 ≥ 3 → 其他加分（均衡化）
    var last5Count = {};
    last5.forEach(function(s) {
      last5Count[s[fieldName]] = (last5Count[s[fieldName]] || 0) + 1;
    });
    Object.keys(last5Count).forEach(function(key) {
      if (last5Count[key] >= 3) {
        var bonus = (last5Count[key] - 2) * 8;
        var otherKeys = categories.filter(function(c) { return c !== key; });
        otherKeys.forEach(function(c) { scores[c] += Math.max(5, bonus); });
        reasons.push(key + '占比高(' + last5Count[key] * 20 + '%)(均衡化)');
      }
    });

    // 3) sequence[2] == last3[0] → 该 key 加 15（重复出现趋势）
    if (sequence.length >= 7 && sequence[2][fieldName] === last3[0][fieldName]) {
      scores[last3[0][fieldName]] += 15;
      reasons.push(last3[0][fieldName] + '有重复出现趋势');
    }

    // 4) last3[0] == last3[1] → 该 key 加 12（惯性）
    if (last3[0][fieldName] === last3[1][fieldName]) {
      scores[last3[0][fieldName]] += 12;
      reasons.push('最近2期连' + last3[0][fieldName] + '(惯性)');
    }

    // 5) 顺位预测（仅五行有效；波色无顺位）
    if (nextOrder && nextOrder.length > 0) {
      var lastIndex = nextOrder.indexOf(last3[0][fieldName]);
      if (lastIndex !== -1) {
        var nextKey = nextOrder[(lastIndex + 1) % nextOrder.length];
        scores[nextKey] += 10;
        reasons.push(nextKey + '为下一顺位');
      }
    }

    // 6) 选最高分
    var maxScore = -1;
    var prediction = '-';
    Object.keys(scores).forEach(function(k) {
      if (scores[k] > maxScore) {
        maxScore = scores[k];
        prediction = k;
      }
    });

    if (maxScore === 0) {
      prediction = last3[0][fieldName];
      reasons.push('跟随最新趋势');
    }

    var confidence = Math.min(maxConf, baseConf + Math.round((maxScore / 50) * 30));
    var topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  },

  // ============================================================
  // 5) 二分类统计入口（大小 / 单双 通用）
  // ============================================================

  /**
   * 二分类统计：构造 sequence + 调用 analyze + predict
   * 替代原 getLatestSizeStats / getLatestOddEvenStats
   *
   * @param {Array} historyData - 历史数据（[0] 为最新）
   * @param {Object} config
   * @param {string} config.fieldName - 'size' / 'type'
   * @param {string} config.labelA - '大' / '单'
   * @param {string} config.labelB - '小' / '双'
   * @param {Function} config.valueOf - (special, item) => labelA | labelB
   * @param {string} [config.nameA] - A 中文名（默认 = labelA）
   * @param {string} [config.nameB] - B 中文名
   * @param {number} [config.period=10] - 统计期数
   * @param {Array} [config.precomputedSpecials] - 预计算 specials
   * @returns {Object|null} { period, sequence, patterns, trend, countA, countB, percentA, percentB, ... }
   *
   * 兼容字段：
   *   - 当 labelA='大' 时：返回 bigCount / smallCount / bigPercent / smallPercent
   *   - 当 labelA='单' 时：返回 oddCount / evenCount / oddPercent / evenPercent
   *   - 其它情况：返回 countA / countB / percentA / percentB
   */
  getLatestBinaryStats: function(historyData, config) {
    if (!historyData || !historyData.length) return null;
    if (!Utils || !Utils.SpecialCalculator) return null;

    var fieldName = config.fieldName;
    var labelA = config.labelA;
    var labelB = config.labelB;
    var nameA = config.nameA || labelA;
    var nameB = config.nameB || labelB;
    var valueOf = config.valueOf;
    var period = config.period || 10;
    var precomputedSpecials = config.precomputedSpecials;

    var recentData = historyData.slice(0, Math.min(period, historyData.length));
    var usePrecomputed = precomputedSpecials &&
                         precomputedSpecials.length >= recentData.length;

    var sequence = [];
    var countA = 0;
    var countB = 0;

    recentData.forEach(function(item, idx) {
      var special = usePrecomputed
        ? precomputedSpecials[idx]
        : Utils.SpecialCalculator.getSpecial(item);
      var raw = valueOf(special, item);
      var value = (raw === labelA) ? labelA : labelB;
      var entry = {
        expect: item.expect,
        number: special.te
      };
      entry[fieldName] = value;
      sequence.push(entry);
      if (value === labelA) countA++;
      else countB++;
    });

    var patterns = BusinessCommonStats.analyzeBinaryPatterns(sequence, fieldName, {
      altName: nameA + nameB
    });
    var trend = BusinessCommonStats.predictBinaryTrend(sequence, {
      fieldName: fieldName,
      labelA: labelA,
      labelB: labelB,
      nameA: nameA,
      nameB: nameB
    });

    var total = sequence.length;
    var result = {
      period: period,
      sequence: sequence,
      patterns: patterns,
      trend: trend,
      labelA: labelA,
      labelB: labelB,
      nameA: nameA,
      nameB: nameB,
      fieldName: fieldName,
      countA: countA,
      countB: countB,
      percentA: total > 0 ? Math.round((countA / total) * 100) : 0,
      percentB: total > 0 ? Math.round((countB / total) * 100) : 0
    };

    // 兼容字段命名（沿用原 getLatestSizeStats / getLatestOddEvenStats 字段）
    if (labelA === '大') {
      result.bigCount = countA;
      result.smallCount = countB;
      result.bigPercent = result.percentA;
      result.smallPercent = result.percentB;
    } else if (labelA === '单') {
      result.oddCount = countA;
      result.evenCount = countB;
      result.oddPercent = result.percentA;
      result.evenPercent = result.percentB;
    }

    return result;
  },

  // ============================================================
  // 6) 多分类统计入口（五行 / 波色 通用）
  // ============================================================

  /**
   * 多分类统计：构造 sequence + count + 调用 analyze + predict
   * 替代原 getLatestWuxingStats / getLatestColorStats
   *
   * @param {Array} historyData
   * @param {Object} config
   * @param {string} config.fieldName - 'wuxing' / 'color'
   * @param {string[]} config.categories - 分类数组
   * @param {Function} config.valueOf - (special, item) => category
   * @param {string[]} [config.nextOrder] - 顺位数组（仅五行传）
   * @param {number} [config.period=10]
   * @param {Array} [config.precomputedSpecials]
   * @returns {Object|null}
   */
  getLatestMultiStats: function(historyData, config) {
    if (!historyData || !historyData.length) return null;
    if (!Utils || !Utils.SpecialCalculator) return null;

    var fieldName = config.fieldName;
    var categories = config.categories || [];
    var valueOf = config.valueOf;
    var nextOrder = config.nextOrder || null;
    var period = config.period || 10;
    var precomputedSpecials = config.precomputedSpecials;

    var recentData = historyData.slice(0, Math.min(period, historyData.length));
    var usePrecomputed = precomputedSpecials &&
                         precomputedSpecials.length >= recentData.length;

    var sequence = [];
    var count = {};
    categories.forEach(function(c) { count[c] = 0; });

    recentData.forEach(function(item, idx) {
      var special = usePrecomputed
        ? precomputedSpecials[idx]
        : Utils.SpecialCalculator.getSpecial(item);
      var value = valueOf(special, item);
      var entry = {
        expect: item.expect,
        number: special.te
      };
      entry[fieldName] = value;
      sequence.push(entry);
      if (count[value] !== undefined) count[value]++;
    });

    var patterns = BusinessCommonStats.analyzeMultiPatterns(sequence, fieldName);
    var trend = BusinessCommonStats.predictMultiTrend(sequence, {
      fieldName: fieldName,
      categories: categories,
      nextOrder: nextOrder
    });

    return {
      period: period,
      sequence: sequence,
      count: count,
      categories: categories,
      fieldName: fieldName,
      nextOrder: nextOrder,
      patterns: patterns,
      trend: trend
    };
  }
};
