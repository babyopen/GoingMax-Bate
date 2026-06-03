const ZodiacPrediction = {
  ZODIAC_ORDER: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  ZODIAC_EMOJI: {
    '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
    '龙': '🐲', '蛇': '🐍', '马': '🐎', '羊': '🐏',
    '猴': '🐒', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
  },

  getZodiacEmoji: function(zodiac) {
    return this.ZODIAC_EMOJI[zodiac] || '';
  },

  WUXING_MAP: {
    '鼠': '水', '牛': '土', '虎': '木', '兔': '木',
    '龙': '土', '蛇': '火', '马': '火', '羊': '土',
    '猴': '金', '鸡': '金', '狗': '土', '猪': '水'
  },

  WUXING_SHENG: {
    '金': '水', '水': '木', '木': '火', '火': '土', '土': '金'
  },

  TAIL_ZODIAC_MAP: {
    0: ['鼠', '猪'], 1: ['牛', '狗'], 2: ['虎', '鸡'],
    3: ['兔', '猴'], 4: ['龙', '羊'], 5: ['蛇', '马'],
    6: ['鼠', '猪'], 7: ['牛', '狗'], 8: ['虎', '鸡'],
    9: ['兔', '猴']
  },

  calcContinuousScores: function(historyData) {
    if (!historyData || !historyData.length) return null;

    var list = historyData;
    var total = list.length;
    var latestExpect = Number(list[0]?.expect || 0);

    var lastAppearIdx = {};
    var zodiacRecords = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      lastAppearIdx[z] = -1;
      zodiacRecords[z] = [];
    });

    list.forEach(function(item, idx) {
      var s = ZodiacPrediction._getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
        if (lastAppearIdx[s.zod] === -1) lastAppearIdx[s.zod] = idx;
        zodiacRecords[s.zod].push({
          idx: idx,
          expect: Number(item.expect || 0),
          te: s.te,
          tail: s.tail,
          head: s.head,
          colorName: s.colorName,
          odd: s.odd,
          big: s.big,
          wuxing: s.wuxing,
          animal: s.animal
        });
      }
    });

    var missMap = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      missMap[z] = Utils.calcMiss(lastAppearIdx[z], total, latestExpect, list);
    });

    var latestItem = list[0];
    var latestSpecial = latestItem ? ZodiacPrediction._getSpecial(latestItem) : null;

    var baseScores = ZodiacPrediction._calcBaseScores(missMap);
    var shapeScores = ZodiacPrediction._calcShapeScores(missMap, zodiacRecords, list, latestSpecial);
    var intervalScores = ZodiacPrediction._calcIntervalScores(list);
    var trendScores = ZodiacPrediction._calcTrendScores(zodiacRecords, list);
    var momentumScores = ZodiacPrediction._calcMomentumScores(zodiacRecords, list);

    var scores = {};
    var details = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var base = baseScores[z] || 0;
      var shape = shapeScores[z] || 0;
      var interval = intervalScores[z] || 0;
      var trend = trendScores[z] || 0;
      var momentum = momentumScores[z] || 0;
      scores[z] = base + shape + interval + trend + momentum;
      details[z] = {
        base: base,
        shape: shape,
        interval: interval,
        trend: trend,
        momentum: momentum,
        miss: missMap[z]
      };
    });

    var sorted = Object.entries(scores).sort(function(a, b) { return b[1] - a[1]; });

    sorted = ZodiacPrediction._applyPenaltyRules(sorted, list);

    var maxScore = sorted.length > 0 ? sorted[0][1] : 0;
    var minScore = sorted.length > 0 ? sorted[sorted.length - 1][1] : 0;
    var scoreRange = maxScore - minScore || 1;

    var cards = [];
    sorted.forEach(function(entry, idx) {
      var zod = entry[0];
      var rawScore = entry[1];
      var normalizedScore = Math.round(((rawScore - minScore) / scoreRange) * 40 + 45);
      normalizedScore = Math.max(0, Math.min(100, normalizedScore));

      var det = details[zod];
      var heatTag = det.base >= 25 ? '热号' : (det.base >= 10 ? '温号' : '冷号');
      var roleTag = '';
      var cardClass = '';

      if (idx === 0) {
        roleTag = '精选';
        cardClass = 'is-selected';
      } else if (idx >= 1 && idx <= 2) {
        roleTag = '精选';
        cardClass = 'is-featured';
      } else if (idx >= 3 && idx <= 5) {
        roleTag = '防守';
        cardClass = 'is-featured';
      } else {
        roleTag = '防守';
        cardClass = 'is-secondary';
      }

      cards.push({
        zodiac: zod,
        score: normalizedScore,
        roleTag: roleTag,
        heatTag: heatTag,
        cardClass: cardClass
      });
    });

    return {
      cards: cards,
      details: details,
      latestSpecial: latestSpecial,
      sorted: sorted,
      latestExpect: latestExpect
    };
  },

  /**
   * 获取特码信息（使用公共计算器，消除重复代码）
   * @param {Object} item - 历史数据项
   * @returns {Object} 特码信息
   */
  _getSpecial: function(item) {
    return Utils.SpecialCalculator.getSpecial(item);
  },

  _calcBaseScores: function(missMap) {
    var scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var miss = missMap[z];
      if (miss <= 2) {
        scores[z] = Math.round(25 + (2 - miss) * 2.5);
      } else if (miss <= 6) {
        scores[z] = Math.round(18 + (6 - miss) * 1.75);
      } else if (miss <= 12) {
        scores[z] = Math.round(10 + (12 - miss) * 1.33);
      } else if (miss <= 20) {
        scores[z] = Math.round(4 + (20 - miss) * 0.75);
      } else {
        scores[z] = Math.round(2 + Math.min(2, (miss - 20) * 0.1));
      }
      scores[z] = Math.max(2, Math.min(30, scores[z]));
    });
    return scores;
  },

  _calcShapeScores: function(missMap, zodiacRecords, list, latestSpecial) {
    var scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { scores[z] = 0; });

    var sampleSize = Math.min(15, list.length);
    var oddCount = 0, bigCount = 0;
    for (var i = 0; i < sampleSize; i++) {
      var s = ZodiacPrediction._getSpecial(list[i]);
      if (s.odd) oddCount++;
      if (s.big) bigCount++;
    }
    var oddHot = oddCount / sampleSize >= 0.5;
    var bigHot = bigCount / sampleSize >= 0.5;

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var nums = DataQuery.getNumsByAttr('zodiac', z);
      var oddMatch = 0, bigMatch = 0, totalN = nums.length || 1;
      nums.forEach(function(n) {
        if (n % 2 === 1) oddMatch++;
        if (n >= 25) bigMatch++;
      });
      var oddRatio = oddMatch / totalN;
      var bigRatio = bigMatch / totalN;

      if (oddHot && oddRatio >= 0.5) scores[z] += 3;
      if (!oddHot && oddRatio < 0.5) scores[z] += 3;
      if (bigHot && bigRatio >= 0.5) scores[z] += 3;
      if (!bigHot && bigRatio < 0.5) scores[z] += 3;
    });

    var colorSample = Math.min(20, list.length);
    var colorCount = { '红': 0, '蓝': 0, '绿': 0 };
    for (var ci = 0; ci < colorSample; ci++) {
      var cs = ZodiacPrediction._getSpecial(list[ci]);
      colorCount[cs.colorName] = (colorCount[cs.colorName] || 0) + 1;
    }
    var hotColor = Object.keys(colorCount).sort(function(a, b) {
      return colorCount[b] - colorCount[a];
    })[0];

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var nums = DataQuery.getNumsByAttr('zodiac', z);
      var matchCount = 0;
      var totalN = nums.length || 1;
      nums.forEach(function(n) {
        var c = Object.keys(CONFIG.COLOR_MAP).find(function(k) {
          return CONFIG.COLOR_MAP[k].indexOf(n) !== -1;
        });
        if (c === hotColor) matchCount++;
      });
      if (matchCount / totalN >= 0.5) scores[z] += 4;
    });

    if (latestSpecial && latestSpecial.tail !== undefined) {
      var tailZods = ZodiacPrediction.TAIL_ZODIAC_MAP[latestSpecial.tail] || [];
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
        if (tailZods.indexOf(z) !== -1) scores[z] += 3;
      });
    }

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var records = zodiacRecords[z] || [];
      var recent5 = records.filter(function(r) { return r.idx < 5; });
      if (recent5.length >= 2) {
        scores[z] += 3;
      } else if (recent5.length === 1) {
        scores[z] += 1;
      }
      if (missMap[z] >= 15) {
        scores[z] += 2;
      }
      scores[z] += 2;
    });

    var wuxingCount = {};
    var wuxingSample = Math.min(10, list.length);
    for (var wi = 0; wi < wuxingSample; wi++) {
      var ws = ZodiacPrediction._getSpecial(list[wi]);
      wuxingCount[ws.wuxing] = (wuxingCount[ws.wuxing] || 0) + 1;
    }
    var hotWuxing = Object.keys(wuxingCount).sort(function(a, b) {
      return wuxingCount[b] - wuxingCount[a];
    })[0];

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var zWuxing = ZodiacPrediction.WUXING_MAP[z];
      if (zWuxing === hotWuxing) {
        scores[z] += 4;
      }
    });

    if (latestSpecial && latestSpecial.wuxing) {
      var latestWuxing = latestSpecial.wuxing;
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
        var zWuxing = ZodiacPrediction.WUXING_MAP[z];
        if (ZodiacPrediction.WUXING_SHENG[zWuxing] === latestWuxing) {
          scores[z] += 2;
        }
        if (zWuxing === latestWuxing) {
          scores[z] += 1;
        }
      });
    }

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      scores[z] = Math.min(20, scores[z]);
    });

    return scores;
  },

  _calcIntervalScores: function(list) {
    var scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { scores[z] = 0; });

    if (list.length < 2) return scores;

    var sampleSize = Math.min(50, list.length - 1);
    var intervalCount = {};
    for (var i = 0; i < sampleSize; i++) {
      var cur = ZodiacPrediction._getSpecial(list[i]);
      var prev = ZodiacPrediction._getSpecial(list[i + 1]);
      var curIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(cur.zod);
      var prevIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(prev.zod);
      if (curIdx !== -1 && prevIdx !== -1) {
        var interval = (curIdx - prevIdx + 12) % 12;
        intervalCount[interval] = (intervalCount[interval] || 0) + 1;
      }
    }

    var topIntervals = Object.keys(intervalCount)
      .map(function(k) { return { interval: Number(k), count: intervalCount[k] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 5)
      .map(function(item) { return item.interval; });

    if (topIntervals.length === 0) return scores;

    var latest = ZodiacPrediction._getSpecial(list[0]);
    var latestIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(latest.zod);
    if (latestIdx === -1) return scores;

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var zIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(z);
      var targetInterval = (zIdx - latestIdx + 12) % 12;
      if (topIntervals.indexOf(targetInterval) !== -1) {
        scores[z] = 20;
      } else {
        var minDist = Infinity;
        topIntervals.forEach(function(ti) {
          var dist = Math.abs(targetInterval - ti);
          dist = Math.min(dist, 12 - dist);
          if (dist < minDist) minDist = dist;
        });
        scores[z] = Math.max(3, Math.round(20 * Math.pow(0.82, minDist)));
      }
    });

    return scores;
  },

  _calcTrendScores: function(zodiacRecords, list) {
    var scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var records = zodiacRecords[z] || [];
      var recentCount = records.filter(function(r) { return r.idx < 10; }).length;
      var prevCount = records.filter(function(r) { return r.idx >= 10 && r.idx < 20; }).length;

      var trendScore;
      if (recentCount > prevCount) {
        trendScore = Math.min(8, (recentCount - prevCount) * 4);
      } else if (recentCount < prevCount) {
        trendScore = Math.max(-4, (recentCount - prevCount) * 2);
      } else {
        trendScore = 0;
      }
      scores[z] = Math.max(2, trendScore + 2);
    });
    return scores;
  },

  _calcMomentumScores: function(zodiacRecords, list) {
    var scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      var records = zodiacRecords[z] || [];
      var recent3 = records.filter(function(r) { return r.idx < 3; });
      var recent7 = records.filter(function(r) { return r.idx < 7; });

      if (recent3.length > 0) {
        scores[z] = 7;
      } else if (recent7.length > 0) {
        scores[z] = 4;
      } else {
        scores[z] = 2;
      }
    });
    return scores;
  },

  _applyPenaltyRules: function(sortedScores, list) {
    if (!sortedScores || sortedScores.length === 0 || list.length < 2) {
      return sortedScores;
    }

    var latestSpecial = ZodiacPrediction._getSpecial(list[0]);
    var lastZodiac = latestSpecial ? latestSpecial.zod : null;

    var window12 = list.slice(0, 12);
    var window11 = list.slice(0, 11);
    var freq12 = {};
    var freq11 = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      freq12[z] = 0;
      freq11[z] = 0;
    });
    window12.forEach(function(item) {
      var s = ZodiacPrediction._getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
        freq12[s.zod]++;
      }
    });
    window11.forEach(function(item) {
      var s = ZodiacPrediction._getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
        freq11[s.zod]++;
      }
    });

    var PENALTY_LAST = 15;
    var PENALTY_FREQ = 20;

    var result = sortedScores.map(function(entry) {
      var zodiac = entry[0];
      var score = entry[1];

      if (zodiac === lastZodiac) {
        score -= PENALTY_LAST;
      }

      if (freq12[zodiac] >= 3 && freq11[zodiac] !== 2) {
        score -= PENALTY_FREQ;
      }

      return [zodiac, Math.max(0, score)];
    });

    result.sort(function(a, b) { return b[1] - a[1]; });

    return result;
  },

  runBacktest: function(historyData) {
    if (!historyData || historyData.length < 4) return null;

    var results = [];
    for (var i = 1; i < Math.min(historyData.length - 2, 50); i++) {
      var testData = historyData.slice(i);
      var targetItem = historyData[i - 1];
      if (!targetItem) continue;

      var prediction = ZodiacPrediction.calcContinuousScores(testData);
      if (!prediction) continue;

      var top6 = prediction.sorted.slice(0, 6);

      var actualSpecial = ZodiacPrediction._getSpecial(targetItem);
      var actualZod = actualSpecial.zod;
      var actualTe = actualSpecial.te;

      var hitRank = 0;
      for (var j = 0; j < top6.length; j++) {
        if (top6[j][0] === actualZod) {
          hitRank = j + 1;
          break;
        }
      }

      var actualDet = prediction.details[actualZod] || {};

      results.push({
        expect: Number(targetItem.expect || 0),
        top6: top6.map(function(e) { return e[0]; }),
        top6Scores: top6.map(function(e) { return e[1]; }),
        actualZodiac: actualZod,
        actualTe: actualTe,
        hit: hitRank > 0,
        hitRank: hitRank,
        actualDetails: {
          base: actualDet.base || 0,
          shape: actualDet.shape || 0,
          interval: actualDet.interval || 0,
          trend: actualDet.trend || 0,
          momentum: actualDet.momentum || 0,
          miss: actualDet.miss || 0
        }
      });
    }

    var total = results.length;
    var hits = results.filter(function(r) { return r.hit; }).length;

    var summary = {
      total: total,
      hits: hits,
      hitRate: total > 0 ? Math.round(hits / total * 100) : 0,
      top1Hits: results.filter(function(r) { return r.hitRank === 1; }).length,
      top2Hits: results.filter(function(r) { return r.hitRank === 2; }).length,
      top3Hits: results.filter(function(r) { return r.hitRank === 3; }).length,
      records: results
    };

    Storage.set(Storage.KEYS.ZODIAC_BACKTEST, summary);

    return summary;
  },

  getBacktestSummary: function() {
    return Storage.get(Storage.KEYS.ZODIAC_BACKTEST, null);
  },

  analyzeBacktest: function(summary) {
    if (!summary || !summary.records || !summary.records.length) return null;

    var hits = summary.records.filter(function(r) { return r.hit; });
    var misses = summary.records.filter(function(r) { return !r.hit; });

    var dimMax = { base: 30, shape: 20, interval: 20, trend: 15, momentum: 15 };
    var dimEff = { base: 0, shape: 0, interval: 0, trend: 0, momentum: 0 };
    var dimTotal = { base: 0, shape: 0, interval: 0, trend: 0, momentum: 0 };

    hits.forEach(function(r) {
      var d = r.actualDetails;
      if (!d) return;
      var dims = ['base', 'shape', 'interval', 'trend', 'momentum'];
      dims.forEach(function(key) {
        dimEff[key] += d[key] / dimMax[key];
        dimTotal[key] += 1;
      });
    });

    misses.forEach(function(r) {
      var d = r.actualDetails;
      if (!d) return;
      var dims = ['base', 'shape', 'interval', 'trend', 'momentum'];
      dims.forEach(function(key) {
        dimTotal[key] += 1;
      });
    });

    var dimAvg = { base: 0, shape: 0, interval: 0, trend: 0, momentum: 0 };
    var dims = ['base', 'shape', 'interval', 'trend', 'momentum'];
    dims.forEach(function(key) {
      dimAvg[key] = dimTotal[key] > 0 ? dimEff[key] / dimTotal[key] : 0;
    });

    var maxEff = 0;
    dims.forEach(function(key) {
      if (dimAvg[key] > maxEff) maxEff = dimAvg[key];
    });

    var normEff = {};
    dims.forEach(function(key) {
      normEff[key] = maxEff > 0 ? Math.round(dimAvg[key] / maxEff * 100) : 0;
    });

    var totalEff = 0;
    dims.forEach(function(key) { totalEff += normEff[key]; });

    var dynWeights = {};
    dims.forEach(function(key) {
      dynWeights[key] = totalEff > 0 ? Math.round(normEff[key] / totalEff * 100) : dimMax[key];
    });

    var baseWeight = dynWeights.base;
    var shapeWeight = dynWeights.shape;
    var intervalWeight = dynWeights.interval;
    var trendWeight = dynWeights.trend;
    var momentumWeight = dynWeights.momentum;

    var hotHits = 0, coldHits = 0, totalHitRecs = 0;
    hits.forEach(function(r) {
      totalHitRecs++;
      var d = r.actualDetails;
      if (!d) return;
      if (d.miss <= 2) hotHits++;
      else if (d.miss > 12) coldHits++;
    });

    var strategy;
    var hotRatio = totalHitRecs > 0 ? hotHits / totalHitRecs : 0;
    var coldRatio = totalHitRecs > 0 ? coldHits / totalHitRecs : 0;

    if (hotRatio > 0.4) {
      strategy = '强追热';
    } else if (coldRatio > 0.4) {
      strategy = '追冷搏反弹';
    } else {
      strategy = '动态均衡';
    }

    var tuned = {
      strategy: strategy,
      weights: dynWeights,
      dimensionEff: normEff,
      hotHitRatio: Math.round(hotRatio * 100),
      coldHitRatio: Math.round(coldRatio * 100),
      detail: {
        base: baseWeight,
        shape: shapeWeight,
        interval: intervalWeight,
        trend: trendWeight,
        momentum: momentumWeight
      }
    };

    Storage.set('zodiacStrategyTuned', tuned);

    return tuned;
  },

  getTunedStrategy: function() {
    return Storage.get('zodiacStrategyTuned', null);
  },

  ZONE_MAP: { 0: '冷号区', 1: '穿插区', 2: '活跃区', 3: '热号区', 4: '过热区', 5: '降权区', 6: '封顶区' },
  ZONE_ORDER: ['冷号区', '穿插区', '活跃区', '热号区', '过热区', '降权区', '封顶区'],

  calcFrequencyRating: function(historyData) {
    if (!historyData || historyData.length < 12) return null;

    // 性能优化：一次性扁平化预处理（避免多次调用 _getSpecial）
    var flatData = historyData.map(function(item) {
      var s = ZodiacPrediction._getSpecial(item);
      return { expect: Number(item.expect || 0), zod: s.zod };
    });

    var windows = [12, 24, 36];
    var result = {};

    var missScope = Math.min(Math.min(50, historyData.length), historyData.length);
    var missList = historyData.slice(0, missScope);
    var missLatest = Number(missList[0]?.expect || 0);

    var missLastIdx = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { missLastIdx[z] = -1; });
    missList.forEach(function(item, idx) {
      var s = ZodiacPrediction._getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
        if (missLastIdx[s.zod] === -1) missLastIdx[s.zod] = idx;
      }
    });

    windows.forEach(function(w) {
      if (historyData.length < w) {
        result['p' + w] = null;
        return;
      }
      var windowData = flatData.slice(0, w);
      var freq = {};
      var posMap = {};
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { 
        freq[z] = 0; 
        posMap[z] = [];
      });

      windowData.forEach(function(item, idx) {
        if (ZodiacPrediction.ZODIAC_ORDER.indexOf(item.zod) !== -1) {
          freq[item.zod]++;
          posMap[item.zod].push(idx);
        }
      });

      var rated = [];
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
        var count = freq[z];
        // 使用统一的分区阈值配置（CONFIG.ZONE_THRESHOLDS）
        var level = ZodiacPrediction._getZoneLevel(w, count);
        var zone = ZodiacPrediction.ZONE_MAP[level];
        var miss = Utils.calcMiss(missLastIdx[z], missScope, missLatest, missList);
        
        var positions = posMap[z];
        var earliestPos = positions.length > 0 ? Math.max.apply(null, positions) : -1;
        var willDrop = false;
        var willDowngrade = false;
        if (count > 0) {
          if (earliestPos >= w - 1) {
            willDrop = true;
          } else if (earliestPos === w - 2) {
            willDowngrade = true;
          }
        }

        rated.push({
          zodiac: z,
          count: count,
          zone: zone,
          zoneLevel: level,
          miss: miss,
          earliestPos: earliestPos,
          willDrop: willDrop,
          willDowngrade: willDowngrade
        });
      });

      rated.sort(function(a, b) { return b.count - a.count || a.miss - b.miss; });
      result['p' + w] = rated;
    });

    return result;
  },

  analyzeZonePatterns: function(historyData) {
    if (!historyData || historyData.length < 25) return null;

    var windows = [12, 24, 36];
    var result = {};

    windows.forEach(function(w) {
      var zoneRecords = { '冷号区': [], '穿插区': [], '活跃区': [], '热号区': [], '过热区': [], '降权区': [], '封顶区': [] };
      var zoneHits = { '冷号区': 0, '穿插区': 0, '活跃区': 0, '热号区': 0, '过热区': 0, '降权区': 0, '封顶区': 0 };

      var maxOffset = historyData.length - w - 1;
      for (var offset = 0; offset < Math.min(maxOffset, 60); offset++) {
        var nextItem = historyData[offset];
        var windowData = historyData.slice(offset + 1, offset + 1 + w);
        if (!nextItem || windowData.length < w) continue;

        var freq = {};
        ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { freq[z] = 0; });
        windowData.forEach(function(item) {
          var s = ZodiacPrediction._getSpecial(item);
          if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) freq[s.zod]++;
        });

        var nextSpecial = ZodiacPrediction._getSpecial(nextItem);
        var nextZod = nextSpecial.zod;

        ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
          var count = freq[z];
          var level = count >= 4 ? 4 : count;
          var zone = ZodiacPrediction.ZONE_MAP[level];
          zoneRecords[zone].push(z === nextZod ? 1 : 0);
          if (z === nextZod) zoneHits[zone]++;
        });
      }

      var zoneProb = {};
      var zoneScores = {};
      ZodiacPrediction.ZONE_ORDER.forEach(function(zone) {
        var records = zoneRecords[zone] || [];
        var total = records.length;
        var hitCount = zoneHits[zone] || 0;
        if (total > 0) {
          zoneProb[zone] = Math.round(hitCount / total * 1000) / 10;
          zoneScores[zone] = Math.round(hitCount * 100);
        } else {
          zoneProb[zone] = 0;
          zoneScores[zone] = 0;
        }
      });

      result['p' + w] = {
        zoneProb: zoneProb,
        zoneScores: zoneScores,
        zoneRecords: zoneRecords
      };
    });

    return result;
  },

  _getTeColor: function(te) {
    var keys = Object.keys(CONFIG.COLOR_MAP);
    for (var i = 0; i < keys.length; i++) {
      if (CONFIG.COLOR_MAP[keys[i]].indexOf(te) !== -1) return keys[i];
    }
    return '红';
  },

  _calcHotFactors: function(historyData) {
    if (!historyData || historyData.length < 5) return null;

    var recent = historyData.slice(0, Math.min(20, historyData.length));
    var headCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    var tailCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    var colorCount = { '红': 0, '蓝': 0, '绿': 0 };
    var rangeCount = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0 };

    recent.forEach(function(item) {
      var s = ZodiacPrediction._getSpecial(item);
      headCount[s.head]++;
      tailCount[s.tail]++;
      colorCount[s.colorName]++;
      var rKey = Utils.getRangeCategory(s.te);
      rangeCount[rKey]++;
    });

    var sortDesc = function(a, b) { return b[1] - a[1]; };
    var topHead = Object.entries(headCount).sort(sortDesc);
    var topTail = Object.entries(tailCount).sort(sortDesc);
    var topColor = Object.entries(colorCount).sort(sortDesc);
    var topRange = Object.entries(rangeCount).sort(sortDesc);

    return {
      hotHeads: topHead.slice(0, 2).map(function(e) { return Number(e[0]); }),
      hotTails: topTail.slice(0, 2).map(function(e) { return Number(e[0]); }),
      hotColor: topColor[0][0],
      hotRange: topRange[0][0]
    };
  },

  _calcHotMatchScore: function(zodiac, hotFactors) {
    if (!hotFactors) return 0;

    var score = 0;
    var zodTails = [];
    var tailKeys = Object.keys(ZodiacPrediction.TAIL_ZODIAC_MAP);
    for (var ti = 0; ti < tailKeys.length; ti++) {
      var t = Number(tailKeys[ti]);
      if (ZodiacPrediction.TAIL_ZODIAC_MAP[t].indexOf(zodiac) !== -1) {
        zodTails.push(t);
      }
    }

    if (hotFactors.hotTails.some(function(ht) { return zodTails.indexOf(ht) !== -1; })) {
      score += 6;
    }

    var hasHotColor = false;
    var hasHotRange = false;
    var hasHotHead = false;

    for (var zi = 0; zi < zodTails.length; zi++) {
      var tail = zodTails[zi];
      for (var head = 0; head <= 4; head++) {
        var te = head * 10 + tail;
        if (te < 1 || te > 49) continue;
        if (ZodiacPrediction._getTeColor(te) === hotFactors.hotColor) hasHotColor = true;
        if (Utils.getRangeCategory(te) === hotFactors.hotRange) hasHotRange = true;
        if (hotFactors.hotHeads.indexOf(head) !== -1) hasHotHead = true;
      }
    }

    if (hasHotColor) score += 6;
    if (hasHotRange) score += 6;
    if (hasHotHead) score += 6;

    return score;
  },

  getZoneRecommend: function(historyData, freqResult, patternResult) {
    if (!freqResult || !freqResult.p12) return null;

    var p12 = freqResult.p12;
    var prob12 = patternResult && patternResult.p12 ? patternResult.p12.zoneProb : null;

    // === 第1步：预测最可能出现的区域（取概率最高的 2 个） ===
    var zoneRank = [];
    if (prob12) {
      ZodiacPrediction.ZONE_ORDER.forEach(function(zone) {
        zoneRank.push({ zone: zone, prob: prob12[zone] || 0 });
      });
      zoneRank.sort(function(a, b) { return b.prob - a.prob; });
    }
    var topZones = zoneRank.slice(0, 2).map(function(z) { return z.zone; });

    // === 第2步：计算近期热门头数/尾数/波色/区间 ===
    var hotFactors = ZodiacPrediction._calcHotFactors(historyData);

    // === 第3步：对每个生肖综合评分 ===
    var scored = p12.map(function(item) {
      var isInTopZone = topZones.indexOf(item.zone) !== -1;
      var zoneBonus = isInTopZone ? (prob12 ? (prob12[item.zone] || 0) : 0) : 0;
      var hotScore = ZodiacPrediction._calcHotMatchScore(item.zodiac, hotFactors);
      var missRatio = item.miss / 12;
      var missRatioScore = Math.min(12, Math.round(missRatio * 12));

      var total = Math.round(zoneBonus * 3) + hotScore + missRatioScore;

      return {
        zodiac: item.zodiac,
        zone: item.zone,
        count: item.count,
        miss: item.miss,
        score: total
      };
    });

    scored.sort(function(a, b) { return b.score - a.score; });

    var selected = scored.slice(0, 6);
    var selectedMap = {};
    selected.forEach(function(s) { selectedMap[s.zodiac] = true; });

    // === 第4步：不足6名，按遗漏值从小到大补足 ===
    if (selected.length < 6) {
      var fill = [];
      for (var i = 0; i < p12.length; i++) {
        if (fill.length >= 6 - selected.length) break;
        if (!selectedMap[p12[i].zodiac]) {
          fill.push(p12[i]);
        }
      }

      fill.sort(function(a, b) { return a.miss - b.miss; });

      for (var fi = 0; fi < fill.length; fi++) {
        selected.push({
          zodiac: fill[fi].zodiac,
          zone: fill[fi].zone,
          count: fill[fi].count,
          miss: fill[fi].miss,
          score: 0
        });
      }
    }

    return selected.map(function(s) { return [s.zodiac, s.score, s.zone]; });
  },

  runZoneBacktest: function(historyData) {
    if (!historyData || historyData.length < 16) return null;

    var results = [];
    var maxOffset = historyData.length - 14;
    for (var offset = 0; offset < Math.min(maxOffset, 40); offset++) {
      var testData = historyData.slice(offset + 1);
      var targetItem = historyData[offset];
      if (!targetItem || testData.length < 14) continue;

      var freqResult = ZodiacPrediction.calcFrequencyRating(testData);
      var patternResult = ZodiacPrediction.analyzeZonePatterns(testData);
      if (!freqResult) continue;

      var recommend = ZodiacPrediction.getZoneRecommend(testData, freqResult, patternResult);
      if (!recommend || !recommend.length) continue;

      var top6 = recommend.slice(0, 6);

      var actualSpecial = ZodiacPrediction._getSpecial(targetItem);
      var actualZod = actualSpecial.zod;

      var hitRank = 0;
      for (var j = 0; j < top6.length; j++) {
        if (top6[j][0] === actualZod) {
          hitRank = j + 1;
          break;
        }
      }

      results.push({
        expect: Number(targetItem.expect || 0),
        top6: top6.map(function(e) { return e[0]; }),
        top6Scores: top6.map(function(e) { return e[1]; }),
        actualZodiac: actualZod,
        actualTe: actualSpecial.te,
        hit: hitRank > 0,
        hitRank: hitRank
      });
    }

    var total = results.length;
    var hits = results.filter(function(r) { return r.hit; }).length;

    var summary = {
      total: total,
      hits: hits,
      hitRate: total > 0 ? Math.round(hits / total * 100) : 0,
      top1Hits: results.filter(function(r) { return r.hitRank === 1; }).length,
      top2Hits: results.filter(function(r) { return r.hitRank === 2; }).length,
      top3Hits: results.filter(function(r) { return r.hitRank === 3; }).length,
      records: results
    };

    Storage.set('zoneBacktest', summary);

    return summary;
  },

  getZoneBacktestSummary: function() {
    return Storage.get('zoneBacktest', null);
  },

  calcZodiacMissHistory: function(historyData, zodiac) {
    if (!historyData || !historyData.length || !zodiac) return null;

    var appearances = [];
    var intervals = [];

    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var s = ZodiacPrediction._getSpecial(item);
      if (s.zod === zodiac) {
        var expect = Number(item.expect || 0);
        appearances.push({
          expect: expect,
          index: i,
          interval: i > 0 ? i : 0
        });
      }
    }

    if (appearances.length === 0) return null;

    for (var j = 1; j < appearances.length; j++) {
      intervals.push(appearances[j].index - appearances[j - 1].index);
    }

    var total = 0;
    for (var k = 0; k < intervals.length; k++) {
      total += intervals[k];
    }
    var avgInterval = intervals.length > 0 ? Math.round(total / intervals.length * 10) / 10 : 0;

    var maxInterval = intervals.length > 0 ? Math.max.apply(null, intervals) : 0;
    var minInterval = intervals.length > 0 ? Math.min.apply(null, intervals) : 0;

    var currentMiss = appearances.length > 0 ? appearances[0].index : historyData.length;

    var recentAppearances = appearances.slice(0, Math.min(10, appearances.length));

    var intervalDistribution = {
      '0-5期': 0,
      '6-10期': 0,
      '11-20期': 0,
      '21-30期': 0,
      '31期以上': 0
    };

    intervals.forEach(function(interval) {
      if (interval <= 5) intervalDistribution['0-5期']++;
      else if (interval <= 10) intervalDistribution['6-10期']++;
      else if (interval <= 20) intervalDistribution['11-20期']++;
      else if (interval <= 30) intervalDistribution['21-30期']++;
      else intervalDistribution['31期以上']++;
    });

    return {
      zodiac: zodiac,
      totalAppearances: appearances.length,
      currentMiss: currentMiss,
      avgInterval: avgInterval,
      maxInterval: maxInterval,
      minInterval: minInterval,
      recentAppearances: recentAppearances,
      intervals: intervals.slice(0, 10),
      intervalDistribution: intervalDistribution,
      firstAppear: appearances[appearances.length - 1] ? appearances[appearances.length - 1].expect : null,
      lastAppear: appearances[0] ? appearances[0].expect : null
    };
  },

  calcZodiacFollowers: function(historyData, zodiac, followCount, maxAppearances) {
    if (!historyData || !historyData.length || !zodiac) return null;

    var targetAppearances = [];
    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var s = ZodiacPrediction._getSpecial(item);
      if (s.zod === zodiac) {
        targetAppearances.push({
          expect: Number(item.expect || 0),
          index: i
        });
      }
    }

    if (targetAppearances.length === 0) return null;

    var followStats = {};
    var followRecords = [];

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      followStats[z] = 0;
    });

    var maxRecords = maxAppearances || 20;
    var followLen = followCount || 4;

    var limitedAppearances = targetAppearances.slice(0, maxRecords);

    limitedAppearances.forEach(function(target) {
      var chain = [];

      for (var i = 1; i <= followLen; i++) {
        var nextIdx = target.index - i;
        if (nextIdx < 0 || nextIdx >= historyData.length) break;

        var nextItem = historyData[nextIdx];
        var nextSpecial = ZodiacPrediction._getSpecial(nextItem);
        var nextZod = nextSpecial.zod;

        chain.push({
          zodiac: nextZod,
          expect: Number(nextItem.expect || 0),
          interval: i
        });

        followStats[nextZod]++;
      }

      followRecords.push({
        expect: target.expect,
        chain: chain
      });
    });

    var sortedStats = [];
    for (var z in followStats) {
      sortedStats.push({
        zodiac: z,
        count: followStats[z],
        percentage: targetAppearances.length > 0 ? Math.round(followStats[z] / targetAppearances.length * 100) : 0
      });
    }
    sortedStats.sort(function(a, b) { return b.count - a.count; });

    return {
      zodiac: zodiac,
      targetAppearCount: limitedAppearances.length,
      followCount: followLen,
      topFollowers: sortedStats.slice(0, 12),
      followRecords: followRecords.slice(0, 10)
    };
  },

  getLatestFollowStats: function(historyData, followCount, maxAppearances) {
    if (!historyData || !historyData.length) return null;

    var latestItem = historyData[0];
    var latestSpecial = ZodiacPrediction._getSpecial(latestItem);
    var latestZod = latestSpecial.zod;
    var latestExpect = Number(latestItem.expect || 0);

    var followStats = ZodiacPrediction.calcZodiacFollowers(historyData, latestZod, followCount, maxAppearances);

    if (!followStats) return null;

    return {
      zodiac: latestZod,
      expect: latestExpect,
      topFollowers: followStats.topFollowers.slice(0, 4),
      totalFollows: followStats.targetAppearCount
    };
  },

  getLatestSizeStats: function(historyData, period) {
    if (!historyData || !historyData.length) return null;

    period = period || 10;
    var recentData = historyData.slice(0, Math.min(period, historyData.length));
    var sizeSequence = [];
    var bigCount = 0;
    var smallCount = 0;

    recentData.forEach(function(item) {
      var special = ZodiacPrediction._getSpecial(item);
      var te = special.te;
      var isBig = te >= CONFIG.BIG_RANGE[0] && te <= CONFIG.BIG_RANGE[1];
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

    var patterns = ZodiacPrediction._analyzeSizePatterns(sizeSequence);
    var trend = ZodiacPrediction._predictSizeTrend(sizeSequence);

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

    var patterns = [];
    var currentStreak = 1;
    var streakType = sequence[0].size;

    for (var i = 1; i < sequence.length; i++) {
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

    var alternations = 0;
    for (var j = 1; j < sequence.length - 1; j++) {
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

    var last5 = sequence.slice(0, 5);
    var last3 = sequence.slice(0, 3);

    var bigCount = last5.filter(function(s) { return s.size === '大'; }).length;
    var smallCount = last5.filter(function(s) { return s.size === '小'; }).length;
    var bigRatio = bigCount / 5;
    var smallRatio = smallCount / 5;

    var scoreBig = 0;
    var scoreSmall = 0;
    var reasons = [];

    var allBig3 = last3.every(function(s) { return s.size === '大'; });
    var allSmall3 = last3.every(function(s) { return s.size === '小'; });

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
      var prev2 = sequence[2].size;
      if (prev2 === '大' && last3[0].size === '小') {
        scoreBig += 15;
        reasons.push('大→小后常转大');
      } else if (prev2 === '小' && last3[0].size === '大') {
        scoreSmall += 15;
        reasons.push('小→大后常转小');
      }
    }

    var recent2Same = last3[0].size === last3[1].size;
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

    var totalScore = scoreBig + scoreSmall;
    var prediction, confidence;

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

    var topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  },

  getLatestOddEvenStats: function(historyData, period) {
  if (!historyData || !historyData.length) return null;

  period = period || 10;
  var recentData = historyData.slice(0, Math.min(period, historyData.length));
  var oddEvenSequence = [];
  var oddCount = 0;
  var evenCount = 0;

  recentData.forEach(function(item) {
    var special = ZodiacPrediction._getSpecial(item);
    var te = special.te;
    var isOdd = te % 2 !== 0;
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

  var patterns = ZodiacPrediction._analyzeOddEvenPatterns(oddEvenSequence);
  var trend = ZodiacPrediction._predictOddEvenTrend(oddEvenSequence);

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

  var patterns = [];
  var currentStreak = 1;
  var streakType = sequence[0].type;

  for (var i = 1; i < sequence.length; i++) {
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

  var alternations = 0;
  for (var j = 1; j < sequence.length - 1; j++) {
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

  var last5 = sequence.slice(0, 5);
  var last3 = sequence.slice(0, 3);

  var oddCount = last5.filter(function(s) { return s.type === '单'; }).length;
  var evenCount = last5.filter(function(s) { return s.type === '双'; }).length;
  var oddRatio = oddCount / 5;
  var evenRatio = evenCount / 5;

  var scoreOdd = 0;
  var scoreEven = 0;
  var reasons = [];

  var allOdd3 = last3.every(function(s) { return s.type === '单'; });
  var allEven3 = last3.every(function(s) { return s.type === '双'; });

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
    var prev2 = sequence[2].type;
    if (prev2 === '单' && last3[0].type === '双') {
      scoreOdd += 15;
      reasons.push('单→双后常转单');
    } else if (prev2 === '双' && last3[0].type === '单') {
      scoreEven += 15;
      reasons.push('双→单后常转双');
    }
  }

  var recent2Same = last3[0].type === last3[1].type;
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

  var totalScore = scoreOdd + scoreEven;
  var prediction, confidence;

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

  var topReasons = reasons.slice(0, 2).join('; ');
  return { prediction: prediction, confidence: confidence, reason: topReasons };
},

  getLatestWuxingStats: function(historyData, period) {
    if (!historyData || !historyData.length) return null;

    period = period || 10;
    var recentData = historyData.slice(0, Math.min(period, historyData.length));
    var wuxingSequence = [];
    var wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };

    recentData.forEach(function(item) {
      var special = ZodiacPrediction._getSpecial(item);
      var wuxing = special.wuxing;
      wuxingSequence.push({
        expect: item.expect,
        number: special.te,
        wuxing: wuxing
      });
      if (wuxingCount[wuxing] !== undefined) {
        wuxingCount[wuxing]++;
      }
    });

    var patterns = ZodiacPrediction._analyzeWuxingPatterns(wuxingSequence);
    var trend = ZodiacPrediction._predictWuxingTrend(wuxingSequence);

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

    var patterns = [];
    var currentStreak = 1;
    var streakType = sequence[0].wuxing;

    for (var i = 1; i < sequence.length; i++) {
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

    var hotWuxing = {};
    sequence.forEach(function(item) {
      hotWuxing[item.wuxing] = (hotWuxing[item.wuxing] || 0) + 1;
    });

    var sortedWuxing = Object.keys(hotWuxing).sort(function(a, b) {
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

    var last5 = sequence.slice(0, 5);
    var last3 = sequence.slice(0, 3);

    var wuxingScores = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    var reasons = [];

    var allSame3 = last3.every(function(s) { return s.wuxing === last3[0].wuxing; });
    if (allSame3) {
      var otherWuxings = ['金', '木', '水', '火', '土'].filter(function(w) { return w !== last3[0].wuxing; });
      otherWuxings.forEach(function(w) { wuxingScores[w] += 20; });
      reasons.push('连续3期' + last3[0].wuxing + '(分散信号)');
    }

    var last5Count = {};
    last5.forEach(function(s) {
      last5Count[s.wuxing] = (last5Count[s.wuxing] || 0) + 1;
    });

    Object.keys(last5Count).forEach(function(wx) {
      if (last5Count[wx] >= 3) {
        var bonus = (last5Count[wx] - 2) * 8;
        var others = ['金', '木', '水', '火', '土'].filter(function(w) { return w !== wx; });
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

    var wuxingOrder = ['金', '木', '水', '火', '土'];
    var lastIndex = wuxingOrder.indexOf(last3[0].wuxing);
    if (lastIndex !== -1) {
      var nextWuxing = wuxingOrder[(lastIndex + 1) % 5];
      wuxingScores[nextWuxing] += 10;
      reasons.push(nextWuxing + '为下一顺位');
    }

    var maxScore = -1;
    var prediction = '-';
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

    var confidence = Math.min(72, 42 + Math.round((maxScore / 50) * 30));
    var topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  },

  getLatestColorStats: function(historyData, period) {
    if (!historyData || !historyData.length) return null;

    period = period || 10;
    var recentData = historyData.slice(0, Math.min(period, historyData.length));
    var colorSequence = [];
    var colorCount = { '红': 0, '蓝': 0, '绿': 0 };

    recentData.forEach(function(item) {
      var special = ZodiacPrediction._getSpecial(item);
      var colorName = special.colorName;
      colorSequence.push({
        expect: item.expect,
        number: special.te,
        color: colorName
      });
      if (colorCount[colorName] !== undefined) {
        colorCount[colorName]++;
      }
    });

    var patterns = ZodiacPrediction._analyzeColorPatterns(colorSequence);
    var trend = ZodiacPrediction._predictColorTrend(colorSequence);

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

    var patterns = [];
    var currentStreak = 1;
    var streakType = sequence[0].color;

    for (var i = 1; i < sequence.length; i++) {
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

    var hotColor = {};
    sequence.forEach(function(item) {
      hotColor[item.color] = (hotColor[item.color] || 0) + 1;
    });

    var sortedColor = Object.keys(hotColor).sort(function(a, b) {
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

    var last5 = sequence.slice(0, 5);
    var last3 = sequence.slice(0, 3);

    var colorScores = { '红': 0, '蓝': 0, '绿': 0 };
    var reasons = [];

    var allSame3 = last3.every(function(s) { return s.color === last3[0].color; });
    if (allSame3) {
      var otherColors = ['红', '蓝', '绿'].filter(function(c) { return c !== last3[0].color; });
      otherColors.forEach(function(c) { colorScores[c] += 20; });
      reasons.push('连续3期' + last3[0].color + '(分散信号)');
    }

    var last5Count = {};
    last5.forEach(function(s) {
      last5Count[s.color] = (last5Count[s.color] || 0) + 1;
    });

    Object.keys(last5Count).forEach(function(cl) {
      if (last5Count[cl] >= 3) {
        var bonus = (last5Count[cl] - 2) * 8;
        var otherCls = ['红', '蓝', '绿'].filter(function(c) { return c !== cl; });
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

    var maxScore = -1;
    var prediction = '-';
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

    var confidence = Math.min(72, 42 + Math.round((maxScore / 50) * 30));
    var topReasons = reasons.slice(0, 2).join('; ');
    return { prediction: prediction, confidence: confidence, reason: topReasons };
  },

  _runGenericBacktest: function(historyData, testCount, config) {
    if (!historyData || historyData.length < 10) return null;

    testCount = Math.min(testCount || 12, 12);
    var results = [];
    var maxOffset = Math.min(testCount, historyData.length - 6);

    for (var offset = 0; offset < maxOffset; offset++) {
      var targetItem = historyData[offset];
      if (!targetItem) continue;

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

      var predictedValue = '-';
      var confidence = 45;

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
        var special = ZodiacPrediction._getSpecial(item);
        return special.te >= CONFIG.BIG_RANGE[0] && special.te <= CONFIG.BIG_RANGE[1] ? '大' : '小';
      },
      getNumber: function(item) {
        return ZodiacPrediction._getSpecial(item).te;
      },
      fieldNames: { predicted: 'predictedSize', actual: 'actualSize' },
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
      fallbackConfidence: 45
    });
  },

  runOddEvenBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['单', '双'],
      extractValue: function(item) {
        var special = ZodiacPrediction._getSpecial(item);
        return special.te % 2 !== 0 ? '单' : '双';
      },
      getNumber: function(item) {
        return ZodiacPrediction._getSpecial(item).te;
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
      fallbackConfidence: 45
    });
  },

  runWuxingBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['金', '木', '水', '火', '土'],
      extractValue: function(item) {
        var special = ZodiacPrediction._getSpecial(item);
        return special.wuxing || '金';
      },
      getNumber: function(item) {
        return ZodiacPrediction._getSpecial(item).te;
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
      fallbackConfidence: 40
    });
  },

  runColorBacktest: function(historyData, testCount) {
    return ZodiacPrediction._runGenericBacktest(historyData, testCount, {
      categories: ['红', '蓝', '绿'],
      extractValue: function(item) {
        var special = ZodiacPrediction._getSpecial(item);
        var colorName = special.colorName || '红';
        if (!['红', '蓝', '绿'].includes(colorName)) colorName = '红';
        return colorName;
      },
      getNumber: function(item) {
        return ZodiacPrediction._getSpecial(item).te;
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
      fallbackConfidence: 40
    });
  },

  /**
   * 区域变动追踪：统计每期开出生肖的原区域，并分析最近12期区域变动情况
   * @param {Array} historyData - 历史数据（倒序，[0]为最新）
   * @param {number} [windowSize=12] - 滑动窗口大小（12/24/36）
   * @returns {Object|null} { records, sourceZoneCount, topZone, topCount, windowSize }
   */
  calcZoneChangeTracking: function(historyData, windowSize) {
    windowSize = windowSize || 12;
    var minData = windowSize + 1;
    if (!historyData || historyData.length < minData) return null;

    var ZONE_MAP = ZodiacPrediction.ZONE_MAP;
    var ZONE_ORDER = ZodiacPrediction.ZONE_ORDER;
    var ZODIAC_ORDER = ZodiacPrediction.ZODIAC_ORDER;

    // 性能优化：扁平化预处理
    var flatData = historyData.map(function(item) {
      var s = ZodiacPrediction._getSpecial(item);
      return { expect: Number(item.expect || 0), zod: s.zod };
    });

    // 统计最近12期各原区域"输出"次数
    var sourceZoneCount = {};
    ZONE_ORDER.forEach(function(z) { sourceZoneCount[z] = 0; });

    var records = [];
    var maxRecords = Math.min(12, flatData.length - windowSize);

    for (var i = 0; i < maxRecords; i++) {
      var curItem = flatData[i];
      var zodiac = curItem.zod;

      if (ZODIAC_ORDER.indexOf(zodiac) === -1) continue;

      // 开出前的窗口（不含当期）
      var prevWindow = flatData.slice(i + 1, i + 1 + windowSize);

      var prevCount = 0;
      prevWindow.forEach(function(item) {
        if (item.zod === zodiac) prevCount++;
      });

      var prevLevel = ZodiacPrediction._getZoneLevel(windowSize, prevCount);
      var prevZone = ZONE_MAP[prevLevel];

      // 开出后的窗口（含当期）
      var curWindow = flatData.slice(i, i + windowSize);

      var curCount = 0;
      curWindow.forEach(function(item) {
        if (item.zod === zodiac) curCount++;
      });

      var curLevel = ZodiacPrediction._getZoneLevel(windowSize, curCount);
      var curZone = ZONE_MAP[curLevel];

      // 计算遗漏间隔：距离上一次出现该生肖的期数
      var missInterval = -1;
      for (var j = i + 1; j < flatData.length; j++) {
        if (flatData[j].zod === zodiac) { missInterval = j - i; break; }
      }

      records.push({
        expect: curItem.expect,
        zodiac: zodiac,
        prevZone: prevZone,
        prevCount: prevCount,
        curZone: curZone,
        curCount: curCount,
        changed: prevZone !== curZone,
        missInterval: missInterval
      });

      sourceZoneCount[prevZone]++;
    }

    // 找出变动最多的原区域
    var topZone = '';
    var topCount = 0;
    Object.keys(sourceZoneCount).forEach(function(zone) {
      if (sourceZoneCount[zone] > topCount) {
        topCount = sourceZoneCount[zone];
        topZone = zone;
      }
    });

    return {
      records: records,
      sourceZoneCount: sourceZoneCount,
      topZone: topZone,
      topCount: topCount,
      windowSize: windowSize
    };
  },

  /**
   * 根据窗口大小与出现次数返回分区级别（统一来源，CONFIG.ZONE_THRESHOLDS）
   * @param {number} windowSize - 窗口大小（12/24/36）
   * @param {number} count - 出现次数
   * @returns {number} 分区级别 0-6
   */
  _getZoneLevel: function(windowSize, count) {
    var thresholds = CONFIG.ZONE_THRESHOLDS[windowSize] || CONFIG.ZONE_THRESHOLDS[12];
    // 阈值数组按 [封顶,降权,热号,穿插,冷号,活跃,过热] 顺序排列
    // 12期只有4级分区，跳过活跃(2)和过热(4)级别
    if (windowSize === 12) {
      if (count >= thresholds[0]) return 6; // 封顶区
      if (count >= thresholds[1]) return 5; // 降权区
      if (count >= thresholds[2]) return 3; // 热号区（12期跳过活跃和过热）
      if (count >= thresholds[3]) return 1; // 穿插区
      return 0;                              // 冷号区
    }
    // 24/36期 7级分区
    if (count >= thresholds[0]) return 6; // 封顶区
    if (count >= thresholds[1]) return 5; // 降权区
    if (count >= thresholds[2]) return 4; // 过热区
    if (count >= thresholds[3]) return 3; // 热号区
    if (count >= thresholds[4]) return 2; // 活跃区
    if (count >= thresholds[5]) return 1; // 穿插区
    return 0;                              // 冷号区
  },

  /**
   * 综合三个推荐源，计算未被推荐的所有生肖
   * @param {Array} v1List - v1 推荐列表 [{zodiac}, ...]
   * @param {Array} v2List - v2 推荐列表 [{zodiac}, ...]
   * @param {Array} ultimateList - 终极推荐列表 [{zodiac}, ...] (主推+备选)
   * @returns {Array} 未推荐生肖列表 [{zodiac, emoji, sources:[v1,v2,ultimate]}, ...]
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

    // 找未被任一源推荐的生肖
    var unrecommended = [];
    all.forEach(function(z) {
      var inV1 = !!sources.v1[z];
      var inV2 = !!sources.v2[z];
      var inUlt = !!sources.ultimate[z];
      if (!inV1 && !inV2 && !inUlt) {
        unrecommended.push({
          zodiac: z,
          emoji: ZodiacPrediction.getZodiacEmoji(z)
        });
      }
    });
    return unrecommended;
  }
};