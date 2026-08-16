/**
 * 视图层：Giong 综合分析 - 五行子标签页
 * 职责：渲染五行分析序列、统计、规律特征、趋势预测及回测弹窗
 * 依赖方向：在 view-zodiac-giong.js 之后加载，方法挂载到 ViewZodiacGiong
 * 拆分记录：2026-06-09 从 view-zodiac-giong.js 拆分
 */
const ViewZodiacGiongWuxing = {

  renderLatestWuxingStats: function(wuxingData) {
    const container = document.getElementById('latestWuxingStatsPanel');
    if (!container) return;
    if (!wuxingData) {
      container.innerHTML = '';
      return;
    }
    const html = ViewZodiacGiongWuxing._buildWuxingAnalysisHTML(wuxingData);
    container.innerHTML = html;
  },

  /** v2.6.9 拆分：五行调色板 */
  _WUXING_PALETTE: {
    '金': { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', text: '#B8860B' },
    '木': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D' },
    '水': { bg: 'linear-gradient(135deg, #0EA5E9, #06B6D4)', text: '#0369A1' },
    '火': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C' },
    '土': { bg: 'linear-gradient(135deg, #A78BFA, #8B5CF6)', text: '#7C3AED' }
  },

  /**
   * 构建五行分析卡片 HTML（v2.6.9 拆分）
   */
  _buildWuxingAnalysisHTML: function(wuxingData) {
    let html = '<div class="wuxing-analysis-card">';
    html += '<div class="wuxing-analysis-header">';
    html += '<div class="wuxing-analysis-title">最近' + wuxingData.period + '期五行分析</div>';
    html += '</div><div class="wuxing-analysis-content">';
    html += ViewZodiacGiongWuxing._renderWuxingSequence(wuxingData.sequence);
    html += ViewZodiacGiongWuxing._renderWuxingStatsGrid(wuxingData);
    html += ViewZodiacGiongWuxing._renderWuxingPatterns(wuxingData.patterns);
    html += ViewZodiacGiongWuxing._renderWuxingTrend(wuxingData.trend);
    html += '</div></div>';
    return html;
  },

  /** 渲染五行序列 */
  _renderWuxingSequence: function(sequence) {
    const palette = ViewZodiacGiongWuxing._WUXING_PALETTE;
    let html = '<div class="wuxing-sequence-row">';
    sequence.slice().reverse().forEach(function(item) {
      const wx = palette[item.wuxing] || palette['金'];
      html += '<span class="wuxing-seq-item" style="background:' + wx.bg + ';color:#fff;">' + item.wuxing + '</span>';
    });
    return html + '</div>';
  },

  /** 渲染五行统计网格 */
  _renderWuxingStatsGrid: function(data) {
    const palette = ViewZodiacGiongWuxing._WUXING_PALETTE;
    let html = '<div class="wuxing-stats-grid">';
    ['金', '木', '水', '火', '土'].forEach(function(wx) {
      const count = data.count[wx] || 0;
      const percent = Math.round((count / data.period) * 100);
      const wxColor = palette[wx];
      html += '<div class="wuxing-stat-item">';
      html += '<div class="wuxing-stat-header" style="color:' + wxColor.text + ';border-left:3px solid ' + wxColor.text + ';">';
      html += '<span class="wuxing-stat-name">' + wx + '</span>';
      html += '<span class="wuxing-stat-count">' + count + '期</span>';
      html += '</div>';
      html += '<div class="wuxing-stat-bar-bg">';
      html += '<div class="wuxing-stat-bar-fill" style="width:' + percent + '%;background:' + wxColor.bg + ';"></div>';
      html += '</div>';
      html += '<div class="wuxing-stat-percent" style="color:' + wxColor.text + ';">' + percent + '%</div>';
      html += '</div>';
    });
    return html + '</div>';
  },

  /** 渲染规律特征列表 */
  _renderWuxingPatterns: function(patterns) {
    if (!patterns || patterns.length === 0) return '';
    const palette = ViewZodiacGiongWuxing._WUXING_PALETTE;
    let html = '<div class="wuxing-patterns-section">';
    html += '<div class="wuxing-patterns-title">规律特征</div>';
    html += '<div class="wuxing-patterns-list">';
    patterns.forEach(function(pattern) {
      const wx = palette[pattern.type.charAt(0)] || { bg: '#666' };
      html += '<div class="wuxing-pattern-tag" style="background:' + wx.bg + ';">';
      html += pattern.type;
      if (pattern.count > 1) html += '<span class="pattern-count">' + pattern.count + '次</span>';
      html += '</div>';
    });
    return html + '</div></div>';
  },

  /** 渲染趋势预测（点击触发回测） */
  _renderWuxingTrend: function(trend) {
    if (!trend || trend.prediction === '-') return '';
    const palette = ViewZodiacGiongWuxing._WUXING_PALETTE;
    const predWx = trend.prediction;
    const predColor = palette[predWx] || palette['金'];
    let html = '<div class="wuxing-trend-section" data-action="showWuxingBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
    html += '<div class="wuxing-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
    html += '<div class="wuxing-trend-prediction">';
    html += '<span class="trend-result" style="background:' + predColor.bg + ';font-size:18px;font-weight:700;padding:4px 16px;border-radius:6px;color:#fff;">' + predWx + '</span>';
    html += '<span class="trend-confidence">' + trend.confidence + '%可信度</span>';
    html += '</div>';
    if (trend.reason) html += '<div class="wuxing-trend-reason">' + trend.reason + '</div>';
    return html + '</div>';
  },

  showWuxingBacktestModal: function(backtestData) {
    ViewCommon.showBacktestModal({
      modalId: 'wuxingBacktestModal',
      title: '📊 五行回测追踪',
      closeBtnId: 'closeWuxingBacktestBtn',
      highlightColor: '#A78BFA',
      backtestData: backtestData,
      labels: { predicted: '预测', actual: '实际' },
      // 2026-08-15 新增：五行 Top 3 推荐（predictedWuxingTop3）— 与综合分析面板底部展示一致
      formatValue: function(item) {
        return {
          pred: item.predictedWuxingTop3 || item.predictedWuxing,
          actual: item.actualWuxing
        };
      },
      footerNote: '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)（Top 3 命中）<br>' +
        '• 基于五行 Top 3 推荐算法回测<br>' +
        '• 数据仅供参考，不构成投资建议'
    });
  },

  /**
   * 综合分析-五行子标签页内容
   */
  _renderWuxingContent: function(wuxingData) {
    return ViewCommon.renderCombinedAnalysisContent({
      sequence: wuxingData && wuxingData.sequence ? wuxingData.sequence : [],
      typePrefix: 'wx',
      valueKey: 'wuxing',
      colors: { '金': '#FFD700', '木': '#22C55E', '水': '#0EA5E9', '火': '#EF4444', '土': '#A78BFA' },
      stats: wuxingData ? wuxingData.count : null,
      total: wuxingData ? wuxingData.period : 0,
      patterns: wuxingData && wuxingData.patterns ? wuxingData.patterns : [],
      trend: wuxingData && wuxingData.trend ? wuxingData.trend : null,
      // 2026-08-15 新增：综合分析-五行面板底部展示3个推荐
      trendTop3: wuxingData && wuxingData.trendTop3 ? wuxingData.trendTop3 : null,
      trendAction: 'showWuxingBacktest'
    });
  }

};

// 挂载到 ViewZodiacGiong 以保持外部 API 兼容
if (typeof ViewZodiacGiong !== 'undefined') {
  ViewZodiacGiong.renderLatestWuxingStats = ViewZodiacGiongWuxing.renderLatestWuxingStats;
  ViewZodiacGiong.showWuxingBacktestModal = ViewZodiacGiongWuxing.showWuxingBacktestModal;
  ViewZodiacGiong._renderWuxingContent = ViewZodiacGiongWuxing._renderWuxingContent;
}