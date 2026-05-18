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

  _getSpecial: function(item) {
    var codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
    var zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
    var zodArr = zodArrRaw.map(function(z) {
      return CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z;
    });
    var te = Math.max(0, Number(codeArr[6]));

    var colorName = Object.keys(CONFIG.COLOR_MAP).find(function(c) {
      return CONFIG.COLOR_MAP[c].indexOf(te) !== -1;
    }) || '红';

    var wuxing = Object.keys(CONFIG.ELEMENT_MAP).find(function(e) {
      return CONFIG.ELEMENT_MAP[e].indexOf(te) !== -1;
    }) || '金';

    return {
      te: te,
      tail: te % 10,
      head: Math.floor(te / 10),
      zod: zodArr[6] || '-',
      odd: te % 2 === 1,
      big: te >= 25,
      colorName: colorName,
      wuxing: wuxing,
      animal: CONFIG.ANALYSIS.HOME_ZODIAC.indexOf(zodArr[6]) !== -1 ? '家禽' : '野兽'
    };
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

  ZONE_MAP: { 0: '等待区', 1: '低频区', 2: '中频区', 3: '高频区', 4: '顶峰区' },
  ZONE_ORDER: ['等待区', '低频区', '中频区', '高频区', '顶峰区'],

  calcFrequencyRating: function(historyData) {
    if (!historyData || historyData.length < 12) return null;

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
      var windowData = historyData.slice(0, w);
      var freq = {};
      var posMap = {};
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { 
        freq[z] = 0; 
        posMap[z] = [];
      });

      windowData.forEach(function(item, idx) {
        var s = ZodiacPrediction._getSpecial(item);
        if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
          freq[s.zod]++;
          posMap[s.zod].push(idx);
        }
      });

      var rated = [];
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
        var count = freq[z];
        var level = count >= 4 ? 4 : count;
        var zone = ZodiacPrediction.ZONE_MAP[level];
        var miss = Utils.calcMiss(missLastIdx[z], missScope, missLatest, missList);
        
        var positions = posMap[z];
        var earliestPos = positions.length > 0 ? Math.max.apply(null, positions) : -1;
        var willDrop = false;
        if (count > 0 && earliestPos >= w - 1) {
          willDrop = true;
        }
        
        rated.push({
          zodiac: z,
          count: count,
          zone: zone,
          zoneLevel: level,
          miss: miss,
          earliestPos: earliestPos,
          willDrop: willDrop
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
      var zoneRecords = { '等待区': [], '低频区': [], '中频区': [], '高频区': [], '顶峰区': [] };
      var zoneHits = { '等待区': 0, '低频区': 0, '中频区': 0, '高频区': 0, '顶峰区': 0 };

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
  }
};