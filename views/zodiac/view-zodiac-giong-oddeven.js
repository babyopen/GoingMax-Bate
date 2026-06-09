/**
 * 视图层：Giong 综合分析 - 单双子标签页
 * 职责：渲染单双分析序列、统计、规律特征、趋势预测及回测弹窗
 * 依赖方向：在 view-zodiac-giong.js 之后加载，方法挂载到 ViewZodiacGiong
 * 拆分记录：2026-06-09 从 view-zodiac-giong.js 拆分
 */
const ViewZodiacGiongOddEven = {

  /**
   * 最近 N 期单双分析
   */
  renderLatestOddEvenStats: function(oddEvenData) {
    var container = document.getElementById('latestOddEvenStatsPanel');
    if (!container) return;

    if (!oddEvenData) {
      container.innerHTML = '';
      return;
    }

    var html = '';
    html += '<div class="oddeven-analysis-card">';
    html += '<div class="oddeven-analysis-header">';
    html += '<div class="oddeven-analysis-title">最近' + oddEvenData.period + '期单双分析</div>';
    html += '</div>';

    html += '<div class="oddeven-analysis-content">';

    html += '<div class="oddeven-sequence-row">';
    var reversedSequence = oddEvenData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var typeClass = item.type === '单' ? 'type-odd' : 'type-even';
      html += '<span class="oddeven-seq-item ' + typeClass + '">' + item.type + '</span>';
    });
    html += '</div>';

    html += '<div class="oddeven-stats-grid">';
    html += '<div class="oddeven-stat-item oddeven-stat-odd">';
    html += '<div class="oddeven-stat-label">单 (奇数)</div>';
    html += '<div class="oddeven-stat-value">' + oddEvenData.oddCount + '期</div>';
    html += '<div class="oddeven-stat-percent">' + oddEvenData.oddPercent + '%</div>';
    html += '</div>';
    html += '<div class="oddeven-stat-item oddeven-stat-even">';
    html += '<div class="oddeven-stat-label">双 (偶数)</div>';
    html += '<div class="oddeven-stat-value">' + oddEvenData.evenCount + '期</div>';
    html += '<div class="oddeven-stat-percent">' + oddEvenData.evenPercent + '%</div>';
    html += '</div>';
    html += '</div>';

    if (oddEvenData.patterns && oddEvenData.patterns.length > 0) {
      html += '<div class="oddeven-patterns-section">';
      html += '<div class="oddeven-patterns-title">规律特征</div>';
      html += '<div class="oddeven-patterns-list">';
      oddEvenData.patterns.forEach(function(pattern) {
        html += '<div class="oddeven-pattern-tag ' + (pattern.type.indexOf('连') !== -1 ? 'pattern-streak-oddeven' : 'pattern-alternate-oddeven') + '">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (oddEvenData.trend && oddEvenData.trend.prediction !== '-') {
      html += '<div class="oddeven-trend-section" data-action="showOddEvenBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="oddeven-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="oddeven-trend-prediction">';
      var trendClass = oddEvenData.trend.prediction === '单' ? 'trend-odd' : 'trend-even';
      html += '<span class="trend-result ' + trendClass + '">' + oddEvenData.trend.prediction + '</span>';
      html += '<span class="trend-confidence">' + oddEvenData.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (oddEvenData.trend.reason) {
        html += '<div class="oddeven-trend-reason">' + oddEvenData.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  showOddEvenBacktestModal: function(backtestData) {
    ViewCommon.showBacktestModal({
      modalId: 'oddEvenBacktestModal',
      title: '📊 单双回测追踪',
      closeBtnId: 'closeOddEvenBacktestBtn',
      highlightColor: '#BF5AF2',
      backtestData: backtestData,
      labels: { predicted: '预测', actual: '实际' },
      formatValue: function(item) {
        return {
          pred: item.predictedType,
          actual: item.actualType
        };
      },
      footerNote: '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>' +
        '• 基于单双趋势预测算法回测<br>' +
        '• 数据仅供参考，不构成投资建议'
    });
  },

  /**
   * 综合分析-单双子标签页内容
   */
  _renderOddEvenContent: function(oddEvenData) {
    if (!oddEvenData) return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';

    var html = '';
    html += '<div class="combined-sequence-row">';
    var reversedSequence = oddEvenData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var typeClass = item.type === '单' ? 'type-odd' : 'type-even';
      html += '<span class="combined-seq-item oddeven-' + typeClass + '">' + item.type + '</span>';
    });
    html += '</div>';

    html += '<div class="combined-stats-row">';
    html += '<div class="combined-stat"><span class="stat-label stat-odd">单</span><span class="stat-value">' + (oddEvenData.oddCount || 0) + '</span><span class="stat-percent">' + (oddEvenData.oddPercent || 0) + '%</span></div>';
    html += '<div class="combined-stat"><span class="stat-label stat-even">双</span><span class="stat-value">' + (oddEvenData.evenCount || 0) + '</span><span class="stat-percent">' + (oddEvenData.evenPercent || 0) + '%</span></div>';
    html += '</div>';

    if (oddEvenData.patterns && oddEvenData.patterns.length > 0) {
      html += '<div class="combined-patterns">';
      oddEvenData.patterns.forEach(function(p) { html += '<span class="pattern-tag">' + p.type.replace('单双', '') + p.count + '</span>'; });
      html += '</div>';
    }

    if (oddEvenData.trend && oddEvenData.trend.prediction !== '-') {
      var trendClass = oddEvenData.trend.prediction === '单' ? 'trend-odd' : 'trend-even';
      html += '<div class="combined-trend" data-action="showOddEvenBacktest" style="cursor:pointer;">';
      html += '<span class="trend-predict ' + trendClass + '">' + oddEvenData.trend.prediction + '</span>';
      html += '<span class="trend-conf">' + oddEvenData.trend.confidence + '%</span>';
      if (oddEvenData.trend.reason) html += '<span class="trend-reason">' + oddEvenData.trend.reason + '</span>';
      html += '</div>';
    }

    return html;
  }

};

// 挂载到 ViewZodiacGiong 以保持外部 API 兼容
if (typeof ViewZodiacGiong !== 'undefined') {
  ViewZodiacGiong.renderLatestOddEvenStats = ViewZodiacGiongOddEven.renderLatestOddEvenStats;
  ViewZodiacGiong.showOddEvenBacktestModal = ViewZodiacGiongOddEven.showOddEvenBacktestModal;
  ViewZodiacGiong._renderOddEvenContent = ViewZodiacGiongOddEven._renderOddEvenContent;
}