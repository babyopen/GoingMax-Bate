/**
 * 视图层：Giong 综合分析 - 波色子标签页
 * 职责：渲染波色分析序列、统计、规律特征、趋势预测及回测弹窗
 * 依赖方向：在 view-zodiac-giong.js 之后加载，方法挂载到 ViewZodiacGiong
 * 拆分记录：2026-06-09 从 view-zodiac-giong.js 拆分
 */
const ViewZodiacGiongColor = {

  renderLatestColorStats: function(colorData) {
    const container = document.getElementById('latestColorStatsPanel');
    if (!container) return;
    if (!colorData) {
      container.innerHTML = '';
      return;
    }
    const html = ViewZodiacGiongColor._buildColorAnalysisHTML(colorData);
    container.innerHTML = html;
  },

  /** v2.6.9 拆分：波色调色板 */
  _COLOR_PALETTE: {
    '红': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C' },
    '蓝': { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', text: '#1D4ED8' },
    '绿': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D' }
  },

  /**
   * 构建波色分析卡片 HTML（v2.6.9 拆分：从 renderLatestColorStats 提取）
   */
  _buildColorAnalysisHTML: function(colorData) {
    let html = '<div class="color-analysis-card">';
    html += '<div class="color-analysis-header">';
    html += '<div class="color-analysis-title">最近' + colorData.period + '期波色分析</div>';
    html += '</div><div class="color-analysis-content">';
    html += ViewZodiacGiongColor._renderColorSequence(colorData.sequence);
    html += ViewZodiacGiongColor._renderColorStatsGrid(colorData);
    html += ViewZodiacGiongColor._renderColorPatterns(colorData.patterns);
    html += ViewZodiacGiongColor._renderColorTrend(colorData.trend);
    html += '</div></div>';
    return html;
  },

  /** 渲染波色序列 */
  _renderColorSequence: function(sequence) {
    const palette = ViewZodiacGiongColor._COLOR_PALETTE;
    let html = '<div class="color-sequence-row">';
    sequence.slice().reverse().forEach(function(item) {
      const cl = palette[item.color] || palette['红'];
      html += '<span class="color-seq-item" style="background:' + cl.bg + ';color:#fff;">' + item.color + '</span>';
    });
    return html + '</div>';
  },

  /** 渲染波色统计网格 */
  _renderColorStatsGrid: function(data) {
    const palette = ViewZodiacGiongColor._COLOR_PALETTE;
    let html = '<div class="color-stats-grid">';
    ['红', '蓝', '绿'].forEach(function(cl) {
      const count = data.count[cl] || 0;
      const percent = data.period > 0 ? Math.round((count / data.period) * 100) : 0;
      const clColor = palette[cl];
      html += '<div class="color-stat-item">';
      html += '<div class="color-stat-header" style="color:' + clColor.text + ';border-left:3px solid ' + clColor.text + ';">';
      html += '<span class="color-stat-name">' + cl + '</span>';
      html += '<span class="color-stat-count">' + count + '期</span>';
      html += '</div>';
      html += '<div class="color-stat-bar-bg">';
      html += '<div class="color-stat-bar-fill" style="width:' + percent + '%;background:' + clColor.bg + ';"></div>';
      html += '</div>';
      html += '<div class="color-stat-percent" style="color:' + clColor.text + ';">' + percent + '%</div>';
      html += '</div>';
    });
    return html + '</div>';
  },

  /** 渲染规律特征列表 */
  _renderColorPatterns: function(patterns) {
    if (!patterns || patterns.length === 0) return '';
    const palette = ViewZodiacGiongColor._COLOR_PALETTE;
    let html = '<div class="color-patterns-section">';
    html += '<div class="color-patterns-title">规律特征</div>';
    html += '<div class="color-patterns-list">';
    patterns.forEach(function(pattern) {
      const cl = palette[pattern.type.charAt(0)] || { bg: '#666' };
      html += '<div class="color-pattern-tag" style="background:' + cl.bg + ';">';
      html += pattern.type;
      if (pattern.count > 1) html += '<span class="pattern-count">' + pattern.count + '次</span>';
      html += '</div>';
    });
    return html + '</div></div>';
  },

  /** 渲染趋势预测（点击触发回测） */
  _renderColorTrend: function(trend) {
    if (!trend || trend.prediction === '-') return '';
    const palette = ViewZodiacGiongColor._COLOR_PALETTE;
    const predCl = trend.prediction;
    const predColor = palette[predCl] || palette['红'];
    let html = '<div class="color-trend-section" data-action="showColorBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
    html += '<div class="color-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
    html += '<div class="color-trend-prediction">';
    html += '<span class="trend-result" style="background:' + predColor.bg + ';font-size:18px;font-weight:700;padding:4px 16px;border-radius:6px;color:#fff;">' + predCl + '</span>';
    html += '<span class="trend-confidence">' + trend.confidence + '%可信度</span>';
    html += '</div>';
    if (trend.reason) html += '<div class="color-trend-reason">' + trend.reason + '</div>';
    return html + '</div>';
  },

  showColorBacktestModal: function(backtestData) {
    ViewCommon.showBacktestModal({
      modalId: 'colorBacktestModal',
      title: '📊 波色回测追踪',
      closeBtnId: 'closeColorBacktestBtn',
      highlightColor: '#EF4444',
      backtestData: backtestData,
      labels: { predicted: '预测', actual: '实际' },
      // 2026-08-15 新增：波色 Top 2 推荐（predictedColorTop2）— 与综合分析面板底部展示一致
      formatValue: function(item) {
        return {
          pred: item.predictedColorTop2 || item.predictedColor,
          actual: item.actualColor
        };
      },
      footerNote: '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)（Top 2 命中）<br>' +
        '• 基于波色 Top 2 推荐算法回测<br>' +
        '• 数据仅供参考，不构成投资建议'
    });
  },

  /**
   * 综合分析-波色子标签页内容
   */
  _renderColorContent: function(colorData) {
    return ViewCommon.renderCombinedAnalysisContent({
      sequence: colorData && colorData.sequence ? colorData.sequence : [],
      typePrefix: 'cl',
      valueKey: 'color',
      colors: { '红': '#EF4444', '蓝': '#3B82F6', '绿': '#22C55E' },
      stats: colorData ? colorData.count : null,
      total: colorData ? colorData.period : 0,
      patterns: colorData && colorData.patterns ? colorData.patterns : [],
      // 2026-08-15：波色面板底部展示 Top 2 推荐（3选2），与回测一致
      trendTop2: colorData && colorData.trendTop2 ? colorData.trendTop2 : null,
      trendAction: 'showColorBacktest'
    });
  }

};

// 挂载到 ViewZodiacGiong 以保持外部 API 兼容
if (typeof ViewZodiacGiong !== 'undefined') {
  ViewZodiacGiong.renderLatestColorStats = ViewZodiacGiongColor.renderLatestColorStats;
  ViewZodiacGiong.showColorBacktestModal = ViewZodiacGiongColor.showColorBacktestModal;
  ViewZodiacGiong._renderColorContent = ViewZodiacGiongColor._renderColorContent;
}