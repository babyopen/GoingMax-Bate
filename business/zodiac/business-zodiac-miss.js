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
 */
const ZodiacPredictionMiss = {
  calcZodiacMissHistory: function(historyData, zodiac) {
    if (!historyData || !historyData.length || !zodiac) return null;

    var appearances = [];
    var intervals = [];

    for (var i = 0; i < historyData.length; i++) {
      var item = historyData[i];
      var s = Utils.SpecialCalculator.getSpecial(item);
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
      var s = Utils.SpecialCalculator.getSpecial(item);
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
        var nextSpecial = Utils.SpecialCalculator.getSpecial(nextItem);
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
    var latestSpecial = Utils.SpecialCalculator.getSpecial(latestItem);
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
  }
};

// 兼容路径：挂载到 ZodiacPrediction
if (typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction) {
  Object.assign(ZodiacPrediction, ZodiacPredictionMiss);
}
