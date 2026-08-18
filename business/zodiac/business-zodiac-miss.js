/**
 * 业务层：生肖遗漏历史 + 跟随统计（拆分自 business-zodiac-prediction.js，2026-06-05）
 * @namespace ZodiacPredictionMiss
 * 包含：
 *   - calcZodiacMissHistory
 *   - calcZodiacFollowers
 *   - getLatestFollowStats
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ZodiacPrediction.xxx() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - 内部使用 `Utils.SpecialCalculator.getSpecial / ZODIAC_ORDER` 引用门面上的共享数据/工具（运行时查找）
 *
 * 2026-06-09 统一遗漏值计算逻辑，复用 Utils.calcMiss
 */
const ZodiacPredictionMiss = {
  calcZodiacMissHistory: function(historyData, zodiac) {
    if (!historyData || !historyData.length || !zodiac) return null;

    const total = historyData.length;
    const latestExpect = Number(historyData[0]?.expect || 0);
    let lastAppearIdx = -1;
    const appearances = [];
    const intervals = [];

    // 查找所有出现位置
    for (let i = 0; i < historyData.length; i++) {
      const item = historyData[i];
      const s = Utils.SpecialCalculator.getSpecial(item);
      if (s.zod === zodiac) {
        const expect = Number(item.expect || 0);
        appearances.push({
          expect: expect,
          index: i,
          interval: i > 0 ? i : 0
        });
        if (lastAppearIdx === -1) {
          lastAppearIdx = i; // 记录最近一次出现位置（倒序中 index 最小的）
        }
      }
    }

    if (appearances.length === 0) return null;

    // 使用统一的 Utils.calcMiss 计算当前遗漏值
    const currentMiss = Utils.calcMiss(lastAppearIdx, total, latestExpect, historyData);

    for (let j = 1; j < appearances.length; j++) {
      intervals.push(appearances[j].index - appearances[j - 1].index);
    }

    let totalInterval = 0;
    for (let k = 0; k < intervals.length; k++) {
      totalInterval += intervals[k];
    }
    const avgInterval = intervals.length > 0 ? Math.round(totalInterval / intervals.length * 10) / 10 : 0;

    const maxInterval = intervals.length > 0 ? Math.max.apply(null, intervals) : 0;
    const minInterval = intervals.length > 0 ? Math.min.apply(null, intervals) : 0;

    const recentAppearances = appearances.slice(0, Math.min(10, appearances.length));

    const intervalDistribution = {
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

    const targetAppearances = [];
    for (let i = 0; i < historyData.length; i++) {
      const item = historyData[i];
      const s = Utils.SpecialCalculator.getSpecial(item);
      if (s.zod === zodiac) {
        targetAppearances.push({
          expect: Number(item.expect || 0),
          index: i
        });
      }
    }

    if (targetAppearances.length === 0) return null;

    const followStats = {};
    const followRecords = [];

    ZodiacPrediction.ZODIAC_ORDER.forEach(function(z) {
      followStats[z] = 0;
    });

    const maxRecords = maxAppearances || 20;
    const followLen = followCount || 4;

    const limitedAppearances = targetAppearances.slice(0, maxRecords);

    limitedAppearances.forEach(function(target) {
      const chain = [];

      for (let i = 1; i <= followLen; i++) {
        const nextIdx = target.index - i;
        if (nextIdx < 0 || nextIdx >= historyData.length) break;

        const nextItem = historyData[nextIdx];
        const nextSpecial = Utils.SpecialCalculator.getSpecial(nextItem);
        const nextZod = nextSpecial.zod;

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

    const sortedStats = [];
    for (const z in followStats) {
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

    const latestItem = historyData[0];
    const latestSpecial = Utils.SpecialCalculator.getSpecial(latestItem);
    const latestZod = latestSpecial.zod;
    const latestExpect = Number(latestItem.expect || 0);

    const followStats = ZodiacPrediction.calcZodiacFollowers(historyData, latestZod, followCount, maxAppearances);

    if (!followStats) return null;

    return {
      zodiac: latestZod,
      expect: latestExpect,
      topFollowers: followStats.topFollowers.slice(0, 4),
      totalFollows: followStats.targetAppearCount
    };
  },

  /**
   * 2026-08-18 新增：本期特码尾数的"下一期尾数"跟随统计
   * 取本期开出的特码尾数，在历史中查找该尾数出现过的所有位置，
   * 统计这些位置"下一期"实际开出的尾数分布，凑足 6 个不同尾数即停止采样，
   * 按频次降序取 Top 6 作为本期预测参考。
   *
   * 2026-08-18 调整：
   *   - 不再限定固定窗口期数；改为不限期数、凑足 6 个不同尾数即停
   *   - 与回测算法规格统一（复用 _calcTop5ByOccurrenceOrder）
   *
   * @param {Array} historyData - 历史数据（index 0 为最近一期）
   * @param {number} [windowSize] - 兼容旧调用方保留的参数；本算法不再使用
   * @returns {Object|null} { tail, expect, topFollowers:[{tail, count, percentage}], sampleCount, scannedPeriods }
   */
  getLatestTailFollowStats: function(historyData, _windowSize) {
    // 注：_windowSize 为旧调用方兼容性保留的参数（2026-08-18 改为不限期数后不再使用）
    //   ESLint 允许未使用以下划线开头的形参，故加 _ 前缀
    if (!historyData || !historyData.length) return null;

    // 本期：index 0
    const latestItem = historyData[0];
    const latestSpecial = Utils.SpecialCalculator.getSpecial(latestItem);
    const latestTail = Number(latestSpecial.tail);
    const latestExpect = Number(latestItem.expect || 0);

    // 2026-08-18 调整：复用 _calcTop5ByOccurrenceOrder
    //   - windowSize 参数保留以兼容旧调用方，但已不再使用（算法不限期数）
    const top5Result = ZodiacPrediction._calcTop5ByOccurrenceOrder(historyData, latestTail);
    if (!top5Result || !top5Result.top5 || top5Result.top5.length === 0) {
      return {
        tail: latestTail,
        expect: latestExpect,
        topFollowers: [],
        sampleCount: 0,
        scannedPeriods: 0,
        windowSize: historyData.length
      };
    }

    // 把字符串尾数映射为 {tail, count, percentage} 卡片所需结构
    const sampleCount = top5Result.sampleCount;
    const topFollowers = top5Result.top5.map(function(t) {
      const cnt = top5Result.countsByTail[t] || 0;
      return {
        tail: Number(t),
        count: cnt,
        percentage: sampleCount > 0 ? Math.round(cnt / sampleCount * 100) : 0
      };
    });

    return {
      tail: latestTail,
      expect: latestExpect,
      topFollowers: topFollowers,
      sampleCount: sampleCount,
      scannedPeriods: top5Result.scannedPeriods,
      windowSize: historyData.length
    };
  }
};

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionMiss);
}
