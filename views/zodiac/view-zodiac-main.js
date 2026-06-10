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
    if (headerCard) headerCard.style.display = 'none';
    if (candidatesCard) candidatesCard.style.display = '';
    if (scoreTableCard) scoreTableCard.style.display = '';

    // 1. 渲染标题（移至 zp-header-row 内，仅保留期号）
    var titleEl = document.getElementById('mainPredictTitle');
    if (titleEl) {
      titleEl.textContent = '';
    }

    // 2. 渲染候选卡片（前6名）
    var candidatesGrid = document.getElementById('mainCandidatesGrid');
    if (candidatesGrid) {
      var cardHtml = '<div class="zp-header-row">';
      cardHtml += '<span class="zp-header-period">第' + data.nextExpect + '期</span>';
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

    // 3. 渲染评分详细卡片（所有12生肖，卡片式布局适配手机端）
    var scoreTable = document.getElementById('mainScoreTable');
    if (scoreTable) {
      var cardHtml = '<div class="sw-score-cards" id="swScoreCards">';

      var allScores = data.allScores || [];
      allScores.forEach(function(item, idx) {
        var isTop6 = data.candidates.some(function(c) { return c.shengxiao === item.shengxiao; });
        var scoreStyle = item.score >= 60 ? 'color:#30D158;' : (item.score >= 30 ? 'color:#FF9F0A;' : 'color:var(--sub-text);');
        var top6Class = isTop6 ? ' sw-score-card-top6' : '';
        // 默认只展示第1张，其余折叠
        var collapsed = idx > 0 ? ' sw-score-card-collapsed' : '';

        var zoneClass6 = ViewCommon.getZoneClass(item.zone6);
        var zoneClass12 = ViewCommon.getZoneClass(item.zone12);
        var zoneClass24 = ViewCommon.getZoneClass(item.zone24);
        var zoneClass36 = ViewCommon.getZoneClass(item.zone36);

        // 判断生肖冷热（以 36 期区域为准）
        var isHot = ['zone-peak', 'zone-high', 'zone-ovht', 'zone-mid', 'zone-active'].indexOf(zoneClass36) >= 0;
        var nameClass = isHot ? ' sw-zone-hot' : ' sw-zone-cold';

        cardHtml += '<div class="sw-score-card' + top6Class + collapsed + '">';
        // 头部：生肖名 + 信号 + 评分 + 遗漏
        cardHtml += '<div class="sw-score-card-header">';
        cardHtml += '<span class="sw-score-card-name' + nameClass + '">' + item.shengxiao + '</span>';
        if (item.signals && item.signals.length > 0) {
          cardHtml += '<div class="sw-score-card-signals">';
          cardHtml += item.signals.join('；');
          cardHtml += '</div>';
        }
        cardHtml += '<span class="sw-score-card-score" style="' + scoreStyle + '">' + item.score + '</span>';
        cardHtml += '<span class="sw-score-card-miss">' + (item.miss !== undefined ? '遗漏' + item.miss + '期' : '—') + '</span>';
        cardHtml += '</div>';
        // 窗口区域行：4个窗口横排
        cardHtml += '<div class="sw-score-card-zones">';
        cardHtml += '<div class="sw-zone-item"><span class="sw-zone-label">6期</span><span class="freq-zone-tag ' + zoneClass6 + '" style="font-size:10px;padding:0 4px;">' + item.zone6 + item.window6 + '</span></div>';
        cardHtml += '<div class="sw-zone-item"><span class="sw-zone-label">12期</span><span class="freq-zone-tag ' + zoneClass12 + '" style="font-size:10px;padding:0 4px;">' + item.zone12 + item.window12 + '</span></div>';
        cardHtml += '<div class="sw-zone-item"><span class="sw-zone-label">24期</span><span class="freq-zone-tag ' + zoneClass24 + '" style="font-size:10px;padding:0 4px;">' + item.zone24 + item.window24 + '</span></div>';
        cardHtml += '<div class="sw-zone-item"><span class="sw-zone-label">36期</span><span class="freq-zone-tag ' + zoneClass36 + '" style="font-size:10px;padding:0 4px;">' + item.zone36 + item.window36 + '</span></div>';
        cardHtml += '</div>';
        cardHtml += '</div>';
      });

      // 折叠/展开按钮
      var totalCount = allScores.length;
      cardHtml += '<div class="sw-score-toggle-wrap">';
      cardHtml += '<button class="sw-score-toggle-btn" data-action="toggleScoreCards" data-expanded="false">';
      cardHtml += '展开全部（共' + totalCount + '个生肖）';
      cardHtml += '</button>';
      cardHtml += '</div>';

      cardHtml += '</div>';
      scoreTable.innerHTML = cardHtml;
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
