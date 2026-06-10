/**
 * 视图层：主推面板（main panel，滑动窗口预测）
 * 职责：渲染"资料页"中的"主推标签页"，包含候选生肖卡片 + 评分详细表格 + 数据陈旧度提示
 * 依赖方向：被 business-main.js 调用
 * 拆分记录：2026-06-09 从 view-zodiac-prediction.js 拆分
 */
const ViewZodiacMain = {

  /**
   * 渲染主推标签页：滑动窗口预测结果
   * @param {Object} data - BusinessSlidingWindow.predict() 的返回结果
   */
  renderSlidingWindowPrediction: function(data) {
    var headerCard = document.getElementById('mainPredictHeaderCard');
    var candidatesCard = document.getElementById('mainCandidatesCard');
    var scoreTableCard = document.getElementById('mainScoreTableCard');
    var emptyCard = document.getElementById('mainEmptyCard');

    if (!data || !data.candidates || !data.candidates.length) {
      if (headerCard) headerCard.style.display = 'none';
      if (candidatesCard) candidatesCard.style.display = 'none';
      if (scoreTableCard) scoreTableCard.style.display = 'none';
      if (emptyCard) {
        emptyCard.style.display = '';
        var emptyTip = document.getElementById('mainEmptyTip');
        if (emptyTip) emptyTip.textContent = '数据不足（需至少12期历史数据），请先刷新数据';
      }
      return;
    }

    if (emptyCard) emptyCard.style.display = 'none';
    if (headerCard) headerCard.style.display = '';
    if (candidatesCard) candidatesCard.style.display = '';
    if (scoreTableCard) scoreTableCard.style.display = '';

    // 1. 渲染标题
    var titleEl = document.getElementById('mainPredictTitle');
    if (titleEl) {
      titleEl.textContent = '第' + data.nextExpect + '期 主推生肖（滑动窗口算法）';
    }

    // 2. 渲染候选卡片（前6名）
    var candidatesGrid = document.getElementById('mainCandidatesGrid');
    if (candidatesGrid) {
      var cardHtml = '<div class="zp-header-row">';
      cardHtml += '<button class="db-copy-btn" data-action="copyZodiacTop6" type="button" aria-label="复制主推候选生肖"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>';
      cardHtml += '</div>';
      cardHtml += '<div class="zodiac-pred-grid">';
      data.candidates.forEach(function(item, idx) {
        var rankNum = idx + 1;
        var cardClass = '';
        if (rankNum === 1) cardClass = 'card-rank-1';
        else if (rankNum === 2) cardClass = 'card-rank-2';
        else if (rankNum === 3) cardClass = 'card-rank-3';
        else cardClass = 'card-rank-other';

        var scoreColor = item.score >= 60 ? 'color:#30D158;' : (item.score >= 30 ? 'color:#FF9F0A;' : 'color:var(--sub-text);');

        cardHtml += ViewCommon.renderZodiacCardHtml(
          item.shengxiao, rankNum, cardClass, item.emoji,
          '<div class="zodiac-static-sub" style="font-size:11px;' + scoreColor + '">评分:' + item.score + '</div>'
        );
      });
      cardHtml += '</div>';
      candidatesGrid.innerHTML = cardHtml;
    }

    // 3. 渲染评分详细表格（所有12生肖）
    var scoreTable = document.getElementById('mainScoreTable');
    if (scoreTable) {
      var tableHtml = '<div class="sw-table-wrapper" style="overflow-x:auto;">';
      tableHtml += '<table class="sw-score-table" style="width:100%;border-collapse:collapse;font-size:12px;">';
      tableHtml += '<thead><tr style="background:var(--bg-secondary);">';
      tableHtml += '<th style="padding:6px 8px;text-align:left;border-bottom:1px solid var(--border);">生肖</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border);">6期</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border);">12期</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border);">24期</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border);">36期</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border);">评分</th>';
      tableHtml += '<th style="padding:6px 8px;text-align:center;border-bottom:1px solid var(--border);">遗漏</th>';
      tableHtml += '</tr></thead><tbody>';

      var allScores = data.allScores || [];
      allScores.forEach(function(item) {
        var isTop6 = data.candidates.some(function(c) { return c.shengxiao === item.shengxiao; });
        var rowBg = isTop6 ? 'background:rgba(48,209,88,0.06);' : '';
        var scoreStyle = item.score >= 60 ? 'color:#30D158;font-weight:700;' : (item.score >= 30 ? 'color:#FF9F0A;font-weight:600;' : 'color:var(--sub-text);');

        var zoneClass6 = ViewCommon.getZoneClass(item.zone6);    // V1.1 新增
        var zoneClass12 = ViewCommon.getZoneClass(item.zone12);
        var zoneClass24 = ViewCommon.getZoneClass(item.zone24);
        var zoneClass36 = ViewCommon.getZoneClass(item.zone36);

        tableHtml += '<tr style="' + rowBg + '">';
        tableHtml += '<td style="padding:6px 8px;font-weight:600;">' + item.shengxiao + '</td>';
        tableHtml += '<td style="padding:6px 8px;text-align:center;">' + item.window6 + ' <span class="freq-zone-tag ' + zoneClass6 + '" style="font-size:10px;padding:0 4px;">' + item.zone6 + '</span></td>';
        tableHtml += '<td style="padding:6px 8px;text-align:center;">' + item.window12 + ' <span class="freq-zone-tag ' + zoneClass12 + '" style="font-size:10px;padding:0 4px;">' + item.zone12 + '</span></td>';
        tableHtml += '<td style="padding:6px 8px;text-align:center;">' + item.window24 + ' <span class="freq-zone-tag ' + zoneClass24 + '" style="font-size:10px;padding:0 4px;">' + item.zone24 + '</span></td>';
        tableHtml += '<td style="padding:6px 8px;text-align:center;">' + item.window36 + ' <span class="freq-zone-tag ' + zoneClass36 + '" style="font-size:10px;padding:0 4px;">' + item.zone36 + '</span></td>';
        tableHtml += '<td style="padding:6px 8px;text-align:center;' + scoreStyle + '">' + item.score + '</td>';
        tableHtml += '<td style="padding:6px 8px;text-align:center;">' + (item.miss !== undefined ? item.miss + '期' : '—') + '</td>';
        tableHtml += '</tr>';
        // 信号行：独立一行显示在该生肖数据行下方
        if (item.signals && item.signals.length > 0) {
          tableHtml += '<tr style="' + rowBg + '">';
          tableHtml += '<td style="padding:3px 8px;"></td>';
          tableHtml += '<td colspan="6" style="padding:3px 8px;font-size:11px;color:var(--sub-text);border-bottom:1px solid var(--border);">';
          tableHtml += '→ ' + item.signals.join('；');
          tableHtml += '</td>';
          tableHtml += '</tr>';
        }
      });

      tableHtml += '</tbody></table></div>';
      scoreTable.innerHTML = tableHtml;
    }
  },

  /**
   * 渲染数据陈旧度提示
   * @param {number|null} timestamp - 数据缓存时间戳（毫秒），0 或 null 表示无缓存
   * @param {number|null} ageHours - 缓存年龄（小时），null 表示无法计算
   */
  renderDataFreshness: function(timestamp, ageHours) {
    var card = document.getElementById('mainDataFreshnessCard');
    var el = document.getElementById('mainDataFreshness');
    if (!card || !el) return;

    if (!timestamp || timestamp <= 0) {
      card.style.display = 'none';
      return;
    }

    var ageText, severityClass, icon, label;
    if (ageHours === null || ageHours === undefined) {
      ageText = '未知';
      severityClass = 'sw-freshness-unknown';
      icon = '⏱';
      label = '数据缓存时间未知';
    } else if (ageHours < 1) {
      ageText = '刚刚';
      severityClass = 'sw-freshness-fresh';
      icon = '✓';
      label = '数据为最新';
    } else if (ageHours < 24) {
      ageText = ageHours + '小时前';
      severityClass = 'sw-freshness-fresh';
      icon = '✓';
      label = '数据较新';
    } else if (ageHours < 72) {
      var days1 = Math.floor(ageHours / 24);
      ageText = days1 + '天前';
      severityClass = 'sw-freshness-stale';
      icon = '⚠';
      label = '数据可能已过时';
    } else {
      var daysN = Math.floor(ageHours / 24);
      ageText = daysN + '天前';
      severityClass = 'sw-freshness-expired';
      icon = '✕';
      label = '数据已严重过期，预测结果不可靠';
    }

    var updateTime = new Date(timestamp);
    var pad = function(n) { return n < 10 ? '0' + n : '' + n; };
    var timeStr = pad(updateTime.getMonth() + 1) + '-' + pad(updateTime.getDate()) + ' ' +
                  pad(updateTime.getHours()) + ':' + pad(updateTime.getMinutes());

    el.className = 'sw-freshness ' + severityClass;
    el.innerHTML =
      '<span class="sw-freshness-icon">' + icon + '</span>' +
      '<span class="sw-freshness-label">' + label + '</span>' +
      '<span class="sw-freshness-detail">最后更新：' + timeStr + '（' + ageText + '）</span>';

    card.style.display = '';
  }
};
