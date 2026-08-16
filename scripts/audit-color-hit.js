/**
 * 全链路自检脚本：colorHit 单维审计（v2.6.3 清理版）
 *
 * 用法（浏览器控制台）：
 *   1. 确保页面已加载 StateManager 与 BusinessImpossible
 *   2. 在控制台执行：
 *        auditColorHit(StateManager._state.historyData)
 *   3. 控制台输出 colorHit 命中率统计
 *
 * 变更（v2.6.3）：
 *   - halfHit 字段已移除，审计范围聚焦 colorHit
 *   - 不再需要 halfHit vs colorHit 对比（已无意义）
 *   - 新增窗口分布统计（adaptiveWindow 模式）
 */
(function (root) {
  'use strict';

  function auditColorHit(historyData) {
    if (!historyData || historyData.length < 30) {
      console.error('[审计] 历史数据不足 30 期，当前:', historyData && historyData.length);
      return null;
    }
    if (typeof BusinessImpossible === 'undefined') {
      console.error('[审计] BusinessImpossible 未加载');
      return null;
    }

    console.log('=== colorHit 全链路自检（v2.6.3）===');
    console.log('历史数据:', historyData.length, '期');

    // 对比两种模式：固定窗口 vs 自适应窗口
    const fixedRows = BusinessImpossible.calculateBacktrack(historyData, historyData.length, { adaptiveWindow: false });
    const adaptiveRows = BusinessImpossible.calculateBacktrack(historyData, historyData.length, { adaptiveWindow: true });

    console.log('\n--- 4 维命中率对比 ---');
    const stat = (rows, key) => rows.filter(r => r[key]).length;
    ['zodiacHit', 'colorHit', 'tailHit', 'headHit', 'allHit'].forEach(k => {
      const f = (stat(fixedRows, k) / fixedRows.length * 100).toFixed(2);
      const a = (stat(adaptiveRows, k) / adaptiveRows.length * 100).toFixed(2);
      const delta = (a - f).toFixed(2);
      const sign = delta >= 0 ? '+' : '';
      console.log('  ' + k.padEnd(12) + '固定:' + f.padStart(6) + '%  自适应:' + a.padStart(6) + '%  Δ:' + sign + delta + 'pp');
    });

    // 窗口分布
    console.log('\n--- 自适应窗口分布 ---');
    const winCount = {};
    adaptiveRows.forEach(r => { winCount[r.windowUsed] = (winCount[r.windowUsed] || 0) + 1; });
    Object.keys(winCount).sort().forEach(w => {
      const pct = (winCount[w] / adaptiveRows.length * 100).toFixed(1);
      console.log('  窗口=' + w + ': ' + winCount[w] + ' 次 (' + pct + '%)');
    });

    // 字段结构验证
    console.log('\n--- 字段结构验证 ---');
    const r0 = adaptiveRows[0];
    const expectedFields = ['expect','zodiac','color','tail','head',
      'actualZodiac','actualTe','actualColor','actualHead','actualTail',
      'zodiacHit','colorHit','tailHit','headHit','allHit','missCount','windowUsed'];
    const removedFields = ['halfHit','half','actualHalf','actualOdd'];
    let pass = true;
    expectedFields.forEach(f => {
      if (!(f in r0)) { console.log('  ❌ 缺少字段:', f); pass = false; }
    });
    removedFields.forEach(f => {
      if (f in r0) { console.log('  ❌ 冗余字段未清理:', f); pass = false; }
    });
    console.log(pass ? '  ✅ 字段结构正确（4 维命中字段 + windowUsed）' : '  ❌ 字段结构异常');

    return {
      fixed: { rows: fixedRows.length, allHitRate: stat(fixedRows, 'allHit') / fixedRows.length },
      adaptive: { rows: adaptiveRows.length, allHitRate: stat(adaptiveRows, 'allHit') / adaptiveRows.length },
      windowDist: winCount
    };
  }

  root.auditColorHit = auditColorHit;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { auditColorHit: auditColorHit };
  }
})(typeof window !== 'undefined' ? window : globalThis);