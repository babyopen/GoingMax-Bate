/**
 * 业务层：生肖连续分数计算与策略调优（拆分自 business-zodiac-prediction.js，2026-06-05）
 * @namespace ZodiacPredictionScores
 * 包含：
 *   - calcContinuousScores
 *   - _calcBaseScores / _calcShapeScores / _calcIntervalScores / _calcTrendScores / _calcMomentumScores
 *   - _applyPenaltyRules
 *   - runBacktest / getBacktestSummary / analyzeBacktest / getTunedStrategy
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ZodiacPrediction.xxx() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - 内部使用 `ZodiacPrediction.xxx` 引用门面上的共享数据/工具（运行时查找）
 */
const ZodiacPredictionScores = {
  calcContinuousScores: function(historyData) {
    if (!historyData || !historyData.length) return null;

    const list = historyData;
    const total = list.length;
    const latestExpect = Number(list[0]?.expect || 0);

    // v2.5.0 性能优化：预计算全量 specials（一次 batchGetSpecial，循环内 O(1) 取值）
    const allSpecials = BusinessCommonSpecials.buildWindowed(list);

    const lastAppearIdx = {};
    const zodiacRecords = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      lastAppearIdx[z] = -1;
      zodiacRecords[z] = [];
    });

    list.forEach(function(item, idx) {
      const s = allSpecials[idx];
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

    const missMap = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      missMap[z] = Utils.calcMiss(lastAppearIdx[z], total, latestExpect, list);
    });

    const latestItem = list[0];
    const latestSpecial = latestItem ? allSpecials[0] : null;

    const baseScores = ZodiacPrediction._calcBaseScores(missMap);
    const shapeScores = ZodiacPrediction._calcShapeScores(missMap, zodiacRecords, list, latestSpecial);
    const intervalScores = ZodiacPrediction._calcIntervalScores(list);
    const trendScores = ZodiacPrediction._calcTrendScores(zodiacRecords, list);
    const momentumScores = ZodiacPrediction._calcMomentumScores(zodiacRecords, list);

    const scores = {};
    const details = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const base = baseScores[z] || 0;
      const shape = shapeScores[z] || 0;
      const interval = intervalScores[z] || 0;
      const trend = trendScores[z] || 0;
      const momentum = momentumScores[z] || 0;
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

    let sorted = Object.entries(scores).sort(function(a, b) { return b[1] - a[1]; });

    sorted = ZodiacPrediction._applyPenaltyRules(sorted, list);

    const maxScore = sorted.length > 0 ? sorted[0][1] : 0;
    const minScore = sorted.length > 0 ? sorted[sorted.length - 1][1] : 0;
    const scoreRange = maxScore - minScore || 1;

    const cards = [];
    sorted.forEach(function(entry, idx) {
      const zod = entry[0];
      const rawScore = entry[1];
      let normalizedScore = Math.round(((rawScore - minScore) / scoreRange) * 40 + 45);
      normalizedScore = Math.max(0, Math.min(100, normalizedScore));

      const det = details[zod];
      const heatTag = det.base >= 25 ? '热号' : (det.base >= 10 ? '温号' : '冷号');
      let roleTag = '';
      let cardClass = '';

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

  _calcBaseScores: function(missMap) {
    const scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const miss = missMap[z];
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
    const scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { scores[z] = 0; });

    const sampleSize = Math.min(15, list.length);
    let oddCount = 0, bigCount = 0;
    for (let i = 0; i < sampleSize; i++) {
      const s = Utils.SpecialCalculator.getSpecial(list[i]);
      if (s.odd) oddCount++;
      if (s.big) bigCount++;
    }
    const oddHot = oddCount / sampleSize >= 0.5;
    const bigHot = bigCount / sampleSize >= 0.5;

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const nums = DataQuery.getNumsByAttr('zodiac', z);
      let oddMatch = 0, bigMatch = 0;
      const totalN = nums.length || 1;
      nums.forEach(function(n) {
        if (n % 2 === 1) oddMatch++;
        if (n >= 25) bigMatch++;
      });
      const oddRatio = oddMatch / totalN;
      const bigRatio = bigMatch / totalN;

      if (oddHot && oddRatio >= 0.5) scores[z] += 3;
      if (!oddHot && oddRatio < 0.5) scores[z] += 3;
      if (bigHot && bigRatio >= 0.5) scores[z] += 3;
      if (!bigHot && bigRatio < 0.5) scores[z] += 3;
    });

    const colorSample = Math.min(20, list.length);
    const colorCount = { '红': 0, '蓝': 0, '绿': 0 };
    for (let ci = 0; ci < colorSample; ci++) {
      const cs = Utils.SpecialCalculator.getSpecial(list[ci]);
      colorCount[cs.colorName] = (colorCount[cs.colorName] || 0) + 1;
    }
    const hotColor = Object.keys(colorCount).sort(function(a, b) {
      return colorCount[b] - colorCount[a];
    })[0];

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const nums = DataQuery.getNumsByAttr('zodiac', z);
      let matchCount = 0;
      const totalN = nums.length || 1;
      nums.forEach(function(n) {
        const c = Utils.getColorName(n);
        if (c === hotColor) matchCount++;
      });
      if (matchCount / totalN >= 0.5) scores[z] += 4;
    });

    if (latestSpecial && latestSpecial.tail !== undefined) {
      const tailZods = ZodiacPrediction.TAIL_ZODIAC_MAP[latestSpecial.tail] || [];
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
        if (tailZods.indexOf(z) !== -1) scores[z] += 3;
      });
    }

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const records = zodiacRecords[z] || [];
      const recent5 = records.filter(function(r) { return r.idx < 5; });
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

    const wuxingCount = {};
    const wuxingSample = Math.min(10, list.length);
    for (let wi = 0; wi < wuxingSample; wi++) {
      const ws = Utils.SpecialCalculator.getSpecial(list[wi]);
      wuxingCount[ws.wuxing] = (wuxingCount[ws.wuxing] || 0) + 1;
    }
    const hotWuxing = Object.keys(wuxingCount).sort(function(a, b) {
      return wuxingCount[b] - wuxingCount[a];
    })[0];

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const zWuxing = ZodiacPrediction.WUXING_MAP[z];
      if (zWuxing === hotWuxing) {
        scores[z] += 4;
      }
    });

    if (latestSpecial && latestSpecial.wuxing) {
      const latestWuxing = latestSpecial.wuxing;
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
        const zWuxing = ZodiacPrediction.WUXING_MAP[z];
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
    const scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { scores[z] = 0; });

    if (list.length < 2) return scores;

    const sampleSize = Math.min(50, list.length - 1);
    const intervalCount = {};
    for (let i = 0; i < sampleSize; i++) {
      const cur = Utils.SpecialCalculator.getSpecial(list[i]);
      const prev = Utils.SpecialCalculator.getSpecial(list[i + 1]);
      const curIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(cur.zod);
      const prevIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(prev.zod);
      if (curIdx !== -1 && prevIdx !== -1) {
        const interval = (curIdx - prevIdx + 12) % 12;
        intervalCount[interval] = (intervalCount[interval] || 0) + 1;
      }
    }

    const topIntervals = Object.keys(intervalCount)
      .map(function(k) { return { interval: Number(k), count: intervalCount[k] }; })
      .sort(function(a, b) { return b.count - a.count; })
      .slice(0, 5)
      .map(function(item) { return item.interval; });

    if (topIntervals.length === 0) return scores;

    const latest = Utils.SpecialCalculator.getSpecial(list[0]);
    const latestIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(latest.zod);
    if (latestIdx === -1) return scores;

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const zIdx = ZodiacPrediction.ZODIAC_ORDER.indexOf(z);
      const targetInterval = (zIdx - latestIdx + 12) % 12;
      if (topIntervals.indexOf(targetInterval) !== -1) {
        scores[z] = 20;
      } else {
        let minDist = Infinity;
        topIntervals.forEach(function(ti) {
          let dist = Math.abs(targetInterval - ti);
          dist = Math.min(dist, 12 - dist);
          if (dist < minDist) minDist = dist;
        });
        scores[z] = Math.max(3, Math.round(20 * Math.pow(0.82, minDist)));
      }
    });

    return scores;
  },

  _calcTrendScores: function(zodiacRecords, _list) {
    const scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const records = zodiacRecords[z] || [];
      const recentCount = records.filter(function(r) { return r.idx < 10; }).length;
      const prevCount = records.filter(function(r) { return r.idx >= 10 && r.idx < 20; }).length;

      let trendScore;
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

  _calcMomentumScores: function(zodiacRecords, _list) {
    const scores = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      const records = zodiacRecords[z] || [];
      const recent3 = records.filter(function(r) { return r.idx < 3; });
      const recent7 = records.filter(function(r) { return r.idx < 7; });

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

    const latestSpecial = Utils.SpecialCalculator.getSpecial(list[0]);
    const lastZodiac = latestSpecial ? latestSpecial.zod : null;

    const window12 = list.slice(0, 12);
    const window11 = list.slice(0, 11);
    const freq12 = {};
    const freq11 = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      freq12[z] = 0;
      freq11[z] = 0;
    });
    window12.forEach(function(item) {
      const s = Utils.SpecialCalculator.getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
        freq12[s.zod]++;
      }
    });
    window11.forEach(function(item) {
      const s = Utils.SpecialCalculator.getSpecial(item);
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
        freq11[s.zod]++;
      }
    });

    const PENALTY_LAST = 15;
    const PENALTY_FREQ = 20;

    const result = sortedScores.map(function(entry) {
      const zodiac = entry[0];
      let score = entry[1];

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

    // v2.5.0 性能优化：预计算全量 specials，循环内 O(1) 取值
    const allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    const results = [];
    for (let i = 1; i < Math.min(historyData.length - 2, 50); i++) {
      const testData = historyData.slice(i);
      const targetItem = historyData[i - 1];
      if (!targetItem) continue;

      const prediction = ZodiacPrediction.calcContinuousScores(testData);
      if (!prediction) continue;

      const top6 = prediction.sorted.slice(0, 6);

      const actualSpecial = allSpecials[i - 1];
      const actualZod = actualSpecial.zod;
      const actualTe = actualSpecial.te;

      let hitRank = 0;
      for (let j = 0; j < top6.length; j++) {
        if (top6[j][0] === actualZod) {
          hitRank = j + 1;
          break;
        }
      }

      const actualDet = prediction.details[actualZod] || {};

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

    const total = results.length;
    const hits = results.filter(function(r) { return r.hit }).length;

    const summary = {
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

    const hits = summary.records.filter(function(r) { return r.hit; });
    const misses = summary.records.filter(function(r) { return !r.hit; });

    const dimMax = { base: 30, shape: 20, interval: 20, trend: 15, momentum: 15 };
    const dimEff = { base: 0, shape: 0, interval: 0, trend: 0, momentum: 0 };
    const dimTotal = { base: 0, shape: 0, interval: 0, trend: 0, momentum: 0 };

    hits.forEach(function(r) {
      const d = r.actualDetails;
      if (!d) return;
      const dims = ['base', 'shape', 'interval', 'trend', 'momentum'];
      dims.forEach(function(key) {
        dimEff[key] += d[key] / dimMax[key];
        dimTotal[key] += 1;
      });
    });

    misses.forEach(function(r) {
      const d = r.actualDetails;
      if (!d) return;
      const dims = ['base', 'shape', 'interval', 'trend', 'momentum'];
      dims.forEach(function(key) {
        dimTotal[key] += 1;
      });
    });

    const dimAvg = { base: 0, shape: 0, interval: 0, trend: 0, momentum: 0 };
    const dims = ['base', 'shape', 'interval', 'trend', 'momentum'];
    dims.forEach(function(key) {
      dimAvg[key] = dimTotal[key] > 0 ? dimEff[key] / dimTotal[key] : 0;
    });

    let maxEff = 0;
    dims.forEach(function(key) {
      if (dimAvg[key] > maxEff) maxEff = dimAvg[key];
    });

    const normEff = {};
    dims.forEach(function(key) {
      normEff[key] = maxEff > 0 ? Math.round(dimAvg[key] / maxEff * 100) : 0;
    });

    let totalEff = 0;
    dims.forEach(function(key) { totalEff += normEff[key]; });

    const dynWeights = {};
    dims.forEach(function(key) {
      dynWeights[key] = totalEff > 0 ? Math.round(normEff[key] / totalEff * 100) : dimMax[key];
    });

    const baseWeight = dynWeights.base;
    const shapeWeight = dynWeights.shape;
    const intervalWeight = dynWeights.interval;
    const trendWeight = dynWeights.trend;
    const momentumWeight = dynWeights.momentum;

    let hotHits = 0, coldHits = 0, totalHitRecs = 0;
    hits.forEach(function(r) {
      totalHitRecs++;
      const d = r.actualDetails;
      if (!d) return;
      if (d.miss <= 2) hotHits++;
      else if (d.miss > 12) coldHits++;
    });

    let strategy;
    const hotRatio = totalHitRecs > 0 ? hotHits / totalHitRecs : 0;
    const coldRatio = totalHitRecs > 0 ? coldHits / totalHitRecs : 0;

    if (hotRatio > 0.4) {
      strategy = '强追热';
    } else if (coldRatio > 0.4) {
      strategy = '追冷搏反弹';
    } else {
      strategy = '动态均衡';
    }

    const tuned = {
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
  }
};

// ============================================================
// v2.0.8 性能优化：高频函数 LRU 包装（以 historyData 引用为 key）
//   - 视图层频繁刷新（如切换标签、重新渲染）时，同一 historyData 引用命中缓存
//   - historyData 数组重新生成（数据刷新）时自动失效旧缓存
//   - 仅包装 read-only 计算函数，不包装有副作用或依赖随机数的函数
// ============================================================
if (typeof BusinessCommonLRU !== 'undefined' && BusinessCommonLRU) {
  ZodiacPredictionScores.calcContinuousScores = BusinessCommonLRU.withHistoryLRU(
    ZodiacPredictionScores.calcContinuousScores,
    20 // 历史数据通常 1-2 份（当前 + 预加载），20 条容量足够
  );
}

// 兼容路径：挂载到 ZodiacPrediction，使所有业务/视图/event.js 中 ZodiacPrediction.xxx() 调用不变
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionScores);
}
