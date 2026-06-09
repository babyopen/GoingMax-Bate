/**
 * 视图层：Giong 综合分析 - 波色子标签页
 * 职责：渲染波色分析序列、统计、规律特征、趋势预测及回测弹窗
 * 依赖方向：在 view-zodiac-giong.js 之后加载，方法挂载到 ViewZodiacGiong
 * 拆分记录：2026-06-09 从 view-zodiac-giong.js 拆分
 */
const ViewZodiacGiongColor = {

  renderLatestColorStats: function(colorData) {
    var container = document.getElementById('latestColorStatsPanel');
    if (!container) return;

    if (!colorData) {
      container.innerHTML = '';
      return;
    }

    var colorColors = {
      '红': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C', light: 'rgba(239,68,68,0.12)' },
      '蓝': { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', text: '#1D4ED8', light: 'rgba(59,130,246,0.12)' },
      '绿': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D', light: 'rgba(34,197,94,0.12)' }
    };

    var html = '';
    html += '<div class="color-analysis-card">';
    html += '<div class="color-analysis-header">';
    html += '<div class="color-analysis-title">最近' + colorData.period + '期波色分析</div>';
    html += '</div>';

    html += '<div class="color-analysis-content">';

    html += '<div class="color-sequence-row">';
    var reversedSequence = colorData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var clColor = colorColors[item.color] || colorColors['红'];
      html += '<span class="color-seq-item" style="background:' + clColor.bg + ';color:#fff;">' + item.color + '</span>';
    });
    html += '</div>';

    html += '<div class="color-stats-grid">';
    var colorOrder = ['红', '蓝', '绿'];
    colorOrder.forEach(function(cl) {
      var count = colorData.count[cl] || 0;
      var percent = colorData.period > 0 ? Math.round((count / colorData.period) * 100) : 0;
      var clColor = colorColors[cl];
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
    html += '</div>';

    if (colorData.patterns && colorData.patterns.length > 0) {
      html += '<div class="color-patterns-section">';
      html += '<div class="color-patterns-title">规律特征</div>';
      html += '<div class="color-patterns-list">';
      colorData.patterns.forEach(function(pattern) {
        var patternCl = pattern.type.charAt(0);
        var clColor = colorColors[patternCl] || { bg: '#666' };
        html += '<div class="color-pattern-tag" style="background:' + clColor.bg + ';">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (colorData.trend && colorData.trend.prediction !== '-') {
      var predCl = colorData.trend.prediction;
      var predColor = colorColors[predCl] || colorColors['红'];
      html += '<div class="color-trend-section" data-action="showColorBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="color-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="color-trend-prediction">';
      html += '<span class="trend-result" style="background:' + predColor.bg + ';font-size:18px;font-weight:700;padding:4px 16px;border-radius:6px;color:#fff;">' + predCl + '</span>';
      html += '<span class="trend-confidence">' + colorData.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (colorData.trend.reason) {
        html += '<div class="color-trend-reason">' + colorData.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  showColorBacktestModal: function(backtestData) {
    ViewCommon.showBacktestModal({
      modalId: 'colorBacktestModal',
      title: '📊 波色回测追踪',
      closeBtnId: 'closeColorBacktestBtn',
      highlightColor: '#EF4444',
      backtestData: backtestData,
      labels: { predicted: '预测', actual: '实际' },
      formatValue: function(item) {
        return {
          pred: item.predictedColor,
          actual: item.actualColor
        };
      },
      footerNote: '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>' +
        '• 基于波色趋势预测算法回测<br>' +
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
      trend: colorData && colorData.trend ? colorData.trend : null,
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