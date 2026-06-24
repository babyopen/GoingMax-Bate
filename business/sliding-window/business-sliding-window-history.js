/**
 * 滑动窗口预测 · 回测追踪 · 业务层
 * 职责：用历史 N 期数据模拟"过去每期"的预测，与该期实际开奖比对
 *
 * 历史背景：
 *   - 2026-06-10 之前：包含实时推荐记录（addRecord / saveAndCheck / getStats 等）
 *   - 2026-06-10：因"实时推荐记录"与"回测追踪记录"为同一份数据，移除实时推荐模块
 *     只保留回测追踪核心逻辑
 *
 * 依赖方向: views/ -> business/ -> core/
 * 禁止 DOM 操作
 */
const BusinessSlidingWindowHistory = {

  /** 默认回测窗口大小（最近 N 期） */
  DEFAULT_BACKTEST_COUNT: 30,

  /**
   * 回测核心：遍历最近 N 期历史，每期用『截至上一期』的历史数据跑算法
   * 关键：第 i 期模拟预测时，传入 historyData 必须是剔除 i 之后的数据
   *       （即站在第 i 期开奖前那一刻的视角）
   *
   * V1.4.2 增强：每期使用 BusinessCrossExclusion 收集 crossResult 后传入 predict，
   *             保证回测候选生肖与实时推荐完全一致（包括 Rule 1 硬排除 + Rule 2 软降权）
   *
   * @param {Array} historyData - 完整历史数据（[0] 最新，[length-1] 最旧）
   * @param {number} [count] - 回测期数，默认 30
   * @returns {Array<{
   *   period, candidates, candidateScores, actualZodiac, actualTe, hitRank, hitStatus,
   *   algorithm, source: 'backtest', crossExclusion?: { rule2Triggered, downweighted, downweightFactor }
   * }>}
   */
  runBacktest: function(historyData, count) {
    if (!Array.isArray(historyData) || historyData.length < 12) return [];

    var N = (typeof count === 'number' && count > 0) ? count : this.DEFAULT_BACKTEST_COUNT;
    // 实际回测期数 = min(用户指定的N, 数据总量)
    var testCount = Math.min(N, historyData.length);

    var results = [];

    for (var i = 0; i < testCount; i++) {
      // 第 i 期的实际数据（开奖答案）
      var actualItem = historyData[i];
      // 模拟预测用的历史数据：剔除 i 之前（含 i）的所有数据
      var simulateData = historyData.slice(i + 1);
      if (!actualItem || simulateData.length < 12) {
        continue;
      }

      var expect = Number(actualItem.expect || 0);
      if (!expect) continue;

      // [V1.4.2] 收集交叉排除结果（与实时推荐同源），保证回测候选生肖与实时推荐完全一致
      var crossResult = null;
      try {
        if (typeof BusinessCrossExclusion !== 'undefined' && BusinessCrossExclusion.collectAllRecommend) {
          crossResult = BusinessCrossExclusion.collectAllRecommend(simulateData);
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BusinessSlidingWindowHistory] 第' + expect + '期交叉排除收集失败：', e);
        }
      }

      // 跑滑动窗口算法（传入 crossResult，与实时推荐同源）
      var prediction = crossResult
        ? BusinessSlidingWindow.predict(simulateData, { crossResult: crossResult })
        : BusinessSlidingWindow.predict(simulateData); // 兜底：异常时退回原行为
      if (!prediction || !prediction.candidates || !prediction.candidates.length) continue;

      // 提取特码生肖（第 7 位）和特码数字
      var actualZodArr = Utils.parseZodiacArr(actualItem);
      var actualZodiac = actualZodArr[6] || '';
      var actualCodeArr = (actualItem.openCode || '').split(',');
      var actualTe = Number(actualCodeArr[6] || 0);
      if (!actualZodiac) continue;

      // 计算命中排名（基于 prediction.candidates 顺序）
      var candidates = prediction.candidates.map(function(c) { return c.shengxiao; });
      var candidateScores = prediction.candidates.map(function(c) { return c.score; });
      // [V1.4.2 新增] 降权标记：哪些生肖被 Rule 2 软降权（用于视图层渲染）
      var downweightedMap = {};
      prediction.candidates.forEach(function(c) {
        if (c.downweighted) downweightedMap[c.shengxiao] = true;
      });
      var hitRank = 0;
      for (var k = 0; k < candidates.length; k++) {
        if (candidates[k] === actualZodiac) {
          hitRank = k + 1;
          break;
        }
      }

      results.push({
        period: expect,
        candidates: candidates,
        candidateScores: candidateScores,
        algorithm: BusinessSlidingWindow.ALGORITHM_VERSION,
        actualZodiac: actualZodiac,
        actualTe: actualTe,                           // 实际特码数字（用于渲染层"开:X生02"）
        hitRank: hitRank,
        hitStatus: hitRank > 0 ? 'hit' : 'miss',
        source: 'backtest',                          // 标记来源（区别于已废弃的实时推荐）
        // [V1.4.2 新增] 交叉排除元信息（供视图层展示降权状态）
        crossExclusion: crossResult ? {
          rule2Triggered: crossResult.rule2Triggered === true,
          downweighted: crossResult.downweighted || [],
          downweightFactor: crossResult.downweightFactor || 0,
          excluded: crossResult.excluded || []
        } : null
      });
    }

    return results;
  },

  /**
   * 回测统计（命中率、连续命中、排名分布等）
   * @param {Array} records - 回测记录列表
   * @returns {Object} { total, hit, miss, hitRate, top3Rate, firstRankRate, rankStats, maxConsecutiveHit }
   */
  computeBacktestStats: function(records) {
    if (!Array.isArray(records)) records = [];
    var total = records.length;
    var hit = 0, miss = 0;
    var rankStats = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    var consecutiveHit = 0, maxConsecutiveHit = 0;

    // 按期号升序遍历（从最早到最新），正确计算连续命中
    var sortedAsc = records.slice().sort(function(a, b) {
      return (a.period || 0) - (b.period || 0);
    });

    for (var i = 0; i < sortedAsc.length; i++) {
      var r = sortedAsc[i];
      if (r.hitStatus === 'hit') {
        hit++;
        consecutiveHit++;
        if (consecutiveHit > maxConsecutiveHit) maxConsecutiveHit = consecutiveHit;
        if (r.hitRank >= 1 && r.hitRank <= 6) {
          rankStats[r.hitRank] = (rankStats[r.hitRank] || 0) + 1;
        }
      } else if (r.hitStatus === 'miss') {
        miss++;
        consecutiveHit = 0;
      }
    }

    var hitRate = total > 0 ? (hit / total * 100) : 0;
    var top3Rate = total > 0 ? ((rankStats[1] + rankStats[2] + rankStats[3]) / total * 100) : 0;
    var firstRankRate = total > 0 ? (rankStats[1] / total * 100) : 0;

    return {
      total: total,
      hit: hit,
      miss: miss,
      hitRate: hitRate,
      top3Rate: top3Rate,
      firstRankRate: firstRankRate,
      rankStats: rankStats,
      maxConsecutiveHit: maxConsecutiveHit
    };
  },

  

};
