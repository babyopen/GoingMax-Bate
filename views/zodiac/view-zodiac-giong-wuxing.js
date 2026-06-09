/**
 * 视图层：Giong 综合分析 - 五行子标签页
 * 职责：渲染五行分析序列、统计、规律特征、趋势预测及回测弹窗
 * 依赖方向：在 view-zodiac-giong.js 之后加载，方法挂载到 ViewZodiacGiong
 * 拆分记录：2026-06-09 从 view-zodiac-giong.js 拆分
 */
const ViewZodiacGiongWuxing = {

  renderLatestWuxingStats: function(wuxingData) {
    var container = document.getElementById('latestWuxingStatsPanel');
    if (!container) return;

    if (!wuxingData) {
      container.innerHTML = '';
      return;
    }

    var wuxingColors = {
      '金': { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', text: '#B8860B', light: 'rgba(255,215,0,0.12)' },
      '木': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D', light: 'rgba(34,197,94,0.12)' },
      '水': { bg: 'linear-gradient(135deg, #0EA5E9, #06B6D4)', text: '#0369A1', light: 'rgba(14,165,233,0.12)' },
      '火': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C', light: 'rgba(239,68,68,0.12)' },
      '土': { bg: 'linear-gradient(135deg, #A78BFA, #8B5CF6)', text: '#7C3AED', light: 'rgba(167,139,250,0.12)' }
    };

    var html = '';
    html += '<div class="wuxing-analysis-card">';
    html += '<div class="wuxing-analysis-header">';
    html += '<div class="wuxing-analysis-title">最近' + wuxingData.period + '期五行分析</div>';
    html += '</div>';

    html += '<div class="wuxing-analysis-content">';

    html += '<div class="wuxing-sequence-row">';
    var reversedSequence = wuxingData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var wxColor = wuxingColors[item.wuxing] || wuxingColors['金'];
      html += '<span class="wuxing-seq-item" style="background:' + wxColor.bg + ';color:#fff;">' + item.wuxing + '</span>';
    });
    html += '</div>';

    html += '<div class="wuxing-stats-grid">';
    var wuxingOrder = ['金', '木', '水', '火', '土'];
    wuxingOrder.forEach(function(wx) {
      var count = wuxingData.count[wx] || 0;
      var percent = Math.round((count / wuxingData.period) * 100);
      var wxColor = wuxingColors[wx];
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
    html += '</div>';

    if (wuxingData.patterns && wuxingData.patterns.length > 0) {
      html += '<div class="wuxing-patterns-section">';
      html += '<div class="wuxing-patterns-title">规律特征</div>';
      html += '<div class="wuxing-patterns-list">';
      wuxingData.patterns.forEach(function(pattern) {
        var patternWx = pattern.type.charAt(0);
        var wxColor = wuxingColors[patternWx] || { bg: '#666' };
        html += '<div class="wuxing-pattern-tag" style="background:' + wxColor.bg + ';">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (wuxingData.trend && wuxingData.trend.prediction !== '-') {
      var predWx = wuxingData.trend.prediction;
      var predColor = wuxingColors[predWx] || wuxingColors['金'];
      html += '<div class="wuxing-trend-section" data-action="showWuxingBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="wuxing-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="wuxing-trend-prediction">';
      html += '<span class="trend-result" style="background:' + predColor.bg + ';font-size:18px;font-weight:700;padding:4px 16px;border-radius:6px;color:#fff;">' + predWx + '</span>';
      html += '<span class="trend-confidence">' + wuxingData.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (wuxingData.trend.reason) {
        html += '<div class="wuxing-trend-reason">' + wuxingData.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  showWuxingBacktestModal: function(backtestData) {
    ViewCommon.showBacktestModal({
      modalId: 'wuxingBacktestModal',
      title: '📊 五行回测追踪',
      closeBtnId: 'closeWuxingBacktestBtn',
      highlightColor: '#A78BFA',
      backtestData: backtestData,
      labels: { predicted: '预测', actual: '实际' },
      formatValue: function(item) {
        return {
          pred: item.predictedWuxing,
          actual: item.actualWuxing
        };
      },
      footerNote: '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>' +
        '• 基于五行趋势预测算法回测<br>' +
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