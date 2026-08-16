/**
 * 视图层：Giong 综合分析 - 大小子标签页
 * 职责：渲染大小分析序列、统计、规律特征、趋势预测及回测弹窗
 * 依赖方向：在 view-zodiac-giong.js 之后加载，方法挂载到 ViewZodiacGiong
 * 拆分记录：2026-06-09 从 view-zodiac-giong.js 拆分
 */
const ViewZodiacGiongSize = {

  /**
   * 最近 N 期大小分析（序列 + 大小比例 + 规律 + 趋势预测）
   */
  renderLatestSizeStats: function(sizeData) {
    const container = document.getElementById('latestSizeStatsPanel');
    if (!container) return;
    if (!sizeData) {
      container.innerHTML = '';
      return;
    }
    const html = ViewZodiacGiongSize._buildSizeAnalysisHTML(sizeData);
    container.innerHTML = html;
  },

  /**
   * 构建大小分析卡片 HTML（v2.6.9 拆分：从 renderLatestSizeStats 提取）
   */
  _buildSizeAnalysisHTML: function(sizeData) {
    let html = '<div class="size-analysis-card">';
    html += '<div class="size-analysis-header">';
    html += '<div class="size-analysis-title">最近' + sizeData.period + '期大小分析</div>';
    html += '</div>';
    html += '<div class="size-analysis-content">';
    html += ViewZodiacGiongSize._renderSizeSequence(sizeData.sequence);
    html += ViewZodiacGiongSize._renderSizeStatsGrid(sizeData);
    html += ViewZodiacGiongSize._renderSizePatterns(sizeData.patterns);
    html += ViewZodiacGiongSize._renderSizeTrend(sizeData.trend);
    html += '</div></div>';
    return html;
  },

  /** 渲染大小序列 */
  _renderSizeSequence: function(sequence) {
    let html = '<div class="size-sequence-row">';
    sequence.slice().reverse().forEach(function(item) {
      const cls = item.size === '大' ? 'size-big' : 'size-small';
      html += '<span class="size-seq-item ' + cls + '">' + item.size + '</span>';
    });
    return html + '</div>';
  },

  /** 渲染大小统计网格 */
  _renderSizeStatsGrid: function(data) {
    let html = '<div class="size-stats-grid">';
    html += '<div class="size-stat-item size-stat-big">';
    html += '<div class="size-stat-label">大 (25-49)</div>';
    html += '<div class="size-stat-value">' + data.bigCount + '期</div>';
    html += '<div class="size-stat-percent">' + data.bigPercent + '%</div>';
    html += '</div>';
    html += '<div class="size-stat-item size-stat-small">';
    html += '<div class="size-stat-label">小 (1-24)</div>';
    html += '<div class="size-stat-value">' + data.smallCount + '期</div>';
    html += '<div class="size-stat-percent">' + data.smallPercent + '%</div>';
    html += '</div>';
    return html + '</div>';
  },

  /** 渲染规律特征列表 */
  _renderSizePatterns: function(patterns) {
    if (!patterns || patterns.length === 0) return '';
    let html = '<div class="size-patterns-section">';
    html += '<div class="size-patterns-title">规律特征</div>';
    html += '<div class="size-patterns-list">';
    patterns.forEach(function(pattern) {
      const cls = pattern.type.indexOf('连') !== -1 ? 'pattern-streak' : 'pattern-alternate';
      html += '<div class="size-pattern-tag ' + cls + '">';
      html += pattern.type;
      if (pattern.count > 1) html += '<span class="pattern-count">' + pattern.count + '次</span>';
      html += '</div>';
    });
    return html + '</div></div>';
  },

  /** 渲染趋势预测（点击触发回测） */
  _renderSizeTrend: function(trend) {
    if (!trend || trend.prediction === '-') return '';
    const cls = trend.prediction === '大' ? 'trend-big' : 'trend-small';
    let html = '<div class="size-trend-section" data-action="showSizeBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
    html += '<div class="size-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
    html += '<div class="size-trend-prediction">';
    html += '<span class="trend-result ' + cls + '">' + trend.prediction + '</span>';
    html += '<span class="trend-confidence">' + trend.confidence + '%可信度</span>';
    html += '</div>';
    if (trend.reason) html += '<div class="size-trend-reason">' + trend.reason + '</div>';
    return html + '</div>';
  },

  showSizeBacktestModal: function(backtestData) {
    ViewCommon.showBacktestModal({
      modalId: 'sizeBacktestModal',
      title: '📊 大小回测追踪',
      closeBtnId: 'closeSizeBacktestBtn',
      highlightColor: '#30D158',
      backtestData: backtestData,
      labels: { predicted: '预测', actual: '实际' },
      formatValue: function(item) {
        return {
          pred: item.predictedSize,
          actual: item.actualSize
        };
      },
      footerNote: '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>' +
        '• 基于大小趋势预测算法回测<br>' +
        '• 数据仅供参考，不构成投资建议'
    });
  },

  /**
   * 综合分析-大小子标签页内容
   */
  _renderSizeContent: function(sizeData) {
    if (!sizeData) return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';
    let html = '<div class="combined-sequence-row">';
    sizeData.sequence.slice().reverse().forEach(function(item) {
      const cls = item.size === '大' ? 'size-big' : 'size-small';
      html += '<span class="combined-seq-item ' + cls + '">' + item.size + '</span>';
    });
    html += '</div>';
    html += '<div class="combined-stats-row">';
    html += '<div class="combined-stat"><span class="stat-label stat-big">大</span><span class="stat-value">' + (sizeData.bigCount || 0) + '</span><span class="stat-percent">' + (sizeData.bigPercent || 0) + '%</span></div>';
    html += '<div class="combined-stat"><span class="stat-label stat-small">小</span><span class="stat-value">' + (sizeData.smallCount || 0) + '</span><span class="stat-percent">' + (sizeData.smallPercent || 0) + '%</span></div>';
    html += '</div>';
    if (sizeData.patterns && sizeData.patterns.length > 0) {
      html += '<div class="combined-patterns">';
      sizeData.patterns.forEach(function(p) { html += '<span class="pattern-tag">' + p.type.replace('大小', '') + p.count + '</span>'; });
      html += '</div>';
    }
    if (sizeData.trend && sizeData.trend.prediction !== '-') {
      const cls = sizeData.trend.prediction === '大' ? 'trend-big' : 'trend-small';
      html += '<div class="combined-trend" data-action="showSizeBacktest" style="cursor:pointer;">';
      html += '<span class="trend-predict ' + cls + '">' + sizeData.trend.prediction + '</span>';
      html += '<span class="trend-conf">' + sizeData.trend.confidence + '%</span>';
      if (sizeData.trend.reason) html += '<span class="trend-reason">' + sizeData.trend.reason + '</span>';
      html += '</div>';
    }
    return html;
  }

};

// 挂载到 ViewZodiacGiong 以保持外部 API 兼容
if (typeof ViewZodiacGiong !== 'undefined') {
  ViewZodiacGiong.renderLatestSizeStats = ViewZodiacGiongSize.renderLatestSizeStats;
  ViewZodiacGiong.showSizeBacktestModal = ViewZodiacGiongSize.showSizeBacktestModal;
  ViewZodiacGiong._renderSizeContent = ViewZodiacGiongSize._renderSizeContent;
}