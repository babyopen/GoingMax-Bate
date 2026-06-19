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
   * 切换号码统计表显示（纯DOM操作）
   */
  toggleNumStatistics: function() {
    var el = document.getElementById('numStatisticsBox');
    if(!el) return;
    var isVisible = window.getComputedStyle(el).display !== 'none';
    el.style.display = isVisible ? 'none' : 'block';
    var btn = document.querySelector('[data-action="toggleNumStatistics"]');
    if(btn) btn.textContent = isVisible ? '展开号码统计' : '收起号码统计';
    // 展开时立即渲染（绕过 renderFullAnalysis 可能的失败路径）
    if(!isVisible) {
      var wrap = document.getElementById('numStatisticsTable');
      var stats = (typeof Business !== 'undefined' && Business.calcFullAnalysis) ? Business.calcFullAnalysis().numStatistics : null;
      if(wrap && stats && stats.length) {
        var html = '<div class="num-stat-row num-stat-head">'
          + '<div class="num-stat-cell">号码</div>'
          + '<div class="num-stat-cell">出现次数</div>'
          + '<div class="num-stat-cell">出现概率</div>'
          + '<div class="num-stat-cell">平均间隔</div>'
          + '<div class="num-stat-cell">最大间隔</div>'
          + '<div class="num-stat-cell">最小间隔</div>'
          + '<div class="num-stat-cell">当前遗漏</div>'
          + '</div>';
        for(var i = 0; i < stats.length; i++) {
          var ns = stats[i];
          var colorClass = (ns.count >= 4) ? 'hot' : (ns.count >= 2) ? 'warm' : (ns.count >= 1) ? 'normal' : 'cold';
          html += '<div class="num-stat-row num-stat-' + colorClass + '">'
            + '<div class="num-stat-cell num-stat-num">' + ns.num + '</div>'
            + '<div class="num-stat-cell">' + ns.count + '</div>'
            + '<div class="num-stat-cell">' + ns.rate + '%</div>'
            + '<div class="num-stat-cell">' + ns.avgGap + '</div>'
            + '<div class="num-stat-cell">' + ns.maxGap + '</div>'
            + '<div class="num-stat-cell">' + ns.minGap + '</div>'
            + '<div class="num-stat-cell">' + ns.currentMiss + '</div>'
            + '</div>';
        }
        wrap.innerHTML = html;
      } else {
        wrap.innerHTML = '<div class="num-stat-empty">号码统计未生成，请在控制台运行: Business.calcFullAnalysis().numStatistics 查看</div>';
      }
    }
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
