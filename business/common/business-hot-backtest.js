/**
 * 业务层：热门特码回测追踪（v2.6.0 新增，v2.6.1 算法优化）
 * @namespace BusinessHotBacktest
 *
 * 职责：模拟"在每期当时的视角"计算 TOP5 热门特码，与实际开奖比对
 * 算法：与 calcFullAnalysis 中 numCount 统计逻辑 100% 一致
 *   - 统计最近 N 期（analyzeLimit）每个号码出现次数
 *   - 取出现次数最多的前 5 个号码
 *   - 检查当期实际特码是否在 TOP5 中
 *
 * v2.6.1 优化：
 *   - 滑动窗口增量更新：每期 O(1) 更新 numCount，避免 O(windowSize) 重算
 *   - 预计算 specials：一次 buildWindowed，循环内 O(1) 取值
 *   - 性能提升：O(testCount × windowSize) → O(testCount × 49log49)
 *
 * 依赖方向：被 event.js (事件层) → business-main.js (业务层) 调用
 * 禁止 DOM 操作
 */
const BusinessHotBacktest = {

  /** 默认回测期数 */
  DEFAULT_TEST_COUNT: 24,

  /**
   * 运行热门号码回测
   *
   * @param {Array} historyData - 历史数据（[0] 最新，[1] 次新，…）
   * @param {number} [testCount] - 回测期数（默认 24，上限 24）
   * @param {number} [analyzeLimit] - 分析窗口期数（默认 12，与 calcFullAnalysis 一致）
   * @returns {Object|null} 回测汇总 { totalTests, totalHits, totalHitRate, details }
   */
  runBacktest: function(historyData, testCount, analyzeLimit) {
    if (!historyData || !historyData.length) return null;

    var windowSize = analyzeLimit || 12;
    if (historyData.length < windowSize + 1) return null;

    testCount = Math.min(testCount || this.DEFAULT_TEST_COUNT, 24, historyData.length - windowSize);
    if (testCount <= 0) return null;

    // v2.6.1 优化：预计算全量 specials（一次 batchGetSpecial，循环内 O(1) 取值）
    var allSpecials = BusinessCommonSpecials.buildWindowed(historyData);

    // v2.6.1 优化：初始化第一个窗口的 numCount（offset=0 的窗口：historyData[1..windowSize]）
    var numCount = {};
    for (var i = 1; i <= 49; i++) {
      numCount[CommonString.formatNum(i)] = 0;
    }
    for (var wi = 0; wi < windowSize; wi++) {
      var initS = allSpecials[1 + wi];
      if (initS && initS.te) {
        numCount[CommonString.formatNum(initS.te)]++;
      }
    }

    var results = [];

    for (var offset = 0; offset < testCount; offset++) {
      var targetItem = historyData[offset];
      if (!targetItem) break;

      var actualSpecial = allSpecials[offset];
      if (!actualSpecial || !actualSpecial.te) continue;

      // 取 TOP5（与 calcFullAnalysis 中 hotNum 逻辑一致）
      var top5 = Utils.getTopN(numCount, 5, undefined, ' ');

      var actualTe = CommonString.formatNum(actualSpecial.te);
      var top5Arr = top5.split(' ');
      var isHit = top5Arr.indexOf(actualTe) !== -1;

      results.push({
        expect: targetItem.expect,
        actualNumber: actualSpecial.te,
        top5: top5,
        top5Arr: top5Arr,
        actualTe: actualTe,
        isHit: isHit
      });

      // v2.6.1 优化：滑动窗口增量更新（非最后一期时执行）
      // 从 offset 到 offset+1：
      //   移除 historyData[offset+1]（离开窗口的第一个元素）
      //   添加 historyData[offset+1+windowSize]（新进入窗口的元素）
      if (offset < testCount - 1) {
        var removeSpec = allSpecials[offset + 1];
        var addSpec = allSpecials[offset + 1 + windowSize];
        if (removeSpec && removeSpec.te) {
          numCount[CommonString.formatNum(removeSpec.te)]--;
        }
        if (addSpec && addSpec.te) {
          numCount[CommonString.formatNum(addSpec.te)]++;
        }
      }
    }

    if (!results.length) return null;

    var hitCount = results.filter(function(r) { return r.isHit; }).length;
    var hitRate = Math.round((hitCount / results.length) * 100);

    return {
      totalTests: results.length,
      totalHits: hitCount,
      totalHitRate: hitRate,
      details: results
    };
  }
};