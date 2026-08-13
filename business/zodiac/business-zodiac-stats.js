/**
 * 业务层：大小/奇偶/五行/波色统计（拆分自 business-zodiac-prediction.js，2026-06-05）
 * @namespace ZodiacPredictionStats
 * 包含：
 *   - getLatestSizeStats / _analyzeSizePatterns / _predictSizeTrend
 *   - getLatestOddEvenStats / _analyzeOddEvenPatterns / _predictOddEvenTrend
 *   - getLatestWuxingStats / _analyzeWuxingPatterns / _predictWuxingTrend
 *   - getLatestColorStats / _analyzeColorPatterns / _predictColorTrend
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ZodiacPrediction.xxx() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - 内部使用 `Utils.SpecialCalculator.getSpecial` 引用门面上的共享工具（运行时查找）
 */
const ZodiacPredictionStats = {
  getLatestSizeStats: function(historyData, period, precomputedSpecials) {
    if (!historyData || !historyData.length) return null;

    period = period || 10;
    const recentData = historyData.slice(0, Math.min(period, historyData.length));
    const sizeSequence = [];
    let bigCount = 0;
    let smallCount = 0;

    // 2026-06-21 性能优化：允许调用方传入预计算的 specials 数组（前 N 项与 recentData 对齐）
    const usePrecomputed = precomputedSpecials && precomputedSpecials.length >= recentData.length;

    recentData.forEach(function(item, idx) {
      const special = usePrecomputed ? precomputedSpecials[idx] : Utils.SpecialCalculator.getSpecial(item);
      const te = special.te;
      const isBig = te >= CONFIG.BIG_RANGE[0] && te <= CONFIG.BIG_RANGE[1];
      sizeSequence.push({
        expect: item.expect,
        number: te,
        size: isBig ? '大' : '小',
        zodiac: special.zod
      });
      if (isBig) {
        bigCount++;
      } else {
        smallCount++;
      }
    });

    const patterns = ZodiacPrediction._analyzeSizePatterns(sizeSequence);
    const trend = ZodiacPrediction._predictSizeTrend(sizeSequence);

    return {
      period: period,
      sequence: sizeSequence,
      bigCount: bigCount,
      smallCount: smallCount,
      bigPercent: sizeSequence.length > 0 ? Math.round((bigCount / sizeSequence.length) * 100) : 0,
      smallPercent: sizeSequence.length > 0 ? Math.round((smallCount / sizeSequence.length) * 100) : 0,
      patterns: patterns,
      trend: trend
    };
  },

  _analyzeSizePatterns: function(sequence) {
    if (!sequence || sequence.length < 2) return [];

    const patterns = [];
    let currentStreak = 1;
    let streakType = sequence[0].size;

    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].size === streakType) {
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
        streakType = sequence[i].size;
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

    let alternations = 0;
    for (let j = 1; j < sequence.length - 1; j++) {
      if (sequence[j].size !== sequence[j - 1].size && sequence[j].size !== sequence[j + 1].size) {
        alternations++;
      }
    }
    if (alternations >= 3) {
      patterns.push({
        type: '交替频繁',
        count: alternations,
        description: '近期大小交替出现较频繁'
      });
    }

    return patterns;
  },

  _predictSizeTrend: function(sequence) {
    if (!sequence || sequence.length < 5) return { prediction: '-', confidence: 0 };

    const last5 = sequence.slice(0, 5);
    const last3 = sequence.slice(0, 3);

    const bigCount = last5.filter(function(s) { return s.size === '大'; }).length;
    const smallCount = last5.filter(function(s) { return s.size === '小'; }).length;
    const bigRatio = bigCount / 5;
    const smallRatio = smallCount / 5;

    let scoreBig = 0;
    let scoreSmall = 0;
    const reasons = [];

    const allBig3 = last3.every(function(s) { return s.size === '大'; });
    const allSmall3 = last3.every(function(s) { return s.size === '小'; });

    if (allBig3) {
      scoreSmall += 35;
      reasons.push('连续3期大(强反转信号)');
    } else if (allSmall3) {
      scoreBig += 35;
      reasons.push('连续3期小(强反转信号)');
    } else if (last3[0].size !== last3[1].size && last3[1].size !== last3[2].size) {
      if (last3[0].size === '大') {
        scoreSmall += 25;
        reasons.push('大小交替中(延续交替)');
      } else {
        scoreBig += 25;
        reasons.push('大小小交替中(延续交替)');
      }
    }

    if (bigRatio >= 0.8) {
      scoreSmall += 20 + (bigRatio - 0.8) * 50;
      reasons.push('近期大占比' + Math.round(bigRatio * 100) + '%(均值回归)');
    } else if (smallRatio >= 0.8) {
      scoreBig += 20 + (smallRatio - 0.8) * 50;
      reasons.push('近期小占比' + Math.round(smallRatio * 100) + '%(均值回归)');
    }

    if (sequence.length >= 7) {
      const prev2 = sequence[2].size;
      if (prev2 === '大' && last3[0].size === '小') {
        scoreBig += 15;
        reasons.push('大→小后常转大');
      } else if (prev2 === '小' && last3[0].size === '大') {
        scoreSmall += 15;
        reasons.push('小→大后常转小');
      }
    }

    const recent2Same = last3[0].size === last3[1].size;
    if (recent2Same) {
      if (last3[0].size === '大') {
        scoreBig += 10;
        reasons.push('最近2期连大(惯性)');
      } else {
        scoreSmall += 10;
        reasons.push('最近2期连小(惯性)');
      }
    }

    if (bigRatio > 0.4 && bigRatio < 0.6) {
      if (bigRatio > 0.5) {
        scoreBig += 12;
        reasons.push('大略占优(' + Math.round(bigRatio * 100) + '%)');
      } else {
        scoreSmall += 12;
        reasons.push('小略占优(' + Math.round(smallRatio * 100) + '%)');
      }
    }

    const totalScore = scoreBig + scoreSmall;
    let prediction, confidence;

    if (totalScore === 0) {
      return { prediction: '-', confidence: 40, reason: '无明显规律' };
    }

    if (scoreBig > scoreSmall) {
      prediction = '大';
      confidence = Math.min(75, 45 + Math.round((scoreBig / totalScore) * 30));
    } else if (scoreSmall > scoreBig) {
      prediction = '小';
      confidence = Math.min(75, 45 + Math.round((scoreSmall / totalScore) * 30));
    } else {
      prediction = last3[0].size;
      confidence = 48;
      reasons.push('势均力敌，跟随最新趋势');
    }

    const topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  },

  getLatestOddEvenStats: function(historyData, period, precomputedSpecials) {
  if (!historyData || !historyData.length) return null;

  period = period || 10;
  const recentData = historyData.slice(0, Math.min(period, historyData.length));
  const oddEvenSequence = [];
  let oddCount = 0;
  let evenCount = 0;

  // 2026-06-21 性能优化：复用调用方传入的预计算 specials（前 N 项与 recentData 对齐）
  const usePrecomputed = precomputedSpecials && precomputedSpecials.length >= recentData.length;

  recentData.forEach(function(item, idx) {
    const special = usePrecomputed ? precomputedSpecials[idx] : Utils.SpecialCalculator.getSpecial(item);
    const te = special.te;
    const isOdd = te % 2 !== 0;
    oddEvenSequence.push({
      expect: item.expect,
      number: te,
      type: isOdd ? '单' : '双',
      zodiac: special.zod
    });
    if (isOdd) {
      oddCount++;
    } else {
      evenCount++;
    }
  });

  const patterns = ZodiacPrediction._analyzeOddEvenPatterns(oddEvenSequence);
  const trend = ZodiacPrediction._predictOddEvenTrend(oddEvenSequence);

  return {
    period: period,
    sequence: oddEvenSequence,
    oddCount: oddCount,
    evenCount: evenCount,
    oddPercent: Math.round((oddCount / oddEvenSequence.length) * 100),
    evenPercent: Math.round((evenCount / oddEvenSequence.length) * 100),
    patterns: patterns,
    trend: trend
  };
},

