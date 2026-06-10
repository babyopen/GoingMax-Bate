/**
 * 滑动窗口预测 · 回测追踪 · 视图层
 * 职责：渲染回测追踪区块（统计 + 记录列表）
 *
 * 历史背景：
 *   - 2026-06-10 之前：包含实时推荐记录渲染（sw-history-row 自定义样式）
 *   - 2026-06-10：因"实时推荐"与"回测追踪"为同一份数据，移除实时推荐渲染
 *     统一复用 view-zodiac-giong / view-zodiac-predict 的 backtest-records-inline 样式
 *
 * 禁止业务计算（仅渲染）
 */
const ViewSlidingWindowHistory = {

  /**
   * 主渲染入口（仅回测追踪）
   * @param {Array} backtestRecords - 回测记录列表
   * @param {Object} [pendingPrediction] - 当前预测（未开奖），{ nextExpect, candidates }
   */
  render: function(backtestRecords, pendingPrediction) {
    var listCard = document.getElementById('mainHistoryListCard');
    if (!listCard) return;

    // 显示卡片容器
    listCard.style.display = '';

    // 隐藏已废弃的实时推荐 DOM（保留 DOM 不动，按宪法不修改 index.html）
    this._hideDeprecatedLiveElements();

    // 动态注入回测追踪区块（在 cardBody 末尾）
    this._ensureBacktestContainer();
    this._renderBacktestSection(backtestRecords, pendingPrediction);
  },

  /**
   * 渲染空状态（数据不足时调用，保持 API 兼容）
   */
  renderEmpty: function() {
    var listCard = document.getElementById('mainHistoryListCard');
    if (!listCard) return;
    listCard.style.display = '';
    this._hideDeprecatedLiveElements();
    this._ensureBacktestContainer();
    this._renderBacktestSection(null);   // 走空态分支
  },

  /**
   * 隐藏已废弃的实时推荐相关 DOM 元素（2026-06-10：index.html 已清理，函数保留作 no-op）
   * - 原 #mainHistoryList / #mainHistoryStatsCard / #mainHistoryEmptyCard / 「近30期推荐记录」标题
   *   已在 index.html 中物理删除，仅保留 #mainHistoryListCard 卡片容器复用为回测追踪容器
   * @private
   */
  _hideDeprecatedLiveElements: function() {
    // no-op：所有相关 DOM 已从 index.html 中删除，无需再隐藏
  },

  // ============================================================
  // 回测追踪区块（在实时推荐列表下方动态注入，不修改 index.html）
  // ============================================================

  /**
   * 确保回测追踪容器存在（首次渲染时动态创建）
   * 容器结构：
   *   .sw-backtest-divider      分隔线
   *   .sw-backtest-title         "回测追踪（最近30期）" + 说明
   *   #mainBacktestStats         回测统计面板（命中率等）
   *   #mainBacktestList          回测记录列表
   * @private
   */
  _ensureBacktestContainer: function() {
    var listCard = document.getElementById('mainHistoryListCard');
    if (!listCard) return;
    var cardBody = listCard.querySelector('.card-body');
    if (!cardBody) return;

    // 幂等：若已存在则不重复创建
    if (document.getElementById('mainBacktestSection')) return;

    var section = document.createElement('div');
    section.id = 'mainBacktestSection';
    section.className = 'sw-backtest-section';
    section.innerHTML =
      '<div class="sw-backtest-divider"></div>' +
      '<div class="analysis-section-title sw-backtest-title"><span>回测追踪</span></div>' +
      '<div id="mainBacktestStats"></div>' +
      '<div id="mainBacktestList"></div>';
    cardBody.appendChild(section);
  },

  /**
   * 渲染回测追踪区块（统计 + 列表）
   * @param {Array} [backtestRecords] - 回测记录列表
   * @private
   */
  _renderBacktestSection: function(backtestRecords, pendingPrediction) {
    if (!Array.isArray(backtestRecords) || !backtestRecords.length) {
      this._renderBacktestEmpty();
      return;
    }
    var stats = BusinessSlidingWindowHistory.computeBacktestStats(backtestRecords);
    this._renderBacktestStats(stats);
    this._renderBacktestList(backtestRecords, pendingPrediction);
  },

  /**
   * 渲染回测统计面板（命中率 + 排名分布）
   * @private
   */
  _renderBacktestStats: function(stats) {
    var container = document.getElementById('mainBacktestStats');
    if (!container) return;

    var hitRateStyle = stats.hitRate >= 80 ? 'color:#30D158;' : (stats.hitRate >= 50 ? 'color:#FF9F0A;' : 'color:#FF453A;');
    var top3Style = stats.top3Rate >= 50 ? 'color:#30D158;' : (stats.top3Rate >= 30 ? 'color:#FF9F0A;' : 'color:var(--sub-text);');

    var html = '<div class="sw-stats-grid">';

    // 回测命中率
    html += '<div class="sw-stat-item">';
    html += '<div class="sw-stat-label">回测命中率</div>';
    html += '<div class="sw-stat-value" style="' + hitRateStyle + '">' + stats.hitRate.toFixed(1) + '%</div>';
    html += '<div class="sw-stat-sub">命中' + stats.hit + ' / 回测' + stats.total + '</div>';
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

    // 最大连续命中
    html += '<div class="sw-stat-item">';
    html += '<div class="sw-stat-label">最大连续命中</div>';
    html += '<div class="sw-stat-value">' + stats.maxConsecutiveHit + '期</div>';
    html += '<div class="sw-stat-sub">回测期最长连胜</div>';
    html += '</div>';

    html += '</div>';

    // 排名分布柱状图
    if (stats.total > 0) {
      html += '<div class="sw-rank-distribution">';
      html += '<div class="sw-rank-dist-title">回测排名分布</div>';
      html += '<div class="sw-rank-bars">';
      var maxRank = Math.max(1, stats.rankStats[1] || 0, stats.rankStats[2] || 0, stats.rankStats[3] || 0, stats.rankStats[4] || 0, stats.rankStats[5] || 0, stats.rankStats[6] || 0);
      for (var r = 1; r <= 6; r++) {
        var count = stats.rankStats[r] || 0;
        var pct = stats.total > 0 ? (count / stats.total * 100).toFixed(0) : '0';
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
   * 渲染回测记录列表（使用统一 inline 样式，与 view-zodiac-giong / view-zodiac-predict 一致）
   * @private
   */
  _renderBacktestList: function(records, pendingPrediction) {
    var container = document.getElementById('mainBacktestList');
    if (!container) return;
    // 容器套上统一样式类（与 view-zodiac-giong:230 / view-zodiac-predict:132 一致）
    container.className = 'backtest-records backtest-records-inline';

    var html = '';

    // 未开奖条目：当前预测，排在列表最顶部
    if (pendingPrediction && pendingPrediction.candidates && pendingPrediction.candidates.length > 0) {
      html += this._renderPendingRow(pendingPrediction);
    }

    for (var i = 0; i < records.length; i++) {
      html += this._renderBacktestRow(records[i]);
    }
    container.innerHTML = html;
  },

  /**
   * 渲染单条回测记录（统一 inline 样式）
   * 输出结构与 view-zodiac-giong:247-251 / view-zodiac-predict:165-169 100% 一致
   *
   * V1.4.2 增强：被 Rule 2 软降权的生肖以"小一号灰色"呈现，命中生肖优先高亮
   * @private
   */
  _renderBacktestRow: function(rec) {
    var isHit = rec.hitStatus === 'hit';
    var hitText = isHit ? '准' : '错';
    var hitRowClass = isHit ? 'backtest-hit' : 'backtest-miss';

    // [V1.4.2] 降权生肖集合（向后兼容：旧记录无 crossExclusion 字段）
    var downweightedSet = {};
    if (rec.crossExclusion && Array.isArray(rec.crossExclusion.downweighted)) {
      rec.crossExclusion.downweighted.forEach(function(z) { downweightedSet[z] = true; });
    }

    // 高亮命中的生肖 + 标注降权生肖（视觉：命中优先 > 降权其次）
    var top6Html;
    if (isHit && rec.hitRank >= 1 && rec.hitRank <= rec.candidates.length) {
      var hitIdx = rec.hitRank - 1;
      top6Html = rec.candidates.map(function(z, i) {
        if (i === hitIdx) return '<span class="backtest-record-zodiac-hit">' + z + '</span>';
        if (downweightedSet[z]) return '<span class="backtest-record-zodiac-down" title="Rule2 软降权 ×' + (rec.crossExclusion.downweightFactor || 0) + '">' + z + '</span>';
        return z;
      }).join('');
    } else {
      top6Html = (rec.candidates || []).map(function(z) {
        if (downweightedSet[z]) return '<span class="backtest-record-zodiac-down" title="Rule2 软降权 ×' + (rec.crossExclusion.downweightFactor || 0) + '">' + z + '</span>';
        return z;
      }).join('');
    }

    // 实际特码数字格式化（如 2 → "02"）
    var actualNumRaw = rec.actualTe !== undefined ? rec.actualTe : (rec.actualNumber !== undefined ? rec.actualNumber : '');
    var actualNum = Utils.formatNum(actualNumRaw);

    var html = '<div class="backtest-record-row ' + hitRowClass + '">';
    html += '<span class="backtest-record-period">' + rec.period + '期:</span>';
    html += '<span class="backtest-record-predict">【<span class="backtest-record-zodiacs">' + top6Html + '</span>】</span>';
    html += '<span class="backtest-record-result">开:<b>' + rec.actualZodiac + '</b>' + actualNum + '<span class="backtest-record-hittext">' + hitText + '</span></span>';
    html += '</div>';
    return html;
  },

  /**
   * 渲染未开奖条目（当前预测，排在列表最顶部）
   * @param {Object} prediction - { nextExpect, candidates: [{shengxiao, ...}] }
   * @returns {string} HTML
   * @private
   */
  _renderPendingRow: function(prediction) {
    var zodiacNames = prediction.candidates.map(function(c) { return c.shengxiao; });
    var top6Html = zodiacNames.join('');

    var html = '<div class="backtest-record-row backtest-pending">';
    html += '<span class="backtest-record-period">第' + prediction.nextExpect + '期:</span>';
    html += '<span class="backtest-record-predict">【<span class="backtest-record-zodiacs">' + top6Html + '</span>】</span>';
    html += '<span class="backtest-record-result"><span class="backtest-record-hittext" style="color:var(--primary);">未开奖</span></span>';
    html += '</div>';
    return html;
  },

  /**
   * 渲染回测空状态（数据不足或回测失败时）
   * @private
   */
  _renderBacktestEmpty: function() {
    var statsEl = document.getElementById('mainBacktestStats');
    var listEl = document.getElementById('mainBacktestList');
    var sectionEl = document.getElementById('mainBacktestSection');
    if (!sectionEl) return;
    if (statsEl) statsEl.innerHTML = '<div class="empty-tip" style="font-size:12px;color:var(--sub-text);">数据不足12期，无法回测</div>';
    if (listEl) listEl.innerHTML = '';
  }
};
