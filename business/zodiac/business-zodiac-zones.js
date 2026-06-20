/**
 * 业务层：生肖区域分析与推荐（拆分自 business-zodiac-prediction.js，2026-06-05）
 * @namespace ZodiacPredictionZones
 * 包含：
 *   - ZONE_MAP / ZONE_ORDER（共享数据）
 *   - calcFrequencyRating
 *   - analyzeZonePatterns
 *   - _getTeColor / _calcHotFactors / _calcHotMatchScore
 *   - getZoneRecommend / runZoneBacktest / getZoneBacktestSummary
 *   - calcZoneChangeTracking / _getZoneLevel
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ZodiacPrediction.xxx() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - ZONE_MAP/ZONE_ORDER 在子模块定义后挂载到门面共享
 */
const ZodiacPredictionZones = {
  ZONE_MAP: { 0: '冷号区', 1: '穿插区', 2: '活跃区', 3: '热号区', 4: '过热区', 5: '降权区', 6: '封顶区' },
  ZONE_ORDER: ['冷号区', '穿插区', '活跃区', '热号区', '过热区', '降权区', '封顶区'],

  calcFrequencyRating: function(historyData, precomputedSpecials) {
    if (!historyData || historyData.length < 12) return null;

    // 2026-06-21 性能优化：允许调用方传入预计算的 specials 数组（避免内层循环重复 getSpecial）
    //   - 不传时：保持原行为，逐项 getSpecial（向后兼容）
    //   - 传入时：与 historyData 等长的 specials 数组，specials[i] 对应 historyData[i]
    var specials = precomputedSpecials;
    if (!specials) {
      specials = historyData.map(function(item) {
        return Utils.SpecialCalculator.getSpecial(item);
      });
    }

    // 性能优化：一次性扁平化预处理（避免多次调用 _getSpecial）
    var flatData = historyData.map(function(item, i) {
      return { expect: Number(item.expect || 0), zod: specials[i].zod };
    });

    var windows = [12, 24, 36];
    var result = {};

    var missScope = Math.min(Math.min(50, historyData.length), historyData.length);
    var missList = historyData.slice(0, missScope);
    var missLatest = Number(missList[0]?.expect || 0);

    var missLastIdx = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { missLastIdx[z] = -1; });
    missList.forEach(function(_, idx) {
      var s = specials[idx];
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

  analyzeZonePatterns: function(historyData, precomputedSpecials) {
    if (!historyData || historyData.length < 37) return null;

    // 2026-06-21 性能优化：允许调用方传入预计算的 specials 数组
    var specials = precomputedSpecials;
    if (!specials) {
      specials = historyData.map(function(item) {
        return Utils.SpecialCalculator.getSpecial(item);
      });
    }

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
        // 2026-06-21 优化：用 specials 替代 getSpecial 调用
        for (var wi = 0; wi < windowData.length; wi++) {
          var s = specials[offset + 1 + wi];
          if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) freq[s.zod]++;
        }

        var nextSpecial = specials[offset];
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
      var s = Utils.SpecialCalculator.getSpecial(item);
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

    // 2026-06-21 性能优化：预计算 specials（一次性，复用 LRU 缓存）
    //  - 后续 calcFrequencyRating / analyzeZonePatterns 内部循环每次只切片 specials 数组引用
    //  - 避免 40 次外循环 × 多次内循环 × getSpecial 调用
    var specials = new Array(historyData.length);
    for (var si = 0; si < historyData.length; si++) {
      specials[si] = Utils.SpecialCalculator.getSpecial(historyData[si]);
    }

    var results = [];
    var maxOffset = historyData.length - 14;
    for (var offset = 0; offset < Math.min(maxOffset, 40); offset++) {
      var testData = historyData.slice(offset + 1);
      var testSpecials = specials.slice(offset + 1);
      var targetItem = historyData[offset];
      if (!targetItem || testData.length < 14) continue;

      // 传入预计算的 specials 子数组（从 offset+1 开始），避免内层循环重复 getSpecial
      var freqResult = ZodiacPrediction.calcFrequencyRating(testData, testSpecials);
      var patternResult = ZodiacPrediction.analyzeZonePatterns(testData, testSpecials);
      if (!freqResult) continue;

      var recommend = ZodiacPrediction.getZoneRecommend(testData, freqResult, patternResult);
      if (!recommend || !recommend.length) continue;

      var top6 = recommend.slice(0, 6);

      // targetSpecial 直接从预计算 specials 数组取（O(1) 而非 getSpecial 调用）
      var actualSpecial = specials[offset];
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
    var hits = results.filter(function(r) { return r.hit }).length;

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
      var s = Utils.SpecialCalculator.getSpecial(item);
      return { expect: Number(item.expect || 0), zod: s.zod };
    });

    // 统计最近12期各原区域"输出"次数
    var sourceZoneCount = {};
    ZONE_ORDER.forEach(function(z) { sourceZoneCount[z] = 0; });

    var records = [];
    // 记录上限：单窗口与多窗口组合追踪列表均按 36 期取数（默认折叠只显示前 2 期）
    var maxRecords = Math.min(36, flatData.length - windowSize);

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
  }
};

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionZones);
}
