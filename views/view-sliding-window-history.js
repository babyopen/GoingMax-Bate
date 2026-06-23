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
   * @param {Array} [signalStats] - 2026-06-23 新增：按 signal 维度统计的命中率
   */
  render: function(backtestRecords, pendingPrediction, signalStats) {
    var listCard = document.getElementById('mainHistoryListCard');
    if (!listCard) return;

    // 显示卡片容器
    listCard.style.display = '';

    // 隐藏已废弃的实时推荐 DOM（保留 DOM 不动，按宪法不修改 index.html）
    this._hideDeprecatedLiveElements();

    // 动态注入回测追踪区块（在 cardBody 末尾）
    this._ensureBacktestContainer();
    this._renderBacktestSection(backtestRecords, pendingPrediction, signalStats);
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
   *   #mainBacktestSignalStats   2026-06-23 新增：按 signal 维度统计表
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
      '<div class="analysis-section-title sw-backtest-title">' +
        '<span>主推</span>' +
        '<button class="sw-backtest-toggle-btn" data-action="toggleBacktestSection">' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>' +
        '</button>' +
      '</div>' +
      '<div id="mainBacktestStats" class="sw-backtest-content"></div>' +
      '<div id="mainBacktestSignalStats" class="sw-backtest-content"></div>' +
      '<div id="mainBacktestList" class="sw-backtest-content"></div>';
    cardBody.appendChild(section);
  },

  /**
   * 渲染回测追踪区块（统计 + 列表）
   * @param {Array} [backtestRecords] - 回测记录列表
   * @param {Object} [pendingPrediction] - 当前预测（未开奖）
   * @param {Array} [signalStats] - 2026-06-23 新增：按 signal 维度统计
   * @private
   */
  _renderBacktestSection: function(backtestRecords, pendingPrediction, signalStats) {
    if (!Array.isArray(backtestRecords) || !backtestRecords.length) {
      this._renderBacktestEmpty();
      return;
    }
    var stats = BusinessSlidingWindowHistory.computeBacktestStats(backtestRecords);
    this._renderBacktestStats(stats);
    // 2026-06-23 新增：渲染按 signal 维度统计的命中率
    this._renderSignalStats(signalStats);
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
   * 渲染按 signal 维度统计的命中率（2026-06-23 新增）
   * 输入数据由 BusinessSlidingWindowHistory.computeSignalStats 产出：
   *   [{ signal, total, hit, miss, hitRate, rank1Hit, rank2Hit, rank3Hit, top3HitRate }, ...]
   * 默认显示前 10 个（按 hitRate 降序，业务层已排序）
   *
   * @param {Array} [signalStats] - signal 维度统计数组
   * @private
   */
  _renderSignalStats: function(signalStats) {
    var container = document.getElementById('mainBacktestSignalStats');
    if (!container) return;
    if (!Array.isArray(signalStats) || signalStats.length === 0) {
      container.innerHTML = '';
      return;
    }
    var MAX_ROWS = 10;
    var top = signalStats.slice(0, MAX_ROWS);
    var parts = [];
    parts.push(this._buildSignalTitleHtml(signalStats.length, top.length));
    parts.push(this._buildSignalHeaderHtml());
    for (var i = 0; i < top.length; i++) {
      parts.push(this._buildSignalRowHtml(top[i]));
    }
    container.innerHTML = parts.join('');
  },

  /**
   * 渲染 signal 表格标题
   * @private
   */
  _buildSignalTitleHtml: function(totalCount, displayedCount) {
    var sub = displayedCount < totalCount
      ? '（前 ' + displayedCount + ' / 共 ' + totalCount + '）'
      : '（共 ' + totalCount + '）';
    return '<div style="font-size:13px;font-weight:600;color:var(--primary-text);margin:14px 0 6px;">' +
      '信号命中率排名' +
      '<span style="font-size:11px;font-weight:400;color:var(--sub-text);margin-left:6px;">' + sub + '</span>' +
      '</div>';
  },

  /**
   * 渲染 signal 表格表头
   * @private
   */
  _buildSignalHeaderHtml: function() {
    return '<div style="display:flex;align-items:center;padding:6px 0;border-bottom:1px solid var(--border-color);font-size:11px;color:var(--sub-text);">' +
      '<span style="flex:1;">信号</span>' +
      '<span style="width:42px;text-align:right;">样本</span>' +
      '<span style="width:42px;text-align:right;">命中</span>' +
      '<span style="width:54px;text-align:right;">命中率</span>' +
      '<span style="width:54px;text-align:right;">top3</span>' +
      '</div>';
  },

  /**
   * 渲染 signal 表格单行
   * @private
   */
  _buildSignalRowHtml: function(item) {
    var hitRate = item.hitRate || 0;
    var top3Rate = item.top3HitRate || 0;
    // 样本量 < 3 视为"样本不足"，颜色降级为灰
    var lowSample = item.total < 3;
    var rateColor = lowSample ? 'color:var(--sub-text);' : this._getHitRateColor(hitRate);
    var top3Color = lowSample ? 'color:var(--sub-text);' : this._getHitRateColor(top3Rate);
    return '<div style="display:flex;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.05);font-size:12px;">' +
      '<span style="flex:1;color:var(--primary-text);" title="' + item.signal + '">' + item.signal + '</span>' +
      '<span style="width:42px;text-align:right;color:var(--sub-text);">' + item.total + '</span>' +
      '<span style="width:42px;text-align:right;color:var(--sub-text);">' + item.hit + '</span>' +
      '<span style="width:54px;text-align:right;font-weight:600;' + rateColor + '">' + hitRate + '%</span>' +
      '<span style="width:54px;text-align:right;font-weight:600;' + top3Color + '">' + top3Rate + '%</span>' +
      '</div>';
  },

  /**
   * 命中率数字 → 颜色（视图层辅助方法，不算业务计算）
   * @param {number} rate - 命中率（0-100）
   * @returns {string} 内联 style 片段
   * @private
   */
  _getHitRateColor: function(rate) {
    if (rate >= 50) return 'color:#30D158;';           // 绿：强势信号
    if (rate >= 30) return 'color:#FF9F0A;';           // 黄：中等信号
    return 'color:#FF453A;';                           // 红：弱信号
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
    html += '<span class="backtest-record-period">' + prediction.nextExpect + '期:</span>';
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
    var signalEl = document.getElementById('mainBacktestSignalStats');
    var listEl = document.getElementById('mainBacktestList');
    var sectionEl = document.getElementById('mainBacktestSection');
    if (!sectionEl) return;
    if (statsEl) statsEl.innerHTML = '<div class="empty-tip" style="font-size:12px;color:var(--sub-text);">数据不足12期，无法回测</div>';
    if (signalEl) signalEl.innerHTML = '';
    if (listEl) listEl.innerHTML = '';
  }
};
