/**
 * 视图层：分析页面渲染 - 共用逻辑
 * @namespace ViewAnalysis
 * 职责：标签页切换、详情展开/收起、选择器同步
 * 依赖方向：被 business/ 调用（business → views，上层→下层）
 * 红线：不反向调用 business/、不调用 StateManager 写操作
 * 
 * 拆分记录：
 * 2026-06-09 拆分为独立子标签页文件：
 *   - view-analysis-history.js  ：历史列表标签页
 *   - view-analysis-full.js     ：全维度分析标签页
 *   - view-analysis-zodiac.js   ：生肖关联分析标签页
 */
const ViewAnalysis = {

  /**
   * 切换详情显示（纯DOM操作）
   * @param {string} targetId - 目标元素ID
   */
  toggleDetail: function(targetId) {
    var el = document.getElementById(targetId);
    if(!el) return;
    var isVisible = window.getComputedStyle(el).display !== 'none';
    el.style.display = isVisible ? 'none' : 'block';
    var btn = document.querySelector('[data-action="toggleDetail"][data-target="' + targetId + '"]');
    if(btn) btn.textContent = isVisible ? '展开详情' : '收起详情';
  },

  /**
   * 切换分析标签页UI（仅DOM操作）
   * @param {string} tab - 标签名
   */
  switchTabUI: function(tab) {
    ViewCommon.switchTabUI({
      tabSelector: '.analysis-tab-btn',
      tabDataAttr: 'analysisTab',
      panelMap: {
        history: 'historyPanel',
        analysis: 'analysisPanelContent',
        zodiac: 'zodiacAnalysisPanel'
      },
      navBtnSelector: '.nav-tab[data-page="analysis"]'
    }, tab);
  },

  /**
   * 同步分析选择器UI值（不包含业务逻辑）
   * @param {Object} vals
   */
  syncSelectors: function(vals) {
    if(vals.zodiacAnalyzeSelect) { var el = document.getElementById('zodiacAnalyzeSelect'); if(el) el.value = vals.zodiacAnalyzeSelect; }
    if(vals.zodiacCustomNum !== undefined) { var el = document.getElementById('zodiacCustomNum'); if(el) el.value = vals.zodiacCustomNum; }
    if(vals.analyzeSelect) { var el = document.getElementById('analyzeSelect'); if(el) el.value = vals.analyzeSelect; }
    if(vals.customNum !== undefined) { var el = document.getElementById('customNum'); if(el) el.value = vals.customNum; }
    if(vals.customNumCountVisible !== undefined) { var el = document.getElementById('customNumCount'); if(el) el.style.display = vals.customNumCountVisible ? 'inline-block' : 'none'; }
  }

};
