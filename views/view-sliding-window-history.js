/**
 * 滑动窗口预测历史记录 · 视图层
 * 职责：渲染统计面板 + 历史记录列表
 * 禁止业务计算
 */
const ViewSlidingWindowHistory = {

  /** 生肖 Emoji 映射 */
  EMOJI_MAP: {
    '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
    '龙': '🐲', '蛇': '🐍', '马': '🐴', '羊': '🐑',
    '猴': '🐵', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
  },

  /**
   * 主渲染入口
   * @param {Array} records - 历史记录列表(已核对)
   */
  render: function(records) {
    var statsCard = document.getElementById('mainHistoryStatsCard');
    var listCard = document.getElementById('mainHistoryListCard');
    var emptyCard = document.getElementById('mainHistoryEmptyCard');

    if (!records || !records.length) {
      if (statsCard) statsCard.style.display = 'none';
      if (listCard) listCard.style.display = 'none';
      if (emptyCard) emptyCard.style.display = '';
      return;
    }

    if (emptyCard) emptyCard.style.display = 'none';
    if (statsCard) statsCard.style.display = '';
    if (listCard) listCard.style.display = '';

    var stats = BusinessSlidingWindowHistory.getStats(records);
    this._renderStats(stats);
    this._renderList(records);
  },

  /**
   * 渲染空状态（清空后或无数据时）
   */
  renderEmpty: function() {
    var statsCard = document.getElementById('mainHistoryStatsCard');
    var listCard = document.getElementById('mainHistoryListCard');
    var emptyCard = document.getElementById('mainHistoryEmptyCard');
    if (statsCard) statsCard.style.display = 'none';
    if (listCard) listCard.style.display = 'none';
    if (emptyCard) emptyCard.style.display = '';
    // 清理可能遗留的 header（清空记录时）
    var headers = document.querySelectorAll('.sw-stats-header');
    headers.forEach(function(h) { h.remove(); });
  },

  /**
   * 渲染统计面板
   * @private
   */
  _renderStats: function(stats) {
    var container = document.getElementById('mainHistoryStats');
    if (!container) return;

    // 渲染清空按钮（独立容器，避免重复）
    var parentEl = container.parentElement;
    if (parentEl) {
      var existing = parentEl.querySelector('.sw-stats-header');
      if (existing) existing.remove();
      var headerEl = document.createElement('div');
      headerEl.className = 'sw-stats-header';
      headerEl.innerHTML =
        '<span class="sw-stats-title">命中率统计</span>' +
        '<button type="button" class="sw-stats-clear-btn" data-action="clearSlidingWindowHistory">清空记录</button>';
      parentEl.insertBefore(headerEl, container);
    }

    var hitRateStyle = stats.hitRate >= 80 ? 'color:#30D158;' : (stats.hitRate >= 50 ? 'color:#FF9F0A;' : 'color:#FF453A;');
    var top3Style = stats.top3Rate >= 50 ? 'color:#30D158;' : (stats.top3Rate >= 30 ? 'color:#FF9F0A;' : 'color:var(--sub-text);');

    var html = '<div class="sw-stats-grid">';

    // 命中率
    html += '<div class="sw-stat-item">';
    html += '<div class="sw-stat-label">候选命中率</div>';
    html += '<div class="sw-stat-value" style="' + hitRateStyle + '">' + stats.hitRate.toFixed(1) + '%</div>';
    html += '<div class="sw-stat-sub">命中' + stats.hit + ' / 已核对' + stats.checked + '</div>';
    html += '</div>';

    // 前三命中率
    html += '<div class="sw-stat-item">';
    html += '<div class="sw-stat-label">前三命中率</div>';
    html += '<div class="sw-stat-value" style="' + top3Style + '">' + stats.top3Rate.toFixed(1) + '%</div>';
    html += '<div class="sw-stat-sub">第1/2/3名命中合计</div>';
    html += '</div>';

    // 第一名命中率
    html += '<div class="sw-stat-item">';
    html += '<div class="sw-stat-label">首选命中率</div>';
    html += '<div class="sw-stat-value">' + stats.firstRankRate.toFixed(1) + '%</div>';
    html += '<div class="sw-stat-sub">第1名命中 ' + (stats.rankStats[1] || 0) + ' 次</div>';
    html += '</div>';

    // 连续命中
    html += '<div class="sw-stat-item">';
    html += '<div class="sw-stat-label">最大连续命中</div>';
    html += '<div class="sw-stat-value">' + stats.maxConsecutiveHit + '期</div>';
    html += '<div class="sw-stat-sub">历史最长连胜</div>';
    html += '</div>';

    html += '</div>';

    // 排名分布柱状图
    if (stats.checked > 0) {
      html += '<div class="sw-rank-distribution">';
      html += '<div class="sw-rank-dist-title">排名分布</div>';
      html += '<div class="sw-rank-bars">';
      var maxRank = Math.max(1, stats.rankStats[1], stats.rankStats[2], stats.rankStats[3], stats.rankStats[4], stats.rankStats[5], stats.rankStats[6]);
      for (var r = 1; r <= 6; r++) {
        var count = stats.rankStats[r] || 0;
        var pct = stats.checked > 0 ? (count / stats.checked * 100).toFixed(0) : '0';
        var barHeight = Math.max(18, (count / maxRank * 100));
        var barColor = r <= 3 ? '#30D158' : (r <= 4 ? '#FF9F0A' : 'var(--sub-text)');
        html += '<div class="sw-rank-bar-item">';
        html += '<div class="sw-rank-bar-count">' + count + '</div>';
        html += '<div class="sw-rank-bar-track"><div class="sw-rank-bar-fill" style="height:' + barHeight + '%;background:' + barColor + ';"><span class="sw-rank-bar-pct">' + pct + '%</span></div></div>';
        html += '<div class="sw-rank-bar-label">第' + r + '名</div>';
        html += '</div>';
      }
      html += '</div></div>';
    }

    container.innerHTML = html;
  },

  /**
   * 渲染历史记录列表
   * @private
   */
  _renderList: function(records) {
    var container = document.getElementById('mainHistoryList');
    if (!container) return;

    var html = '';
    for (var i = 0; i < records.length; i++) {
      var rec = records[i];
      html += this._renderRow(rec);
    }
    container.innerHTML = html;
  },

  /**
   * 渲染单行记录
   * @private
   */
  _renderRow: function(rec) {
    var statusClass = '';
    var statusText = '';
    var actualDisplay = '';
    var rankDisplay = '';

    if (rec.hitStatus === 'pending') {
      statusClass = 'sw-row-pending';
      statusText = '待开奖';
      actualDisplay = '<span class="sw-actual-pending">?</span>';
      rankDisplay = '<span class="sw-rank-pending">—</span>';
    } else if (rec.hitStatus === 'hit') {
      statusClass = 'sw-row-hit';
      statusText = '命中';
      actualDisplay = this._renderActualWithZones(rec, 'hit');
      rankDisplay = '<span class="sw-rank-hit">第' + rec.hitRank + '名</span>';
    } else {
      statusClass = 'sw-row-miss';
      statusText = '未中';
      actualDisplay = this._renderActualWithZones(rec, 'miss');
      rankDisplay = '<span class="sw-rank-miss">未中</span>';
    }

    // 推荐时间格式化
    var recommendTimeStr = '';
    if (rec.recommendTime) {
      var d = new Date(rec.recommendTime);
      var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
      recommendTimeStr = pad(d.getMonth() + 1) + '-' + pad(d.getDate()) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
    }

    var html = '<div class="sw-history-row ' + statusClass + '">';
    html += '<div class="sw-row-header">';
    html += '<span class="sw-row-period">第' + rec.period + '期</span>';
    html += '<span class="sw-row-status">' + statusText + '</span>';
    html += '<span class="sw-row-time">' + recommendTimeStr + '</span>';
    html += '</div>';

    // 候选生肖(6个)
    html += '<div class="sw-row-candidates">';
    if (Array.isArray(rec.candidates)) {
      for (var i = 0; i < rec.candidates.length; i++) {
        var sx = rec.candidates[i];
        var isHit = sx === rec.actualZodiac && rec.hitStatus === 'hit';
        var candidateClass = isHit ? 'sw-candidate sw-candidate-hit' : 'sw-candidate';
        html += '<span class="' + candidateClass + '">';
        html += '<span class="sw-candidate-name">' + sx + '</span>';
        html += '</span>';
      }
    }
    html += '</div>';

    // 实际开奖
    html += '<div class="sw-row-result">';
    html += '<span class="sw-row-result-label">实际:</span>';
    html += actualDisplay;
    html += '<span class="sw-row-rank">' + rankDisplay + '</span>';
    html += '</div>';

    html += '</div>';
    return html;
  },

  /**
   * 渲染"实际生肖"span，含 emoji + 生肖名 + 3个窗口区域标签
   * @private
   */
  _renderActualWithZones: function(rec, status) {
    var emoji = this.EMOJI_MAP[rec.actualZodiac] || '';
    var cls = status === 'hit' ? 'sw-actual-hit' : 'sw-actual-miss';
    var html = '<span class="' + cls + '">' + emoji + rec.actualZodiac + '</span>';

    // 附加 3 个窗口区域标签（如有数据）
    var zones = rec.actualZones;
    if (zones && (zones.zone12 || zones.zone24 || zones.zone36)) {
      html += '<span class="sw-actual-zones">';
      if (zones.zone12) {
        html += '<span class="freq-zone-tag ' + ViewCommon.getZoneClass(zones.zone12) + '">' + zones.zone12 + '</span>';
      }
      if (zones.zone24) {
        html += '<span class="freq-zone-tag ' + ViewCommon.getZoneClass(zones.zone24) + '">' + zones.zone24 + '</span>';
      }
      if (zones.zone36) {
        html += '<span class="freq-zone-tag ' + ViewCommon.getZoneClass(zones.zone36) + '">' + zones.zone36 + '</span>';
      }
      html += '</span>';
    }

    return html;
  },

  /**
   * @deprecated 已迁移到 ViewCommon.getZoneClass（2026-06-09 重构）
   */
  _getZoneClass: function(zone) {
    return ViewCommon.getZoneClass(zone);
  }
};