_analyzeOddEvenPatterns: function(sequence) {
  if (!sequence || sequence.length < 2) return [];

  const patterns = [];
  let currentStreak = 1;
  let streakType = sequence[0].type;

  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i].type === streakType) {
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
      streakType = sequence[i].type;
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

  let alternations = 0;
  for (let j = 1; j < sequence.length - 1; j++) {
    if (sequence[j].type !== sequence[j - 1].type && sequence[j].type !== sequence[j + 1].type) {
      alternations++;
    }
  }
  if (alternations >= 3) {
    patterns.push({
      type: '交替频繁',
      count: alternations,
      description: '近期单双交替出现较频繁'
    });
  }

  return patterns;
},

_predictOddEvenTrend: function(sequence) {
  if (!sequence || sequence.length < 5) return { prediction: '-', confidence: 0 };

  const last5 = sequence.slice(0, 5);
  const last3 = sequence.slice(0, 3);

  const oddCount = last5.filter(function(s) { return s.type === '单'; }).length;
  const evenCount = last5.filter(function(s) { return s.type === '双'; }).length;
  const oddRatio = oddCount / 5;
  const evenRatio = evenCount / 5;

  let scoreOdd = 0;
  let scoreEven = 0;
  const reasons = [];

  const allOdd3 = last3.every(function(s) { return s.type === '单'; });
  const allEven3 = last3.every(function(s) { return s.type === '双'; });

  if (allOdd3) {
    scoreEven += 35;
    reasons.push('连续3期单(强反转信号)');
  } else if (allEven3) {
    scoreOdd += 35;
    reasons.push('连续3期双(强反转信号)');
  } else if (last3[0].type !== last3[1].type && last3[1].type !== last3[2].type) {
    if (last3[0].type === '单') {
      scoreEven += 25;
      reasons.push('单双交替中(延续交替)');
    } else {
      scoreOdd += 25;
      reasons.push('双单交替中(延续交替)');
    }
  }

  if (oddRatio >= 0.8) {
    scoreEven += 20 + (oddRatio - 0.8) * 50;
    reasons.push('近期单占比' + Math.round(oddRatio * 100) + '%(均值回归)');
  } else if (evenRatio >= 0.8) {
    scoreOdd += 20 + (evenRatio - 0.8) * 50;
    reasons.push('近期双占比' + Math.round(evenRatio * 100) + '%(均值回归)');
  }

  if (sequence.length >= 7) {
    const prev2 = sequence[2].type;
    if (prev2 === '单' && last3[0].type === '双') {
      scoreOdd += 15;
      reasons.push('单→双后常转单');
    } else if (prev2 === '双' && last3[0].type === '单') {
      scoreEven += 15;
      reasons.push('双→单后常转双');
    }
  }

  const recent2Same = last3[0].type === last3[1].type;
  if (recent2Same) {
    if (last3[0].type === '单') {
      scoreOdd += 10;
      reasons.push('最近2期连单(惯性)');
    } else {
      scoreEven += 10;
      reasons.push('最近2期连双(惯性)');
    }
  }

  if (oddRatio > 0.4 && oddRatio < 0.6) {
    if (oddRatio > 0.5) {
      scoreOdd += 12;
      reasons.push('单略占优(' + Math.round(oddRatio * 100) + '%)');
    } else {
      scoreEven += 12;
      reasons.push('双略占优(' + Math.round(evenRatio * 100) + '%)');
    }
  }

  const totalScore = scoreOdd + scoreEven;
  let prediction, confidence;

  if (totalScore === 0) {
    return { prediction: '-', confidence: 40, reason: '无明显规律' };
  }

  if (scoreOdd > scoreEven) {
    prediction = '单';
    confidence = Math.min(75, 45 + Math.round((scoreOdd / totalScore) * 30));
  } else if (scoreEven > scoreOdd) {
    prediction = '双';
    confidence = Math.min(75, 45 + Math.round((scoreEven / totalScore) * 30));
  } else {
    prediction = last3[0].type;
    confidence = 48;
    reasons.push('势均力敌，跟随最新趋势');
  }

  const topReasons = reasons.slice(0, 2).join('; ');
  return { prediction: prediction, confidence: confidence, reason: topReasons };
},

  getLatestWuxingStats: function(historyData, period, precomputedSpecials) {
    if (!historyData || !historyData.length) return null;

    period = period || 10;
    const recentData = historyData.slice(0, Math.min(period, historyData.length));
    const wuxingSequence = [];
    const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };

    // 2026-06-21 性能优化：复用调用方传入的预计算 specials
    const usePrecomputed = precomputedSpecials && precomputedSpecials.length >= recentData.length;

    recentData.forEach(function(item, idx) {
      const special = usePrecomputed ? precomputedSpecials[idx] : Utils.SpecialCalculator.getSpecial(item);
      const wuxing = special.wuxing;
      wuxingSequence.push({
        expect: item.expect,
        number: special.te,
        wuxing: wuxing
      });
      if (wuxingCount[wuxing] !== undefined) {
        wuxingCount[wuxing]++;
      }
    });

    const patterns = ZodiacPrediction._analyzeWuxingPatterns(wuxingSequence);
    const trend = ZodiacPrediction._predictWuxingTrend(wuxingSequence);

    return {
      period: period,
      sequence: wuxingSequence,
      count: wuxingCount,
      patterns: patterns,
      trend: trend
    };
  },

  _analyzeWuxingPatterns: function(sequence) {
    if (!sequence || sequence.length < 2) return [];

    const patterns = [];
    let currentStreak = 1;
    let streakType = sequence[0].wuxing;

    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].wuxing === streakType) {
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
        streakType = sequence[i].wuxing;
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

    const hotWuxing = {};
    sequence.forEach(function(item) {
      hotWuxing[item.wuxing] = (hotWuxing[item.wuxing] || 0) + 1;
    });

    const sortedWuxing = Object.keys(hotWuxing).sort(function(a, b) {
      return hotWuxing[b] - hotWuxing[a];
    });

    if (sortedWuxing.length > 0 && hotWuxing[sortedWuxing[0]] >= 3) {
      patterns.push({
        type: sortedWuxing[0] + '热',
        count: hotWuxing[sortedWuxing[0]],
        description: sortedWuxing[0] + '近期出现' + hotWuxing[sortedWuxing[0]] + '次'
      });
    }

    return patterns;
  },

  _predictWuxingTrend: function(sequence) {
    if (!sequence || sequence.length < 5) return { prediction: '-', confidence: 0 };

    const last5 = sequence.slice(0, 5);
    const last3 = sequence.slice(0, 3);

    const wuxingScores = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    const reasons = [];

    const allSame3 = last3.every(function(s) { return s.wuxing === last3[0].wuxing; });
    if (allSame3) {
      const otherWuxings = ['金', '木', '水', '火', '土'].filter(function(w) { return w !== last3[0].wuxing; });
      otherWuxings.forEach(function(w) { wuxingScores[w] += 20; });
      reasons.push('连续3期' + last3[0].wuxing + '(分散信号)');
    }

    const last5Count = {};
    last5.forEach(function(s) {
      last5Count[s.wuxing] = (last5Count[s.wuxing] || 0) + 1;
    });

    Object.keys(last5Count).forEach(function(wx) {
      if (last5Count[wx] >= 3) {
        const bonus = (last5Count[wx] - 2) * 8;
        const others = ['金', '木', '水', '火', '土'].filter(function(w) { return w !== wx; });
        others.forEach(function(w) { wuxingScores[w] += Math.max(5, bonus); });
        reasons.push(wx + '占比高(' + last5Count[wx] * 20 + '%)(均衡化)');
      }
    });

    if (sequence.length >= 7 && sequence[2].wuxing === last3[0].wuxing) {
      wuxingScores[last3[0].wuxing] += 15;
      reasons.push(last3[0].wuxing + '有重复出现趋势');
    }

    if (last3[0].wuxing === last3[1].wuxing) {
      wuxingScores[last3[0].wuxing] += 12;
      reasons.push('最近2期连' + last3[0].wuxing + '(惯性)');
    }

    const wuxingOrder = ['金', '木', '水', '火', '土'];
    const lastIndex = wuxingOrder.indexOf(last3[0].wuxing);
    if (lastIndex !== -1) {
      const nextWuxing = wuxingOrder[(lastIndex + 1) % 5];
      wuxingScores[nextWuxing] += 10;
      reasons.push(nextWuxing + '为下一顺位');
    }

    let maxScore = -1;
    let prediction = '-';
    Object.keys(wuxingScores).forEach(function(wx) {
      if (wuxingScores[wx] > maxScore) {
        maxScore = wuxingScores[wx];
        prediction = wx;
      }
    });

    if (maxScore === 0) {
      prediction = last3[0].wuxing;
      reasons.push('跟随最新趋势');
    }

    const confidence = Math.min(72, 42 + Math.round((maxScore / 50) * 30));
    const topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  },

  getLatestColorStats: function(historyData, period, precomputedSpecials) {
    if (!historyData || !historyData.length) return null;

    period = period || 10;
    const recentData = historyData.slice(0, Math.min(period, historyData.length));
    const colorSequence = [];
    const colorCount = { '红': 0, '蓝': 0, '绿': 0 };

    // 2026-06-21 性能优化：复用调用方传入的预计算 specials
    const usePrecomputed = precomputedSpecials && precomputedSpecials.length >= recentData.length;

    recentData.forEach(function(item, idx) {
      const special = usePrecomputed ? precomputedSpecials[idx] : Utils.SpecialCalculator.getSpecial(item);
      const colorName = special.colorName;
      colorSequence.push({
        expect: item.expect,
        number: special.te,
        color: colorName
      });
      if (colorCount[colorName] !== undefined) {
        colorCount[colorName]++;
      }
    });

    const patterns = ZodiacPrediction._analyzeColorPatterns(colorSequence);
    const trend = ZodiacPrediction._predictColorTrend(colorSequence);

    return {
      period: period,
      sequence: colorSequence,
      count: colorCount,
      patterns: patterns,
      trend: trend
    };
  },

  _analyzeColorPatterns: function(sequence) {
    if (!sequence || sequence.length < 2) return [];

    const patterns = [];
    let currentStreak = 1;
    let streakType = sequence[0].color;

    for (let i = 1; i < sequence.length; i++) {
      if (sequence[i].color === streakType) {
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
        streakType = sequence[i].color;
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

    const hotColor = {};
    sequence.forEach(function(item) {
      hotColor[item.color] = (hotColor[item.color] || 0) + 1;
    });

    const sortedColor = Object.keys(hotColor).sort(function(a, b) {
      return hotColor[b] - hotColor[a];
    });

    if (sortedColor.length > 0 && hotColor[sortedColor[0]] >= 3) {
      patterns.push({
        type: sortedColor[0] + '热',
        count: hotColor[sortedColor[0]],
        description: sortedColor[0] + '近期出现' + hotColor[sortedColor[0]] + '次'
      });
    }

    return patterns;
  },

  _predictColorTrend: function(sequence) {
    if (!sequence || sequence.length < 5) return { prediction: '-', confidence: 0 };

    const last5 = sequence.slice(0, 5);
    const last3 = sequence.slice(0, 3);

    const colorScores = { '红': 0, '蓝': 0, '绿': 0 };
    const reasons = [];

    const allSame3 = last3.every(function(s) { return s.color === last3[0].color; });
    if (allSame3) {
      const otherColors = ['红', '蓝', '绿'].filter(function(c) { return c !== last3[0].color; });
      otherColors.forEach(function(c) { colorScores[c] += 20; });
      reasons.push('连续3期' + last3[0].color + '(分散信号)');
    }

    const last5Count = {};
    last5.forEach(function(s) {
      last5Count[s.color] = (last5Count[s.color] || 0) + 1;
    });

    Object.keys(last5Count).forEach(function(cl) {
      if (last5Count[cl] >= 3) {
        const bonus = (last5Count[cl] - 2) * 8;
        const otherCls = ['红', '蓝', '绿'].filter(function(c) { return c !== cl; });
        otherCls.forEach(function(c) { colorScores[c] += Math.max(5, bonus); });
        reasons.push(cl + '占比高(' + last5Count[cl] * 20 + '%)(均衡化)');
      }
    });

    if (sequence.length >= 7 && sequence[2].color === last3[0].color) {
      colorScores[last3[0].color] += 15;
      reasons.push(last3[0].color + '有重复出现趋势');
    }

    if (last3[0].color === last3[1].color) {
      colorScores[last3[0].color] += 12;
      reasons.push('最近2期连' + last3[0].color + '(惯性)');
    }

    let maxScore = -1;
    let prediction = '-';
    Object.keys(colorScores).forEach(function(cl) {
      if (colorScores[cl] > maxScore) {
        maxScore = colorScores[cl];
        prediction = cl;
      }
    });

    if (maxScore === 0) {
      prediction = last3[0].color;
      reasons.push('跟随最新趋势');
    }

    const confidence = Math.min(72, 42 + Math.round((maxScore / 50) * 30));
    const topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  }
};

// ============================================================
// v2.0.8 性能优化：4 个统计函数 LRU 包装（以 historyData + period 为 key）
//   - 同 historyData + 同 period 重复调用直接命中缓存
//   - 视图层切 tab / 重新渲染时高频命中，节省 70%+ 时间
// ============================================================
if (typeof BusinessCommonLRU !== 'undefined' && BusinessCommonLRU) {
  ZodiacPredictionStats.getLatestSizeStats = BusinessCommonLRU.withHistoryWindowLRU(
    ZodiacPredictionStats.getLatestSizeStats,
    100
  );
  ZodiacPredictionStats.getLatestOddEvenStats = BusinessCommonLRU.withHistoryWindowLRU(
    ZodiacPredictionStats.getLatestOddEvenStats,
    100
  );
  ZodiacPredictionStats.getLatestWuxingStats = BusinessCommonLRU.withHistoryWindowLRU(
    ZodiacPredictionStats.getLatestWuxingStats,
    100
  );
  ZodiacPredictionStats.getLatestColorStats = BusinessCommonLRU.withHistoryWindowLRU(
    ZodiacPredictionStats.getLatestColorStats,
    100
  );
}

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionStats);
}
