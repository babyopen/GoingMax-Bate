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
    //   - 不传时：使用通用滑动窗口缓存（v2.5.0 升级）
    //   - 传入时：与 historyData 等长的 specials 数组，specials[i] 对应 historyData[i]
    let specials = precomputedSpecials;
    if (!specials) {
      specials = BusinessCommonSpecials.buildWindowed(historyData);
    }

    // 性能优化：一次性扁平化预处理（避免多次调用 _getSpecial）
    const flatData = historyData.map(function(item, i) {
      return { expect: Number(item.expect || 0), zod: specials[i].zod };
    });

    const windows = [12, 24, 36];
    const result = {};

    const missScope = Math.min(Math.min(50, historyData.length), historyData.length);
    const missList = historyData.slice(0, missScope);
    const missLatest = Number(missList[0]?.expect || 0);

    const missLastIdx = {};
    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { missLastIdx[z] = -1; });
    missList.forEach(function(_, idx) {
      const s = specials[idx];
      if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) {
        if (missLastIdx[s.zod] === -1) missLastIdx[s.zod] = idx;
      }
    });

    windows.forEach(function(w) {
      if (historyData.length < w) {
        result['p' + w] = null;
        return;
      }
      const windowData = flatData.slice(0, w);
      const freq = {};
      const posMap = {};
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

      const rated = [];
      ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
        const count = freq[z];
        // 使用统一的分区阈值配置（CONFIG.ZONE_THRESHOLDS）
        const level = ZodiacPrediction._getZoneLevel(w, count);
        const zone = ZodiacPrediction.ZONE_MAP[level];
        const miss = Utils.calcMiss(missLastIdx[z], missScope, missLatest, missList);

        const positions = posMap[z];
        const earliestPos = positions.length > 0 ? Math.max.apply(null, positions) : -1;
        let willDrop = false;
        let willDowngrade = false;
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
    //   - 不传时：使用通用滑动窗口缓存（v2.5.0 升级）
    let specials = precomputedSpecials;
    if (!specials) {
      specials = BusinessCommonSpecials.buildWindowed(historyData);
    }

    const windows = [12, 24, 36];
    const result = {};

    windows.forEach(function(w) {
      const zoneRecords = { '冷号区': [], '穿插区': [], '活跃区': [], '热号区': [], '过热区': [], '降权区': [], '封顶区': [] };
      const zoneHits = { '冷号区': 0, '穿插区': 0, '活跃区': 0, '热号区': 0, '过热区': 0, '降权区': 0, '封顶区': 0 };

      const maxOffset = historyData.length - w - 1;
      for (let offset = 0; offset < Math.min(maxOffset, 60); offset++) {
        const nextItem = historyData[offset];
        const windowData = historyData.slice(offset + 1, offset + 1 + w);
        if (!nextItem || windowData.length < w) continue;

        let freq = {};
        ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) { freq[z] = 0; });
        // 2026-06-21 优化：用 specials 替代 getSpecial 调用
        for (let wi = 0; wi < windowData.length; wi++) {
          const s = specials[offset + 1 + wi];
          if (ZodiacPrediction.ZODIAC_ORDER.indexOf(s.zod) !== -1) freq[s.zod]++;
        }

        const nextSpecial = specials[offset];
        const nextZod = nextSpecial.zod;

        ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
          const count = freq[z];
          const level = count >= 4 ? 4 : count;
          const zone = ZodiacPrediction.ZONE_MAP[level];
          zoneRecords[zone].push(z === nextZod ? 1 : 0);
          if (z === nextZod) zoneHits[zone]++;
        });
      }

      const zoneProb = {};
      const zoneScores = {};
      ZodiacPrediction.ZONE_ORDER.forEach(function(zone) {
        const records = zoneRecords[zone] || [];
        const total = records.length;
        const hitCount = zoneHits[zone] || 0;
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
    const keys = Object.keys(CONFIG.COLOR_MAP);
    for (let i = 0; i < keys.length; i++) {
      if (CONFIG.COLOR_MAP[keys[i]].indexOf(te) !== -1) return keys[i];
    }
    return '红';
  },

  _calcHotFactors: function(historyData) {
    if (!historyData || historyData.length < 5) return null;

    const recent = historyData.slice(0, Math.min(20, historyData.length));
    const headCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const tailCount = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const colorCount = { '红': 0, '蓝': 0, '绿': 0 };
    const rangeCount = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0 };

    recent.forEach(function(item) {
      const s = Utils.SpecialCalculator.getSpecial(item);
      headCount[s.head]++;
      tailCount[s.tail]++;
      colorCount[s.colorName]++;
      const rKey = Utils.getRangeCategory(s.te);
      rangeCount[rKey]++;
    });

    const sortDesc = function(a, b) { return b[1] - a[1]; };
    const topHead = Object.entries(headCount).sort(sortDesc);
    const topTail = Object.entries(tailCount).sort(sortDesc);
    const topColor = Object.entries(colorCount).sort(sortDesc);
    const topRange = Object.entries(rangeCount).sort(sortDesc);

    return {
      hotHeads: topHead.slice(0, 2).map(function(e) { return Number(e[0]); }),
      hotTails: topTail.slice(0, 2).map(function(e) { return Number(e[0]); }),
      hotColor: topColor[0][0],
      hotRange: topRange[0][0]
    };
  },

  _calcHotMatchScore: function(zodiac, hotFactors) {
    if (!hotFactors) return 0;

    let score = 0;
    const zodTails = [];
    const tailKeys = Object.keys(ZodiacPrediction.TAIL_ZODIAC_MAP);
    for (let ti = 0; ti < tailKeys.length; ti++) {
      const t = Number(tailKeys[ti]);
      if (ZodiacPrediction.TAIL_ZODIAC_MAP[t].indexOf(zodiac) !== -1) {
        zodTails.push(t);
      }
    }

    if (hotFactors.hotTails.some(function(ht) { return zodTails.indexOf(ht) !== -1; })) {
      score += 6;
    }

    let hasHotColor = false;
    let hasHotRange = false;
    let hasHotHead = false;

    for (let zi = 0; zi < zodTails.length; zi++) {
      const tail = zodTails[zi];
      for (let head = 0; head <= 4; head++) {
        const te = head * 10 + tail;
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

    const p12 = freqResult.p12;
    const prob12 = patternResult && patternResult.p12 ? patternResult.p12.zoneProb : null;

    // === 第1步：预测最可能出现的区域（取概率最高的 2 个） ===
    const zoneRank = [];
    if (prob12) {
      ZodiacPrediction.ZONE_ORDER.forEach(function(zone) {
        zoneRank.push({ zone: zone, prob: prob12[zone] || 0 });
      });
      zoneRank.sort(function(a, b) { return b.prob - a.prob; });
    }
    const topZones = zoneRank.slice(0, 2).map(function(z) { return z.zone; });

    // === 第2步：计算近期热门头数/尾数/波色/区间 ===
    const hotFactors = ZodiacPrediction._calcHotFactors(historyData);

    // === 第3步：对每个生肖综合评分 ===
    const scored = p12.map(function(item) {
      const isInTopZone = topZones.indexOf(item.zone) !== -1;
      const zoneBonus = isInTopZone ? (prob12 ? (prob12[item.zone] || 0) : 0) : 0;
      const hotScore = ZodiacPrediction._calcHotMatchScore(item.zodiac, hotFactors);
      const missRatio = item.miss / 12;
      const missRatioScore = Math.min(12, Math.round(missRatio * 12));

      const total = Math.round(zoneBonus * 3) + hotScore + missRatioScore;

      return {
        zodiac: item.zodiac,
        zone: item.zone,
        count: item.count,
        miss: item.miss,
        score: total
      };
    });

    scored.sort(function(a, b) { return b.score - a.score; });

    const selected = scored.slice(0, 6);
    const selectedMap = {};
    selected.forEach(function(s) { selectedMap[s.zodiac] = true; });

    // === 第4步：不足6名，按遗漏值从小到大补足 ===
    if (selected.length < 6) {
      const fill = [];
      for (let i = 0; i < p12.length; i++) {
        if (fill.length >= 6 - selected.length) break;
        if (!selectedMap[p12[i].zodiac]) {
          fill.push(p12[i]);
        }
      }

      fill.sort(function(a, b) { return a.miss - b.miss; });

      for (let fi = 0; fi < fill.length; fi++) {
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

    // v2.5.0 性能优化：使用通用滑动窗口缓存，替换手动 getSpecial 循环
    const specials = BusinessCommonSpecials.buildWindowed(historyData);

    const results = [];
    const maxOffset = historyData.length - 14;
    for (let offset = 0; offset < Math.min(maxOffset, 40); offset++) {
      const testData = historyData.slice(offset + 1);
      const testSpecials = specials.slice(offset + 1);
      const targetItem = historyData[offset];
      if (!targetItem || testData.length < 14) continue;

      // 传入预计算的 specials 子数组（从 offset+1 开始），避免内层循环重复 getSpecial
      const freqResult = ZodiacPrediction.calcFrequencyRating(testData, testSpecials);
      const patternResult = ZodiacPrediction.analyzeZonePatterns(testData, testSpecials);
      if (!freqResult) continue;

      const recommend = ZodiacPrediction.getZoneRecommend(testData, freqResult, patternResult);
      if (!recommend || !recommend.length) continue;

      const top6 = recommend.slice(0, 6);

      // targetSpecial 直接从预计算 specials 数组取（O(1) 而非 getSpecial 调用）
      const actualSpecial = specials[offset];
      const actualZod = actualSpecial.zod;

      let hitRank = 0;
      for (let j = 0; j < top6.length; j++) {
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
    const minData = windowSize + 1;
    if (!historyData || historyData.length < minData) return null;

    const ZONE_MAP = ZodiacPrediction.ZONE_MAP;
    const ZONE_ORDER = ZodiacPrediction.ZONE_ORDER;
    const ZODIAC_ORDER = ZodiacPrediction.ZODIAC_ORDER;

    // v2.5.0 性能优化：使用通用缓存，替换逐项 getSpecial
    const allSpecials = BusinessCommonSpecials.buildWindowed(historyData);
    const flatData = historyData.map(function(item, i) {
      return { expect: Number(item.expect || 0), zod: allSpecials[i].zod };
    });

    // 统计最近12期各原区域"输出"次数
    const sourceZoneCount = {};
    ZONE_ORDER.forEach(function(z) { sourceZoneCount[z] = 0; });

    const records = [];
    // 记录上限：单窗口与多窗口组合追踪列表均按 36 期取数（默认折叠只显示前 2 期）
    const maxRecords = Math.min(36, flatData.length - windowSize);

    for (let i = 0; i < maxRecords; i++) {
      const curItem = flatData[i];
      const zodiac = curItem.zod;

      if (ZODIAC_ORDER.indexOf(zodiac) === -1) continue;

      // 开出前的窗口（不含当期）
      const prevWindow = flatData.slice(i + 1, i + 1 + windowSize);

      let prevCount = 0;
      prevWindow.forEach(function(item) {
        if (item.zod === zodiac) prevCount++;
      });

      const prevLevel = ZodiacPrediction._getZoneLevel(windowSize, prevCount);
      const prevZone = ZONE_MAP[prevLevel];

      // 开出后的窗口（含当期）
      const curWindow = flatData.slice(i, i + windowSize);

      let curCount = 0;
      curWindow.forEach(function(item) {
        if (item.zod === zodiac) curCount++;
      });

      const curLevel = ZodiacPrediction._getZoneLevel(windowSize, curCount);
      const curZone = ZONE_MAP[curLevel];

      // 计算遗漏间隔：距离上一次出现该生肖的期数
      let missInterval = -1;
      for (let j = i + 1; j < flatData.length; j++) {
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
    let topZone = '';
    let topCount = 0;
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
    const thresholds = CONFIG.ZONE_THRESHOLDS[windowSize] || CONFIG.ZONE_THRESHOLDS[12];
    // 阈值数组按 [封顶,降权,热号,穿插,冷号,活跃,过热] 顺序排列
    // 12期只有4级分区，跳过活跃(2)和过热(4)级别
    if (windowSize === 12) {
      if (count >= thresholds[0]) return 6; // 封顶区
      if (count >= thresholds[1]) return 5; // 降权区
      if (count >= thresholds[2]) return 3; // 热号区（12期跳过活跃和过热）
      if (count >= thresholds[3]) return 1; // 穿插区
      return 0; // 冷号区
    }
    // 24/36期 7级分区
    if (count >= thresholds[0]) return 6; // 封顶区
    if (count >= thresholds[1]) return 5; // 降权区
    if (count >= thresholds[2]) return 4; // 过热区
    if (count >= thresholds[3]) return 3; // 热号区
    if (count >= thresholds[4]) return 2; // 活跃区
    if (count >= thresholds[5]) return 1; // 穿插区
    return 0; // 冷号区
  }
};

// ============================================================
// v2.0.8 性能优化：高频函数 LRU 包装
//   - calcFrequencyRating / analyzeZonePatterns / runZoneBacktest 在切换 tab 和
//     自动刷新时高频调用，同一 historyData 引用下命中缓存节省 50%+ 时间
// ============================================================
if (typeof BusinessCommonLRU !== 'undefined' && BusinessCommonLRU) {
  ZodiacPredictionZones.calcFrequencyRating = BusinessCommonLRU.withHistoryLRU(
    ZodiacPredictionZones.calcFrequencyRating,
    50
  );
  ZodiacPredictionZones.analyzeZonePatterns = BusinessCommonLRU.withHistoryLRU(
    ZodiacPredictionZones.analyzeZonePatterns,
    50
  );
  ZodiacPredictionZones.runZoneBacktest = BusinessCommonLRU.withHistoryLRU(
    ZodiacPredictionZones.runZoneBacktest,
    20 // backtest 通常调用次数少，20 条足够
  );
}

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionZones);
}
