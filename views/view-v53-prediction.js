/**
 * V5.3 预测结果视图渲染
 * 遵循架构规范：只负责DOM渲染，不包含业务计算
 */
const ViewV53Prediction = {
  /**
   * 渲染V5.3主推荐面板
   * @param {Object} result - BusinessV53Engine.run()的返回值
   */
  renderMainPanel: function(result) {
    var container = document.getElementById('v53MainPanel');
    if (!container) return;

    if (!result || result.error) {
      container.innerHTML = '<div class="empty-tip">' + (result ? result.message : '暂无计算结果') + '</div>';
      return;
    }

    var rec = result.recommendations;
    var trendLabels = {
      'strongHot': '强热',
      'strongCold': '强冷',
      'oscillation': '震荡'
    };

    var html = '';

    // 趋势标识 + 性能
    html += '<div class="v53-trend-row">';
    html += '<span class="v53-trend-badge trend-' + result.trend + '">' + (trendLabels[result.trend] || result.trend) + '</span>';
    if (result.extremeCorner) {
      html += '<span class="v53-trend-badge trend-extreme">极端拐点</span>';
    }
    html += '<span class="v53-meta-time">' + result.computeTime + 'ms</span>';
    html += '</div>';

    // 主推号码
    html += '<div class="v53-section">';
    html += '<div class="db-section-label">主推 ' + rec.main.length + ' 码</div>';
    html += '<div class="db-number-grid" id="v53MainGrid" style="grid-template-columns:repeat(' + Math.min(rec.main.length, 4) + ',1fr);">';
    rec.main.forEach(function(num, idx) {
      var rank = idx + 1;
      var rankClass = rank === 1 ? 'card-rank-1' : (rank === 2 ? 'card-rank-2' : (rank === 3 ? 'card-rank-3' : 'card-rank-other'));
      var zodiac = BusinessV53Utils.numToZodiac(num);
      var score = result.scores[num] || 0;
      var state = result.dynamicStates[num];
      var statusTag = '';
      if (state) {
        statusTag = ViewV53Prediction._statusTag(state.status);
      }

      html += '<div class="db-card-item ' + rankClass + '" data-action="showV53Detail" data-num="' + num + '">';
      html += '<div class="db-rank-badge">' + rank + '</div>';
      html += '<div class="db-card-name">' + zodiac + '</div>';
      html += '<div class="v53-score-mini">' + score.toFixed(1) + '</div>';
      html += statusTag;
      html += '</div>';
    });
    html += '</div></div>';

    // 备选号码
    html += '<div class="v53-section">';
    html += '<div class="db-section-label">备选 ' + rec.backup.length + ' 码</div>';
    html += '<div class="db-number-grid" style="grid-template-columns:repeat(' + Math.min(rec.backup.length, 2) + ',1fr);">';
    rec.backup.forEach(function(num, idx) {
      var zodiac = BusinessV53Utils.numToZodiac(num);
      var score = result.scores[num] || 0;

      html += '<div class="db-card-item" data-action="showV53Detail" data-num="' + num + '">';
      html += '<div class="db-card-name">' + zodiac + '</div>';
      html += '<div class="v53-score-mini">' + score.toFixed(1) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    // 推荐规则说明
    html += '<div class="v53-rule-hint">策略: ' + this._ruleHint(result.trend, result.extremeCorner) + '</div>';

    container.innerHTML = html;
  },

  /**
   * 渲染预警横幅
   */
  renderWarnings: function(warnings) {
    var container = document.getElementById('v53Warnings');
    if (!container) return;

    if (!warnings || !warnings.length) {
      container.style.display = 'none';
      return;
    }

    var html = '<div class="v53-warning-banner">';
    warnings.forEach(function(w) {
      html += '<div class="v53-warning-item">' + w + '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
    container.style.display = 'block';
  },

  /**
   * 渲染详细评分表
   */
  renderScoreDetail: function(result) {
    var container = document.getElementById('v53ScoreTable');
    if (!container || !result || result.error) return;

    var scores = result.scores;
    var sorted = result.sorted;
    var states = result.dynamicStates;
    var zones = result.zoneClass;
    var freq12 = result.windowFreq ? result.windowFreq['12'] : {};

    var html = '<div class="v53-score-table-wrapper"><table class="v53-score-table">';
    html += '<thead><tr>';
    html += '<th>号码</th><th>生肖</th><th>最终分</th><th>12期</th><th>分区</th><th>状态</th>';
    html += '</tr></thead><tbody>';

    sorted.forEach(function(item) {
      var n = item.number;
      var zodiac = BusinessV53Utils.numToZodiac(n);
      var f12 = freq12[n] || 0;
      var zone = zones[n] || '-';
      var state = states[n];
      var statusLabel = state ? ViewV53Prediction._statusLabel(state.status) : '-';
      var zoneLabels = { peak: '顶峰', down: '降权', rotate: '轮动', wait: '等待', silent: '静默' };

      html += '<tr>';
      html += '<td class="v53-td-num">' + n + '</td>';
      html += '<td>' + zodiac + '</td>';
      html += '<td class="v53-td-score">' + item.score.toFixed(1) + '</td>';
      html += '<td>' + f12 + '次</td>';
      html += '<td>' + (zoneLabels[zone] || zone) + '</td>';
      html += '<td>' + statusLabel + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    container.innerHTML = html;
  },

  // ========== 辅助方法 ==========
  _ruleHint: function(trend, extreme) {
    if (extreme) return '极端拐点·反向替换';
    var hints = {
      'strongHot': '强热趋势·热池前4 + 热5冷1',
      'strongCold': '强冷趋势·冷池前3 + 顺位第4',
      'oscillation': '震荡趋势·热冷交替 + 变盘06'
    };
    return hints[trend] || '默认策略';
  },

  _statusTag: function(status) {
    var S = BusinessV53Config.STATUS;
    if (status === S.NORMAL_HOT) return '<span class="v53-tag v53-tag-hot">热</span>';
    if (status === S.NORMAL_COLD) return '<span class="v53-tag v53-tag-cold">冷</span>';
    if (status === S.HOT_TO_COLD_HARD_OBSERVE || status === S.HOT_TO_COLD_SOFT_OBSERVE) return '<span class="v53-tag v53-tag-observe">转冷</span>';
    if (status === S.COLD_TO_HOT_HARD_OBSERVE || status === S.COLD_TO_HOT_SOFT_OBSERVE) return '<span class="v53-tag v53-tag-observe">转热</span>';
    return '';
  },

  _statusLabel: function(status) {
    var S = BusinessV53Config.STATUS;
    var labels = {};
    labels[S.NORMAL_HOT] = '热号';
    labels[S.NORMAL_COLD] = '冷号';
    labels[S.HOT_TO_COLD_HARD_OBSERVE] = '热→冷(硬)';
    labels[S.HOT_TO_COLD_SOFT_OBSERVE] = '热→冷(软)';
    labels[S.COLD_TO_HOT_HARD_OBSERVE] = '冷→热(硬)';
    labels[S.COLD_TO_HOT_SOFT_OBSERVE] = '冷→热(软)';
    return labels[status] || status;
  },

  /**
   * 切换V5.3详情面板展开/收起（符合分层规范：视图层负责DOM渲染）
   */
  toggleDetail: function() {
    var panel = document.getElementById('v53DetailPanel');
    var toggle = document.getElementById('v53DetailToggle');
    if (!panel || !toggle) return;

    var isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';

    var arrow = toggle.querySelector('svg');
    if (arrow) {
      arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }

    if (isHidden) {
      var result = BusinessV53Engine.getLastResult();
      if (result) {
        ViewV53Prediction.renderScoreDetail(result);
      }
    }
  }
};