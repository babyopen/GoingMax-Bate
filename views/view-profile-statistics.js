/**
 * 视图层：资料页 - 数据统计面板渲染
 * @namespace ViewProfileStatistics
 * 职责：动态注入面板 DOM（不修改 index.html 已有 DOM），调用业务层数据并渲染表格
 * 依赖：business/business-profile-statistics.js、core/state.js
 * 红线：不写业务计算、不绑定事件
 */
const ViewProfileStatistics = {

  /**
   * 渲染并注入统计面板到 #profilePage（已存在则跳过，幂等）
   */
  renderStatisticsPanel: function() {
    var profilePage = document.getElementById('profilePage');
    if (!profilePage) return;
    if (document.getElementById('profileStatisticsPanel')) return;

    var panel = document.createElement('div');
    panel.className = 'zodiac-tab-panel';
    panel.id = 'profileStatisticsPanel';
    panel.innerHTML =
      '<div class="card">' +
        '<div class="card-header">' +
          '<h2>12 生肖统计</h2>' +
          '<div class="stats-meta" id="statsMetaZodiac"></div>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="stats-table-wrap" id="zodiacStatsTableBody">' +
            '<div class="empty-tip">计算中…</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h2>49 个号码分级</h2>' +
          '<div class="stats-meta" id="statsMetaGrade"></div>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="stats-table-wrap" id="numberGradesTableBody">' +
            '<div class="empty-tip">计算中…</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="card">' +
        '<div class="card-header">' +
          '<h2>01-49 号码统计</h2>' +
          '<div class="stats-meta" id="statsMetaNumber"></div>' +
        '</div>' +
        '<div class="card-body">' +
          '<div class="stats-table-scroll" id="numberStatsTableBody">' +
            '<div class="empty-tip">计算中…</div>' +
          '</div>' +
        '</div>' +
      '</div>';

    profilePage.appendChild(panel);

    // 注入完成后再计算并渲染
    this.refresh();
  },

  /**
   * 重新计算并刷新三个表格（数据更新时可再次调用）
   */
  refresh: function() {
    var historyData = (typeof StateManager !== 'undefined' && StateManager._state.analysis)
      ? StateManager._state.analysis.historyData
      : [];

    if (!historyData || historyData.length === 0) {
      this._renderEmpty('zodiacStatsTableBody', '暂无历史数据');
      this._renderEmpty('numberGradesTableBody', '暂无历史数据');
      this._renderEmpty('numberStatsTableBody', '暂无历史数据');
      this._renderMeta('statsMetaZodiac', '共 0 期');
      this._renderMeta('statsMetaGrade', '共 0 期');
      this._renderMeta('statsMetaNumber', '共 0 期');
      return;
    }

    var zodiacStats = BusinessProfileStatistics.calcZodiacStats(historyData);

    // 49 号码统计复用远端 a29bf8b 实现的 Business.calcFullAnalysis().numStatistics
    var fullAnalysis = (typeof Business !== 'undefined' && Business.calcFullAnalysis)
      ? Business.calcFullAnalysis()
      : null;
    var numberStats = (fullAnalysis && Array.isArray(fullAnalysis.numStatistics))
      ? fullAnalysis.numStatistics
      : [];

    var numberGrades = BusinessProfileStatistics.calcNumberGrades(numberStats);

    var issueCount = historyData.length;
    this._renderMeta('statsMetaZodiac', '基于最近 ' + issueCount + ' 期');
    this._renderMeta('statsMetaGrade', '基于最近 ' + issueCount + ' 期');
    this._renderMeta('statsMetaNumber', numberStats.length > 0 ? ('基于最近 ' + issueCount + ' 期') : '号码统计未生成');

    this._renderZodiacStats(zodiacStats);
    this._renderNumberGrades(numberGrades);
    this._renderNumberStats(numberStats);
  },

  // ============================================================
  // 私有渲染方法
  // ============================================================

  _renderMeta: function(id, text) {
    var el = document.getElementById(id);
    if (el) el.textContent = text;
  },

  _renderEmpty: function(id, msg) {
    var el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = '<div class="empty-tip">' + msg + '</div>';
  },

  _renderZodiacStats: function(stats) {
    var el = document.getElementById('zodiacStatsTableBody');
    if (!el) return;

    var rows = '';
    for (var i = 0; i < stats.length; i++) {
      var s = stats[i];
      var emoji = (typeof CONFIG !== 'undefined' && CONFIG.ZODIAC_EMOJI) ? (CONFIG.ZODIAC_EMOJI[s.zodiac] || '') : '';
      rows += '<tr>' +
        '<td><span class="stats-zodiac">' + emoji + ' ' + this._escapeHtml(s.zodiac) + '</span></td>' +
        '<td>' + s.count + '</td>' +
        '<td>' + this._escapeHtml(s.probability) + '</td>' +
        '<td>' + this._escapeHtml(s.avgGap) + '</td>' +
        '<td>' + this._escapeHtml(String(s.maxGap)) + '</td>' +
        '<td>' + this._escapeHtml(String(s.minGap)) + '</td>' +
        '<td>' + s.currentMiss + '</td>' +
      '</tr>';
    }

    el.innerHTML =
      '<table class="stats-table">' +
        '<thead><tr>' +
          '<th>生肖</th><th>出现次数</th><th>出现概率</th>' +
          '<th>平均间隔</th><th>最大间隔</th><th>最小间隔</th><th>当前遗漏</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  },

  _renderNumberGrades: function(grades) {
    var el = document.getElementById('numberGradesTableBody');
    if (!el) return;

    var rows = '';
    for (var i = 0; i < grades.length; i++) {
      var g = grades[i];
      var rangeStr = g.maxMiss === '∞' ? ('≥' + g.minMiss) : (g.minMiss + '-' + g.maxMiss);
      var samplesHtml = this._renderNumBalls(g.samples);
      if (g.omitted > 0) {
        samplesHtml += '<span class="stats-omit-tip">等 ' + g.count + ' 个</span>';
      }
      rows += '<tr>' +
        '<td><span class="stats-grade-dot" style="background:' + g.color + '"></span>' +
            this._escapeHtml(g.emoji) + ' ' + this._escapeHtml(g.level) + '</td>' +
        '<td>' + rangeStr + '</td>' +
        '<td>' + g.count + '</td>' +
        '<td>' + this._escapeHtml(g.percentage) + '</td>' +
        '<td class="stats-samples-cell">' + samplesHtml + '</td>' +
      '</tr>';
    }

    el.innerHTML =
      '<table class="stats-table">' +
        '<thead><tr>' +
          '<th>级别</th><th>区间</th><th>号码数</th><th>占比</th><th>代表号码</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  },

  _renderNumberStats: function(stats) {
    var el = document.getElementById('numberStatsTableBody');
    if (!el) return;

    if (!stats || stats.length === 0) {
      el.innerHTML = '<div class="empty-tip">号码统计未生成，请在控制台运行 Business.calcFullAnalysis() 查看</div>';
      return;
    }

    var rows = '';
    for (var i = 0; i < stats.length; i++) {
      var s = stats[i];
      rows += '<tr>' +
        '<td>' + this._renderNumBall(s.num) + '</td>' +
        '<td>' + s.count + '</td>' +
        '<td>' + Number(s.rate).toFixed(2) + '%</td>' +
        '<td>' + Number(s.avgGap).toFixed(1) + '</td>' +
        '<td>' + s.maxGap + '</td>' +
        '<td>' + s.minGap + '</td>' +
        '<td>' + s.currentMiss + '</td>' +
      '</tr>';
    }

    el.innerHTML =
      '<table class="stats-table">' +
        '<thead><tr>' +
          '<th>号码</th><th>出现次数</th><th>出现概率</th>' +
          '<th>平均间隔</th><th>最大间隔</th><th>最小间隔</th><th>当前遗漏</th>' +
        '</tr></thead>' +
        '<tbody>' + rows + '</tbody>' +
      '</table>';
  },

  /**
   * 渲染号码小球（单）
   * @private
   */
  _renderNumBall: function(num) {
    var n = Number(num);
    var colorClass = this._getColorClass(n);
    var display = n < 10 ? ('0' + n) : String(n);
    return '<span class="num-ball ' + colorClass + '">' + display + '</span>';
  },

  /**
   * 渲染号码小球列表（多）
   * @private
   */
  _renderNumBalls: function(nums) {
    if (!nums || nums.length === 0) return '<span class="stats-empty-num">—</span>';
    var html = '';
    for (var i = 0; i < nums.length; i++) {
      html += this._renderNumBall(nums[i]);
    }
    return html;
  },

  /**
   * 根据 CONFIG.COLOR_MAP 获取号码对应颜色 class
   * @private
   */
  _getColorClass: function(num) {
    if (typeof CONFIG === 'undefined' || !CONFIG.COLOR_MAP) return '';
    var map = CONFIG.COLOR_MAP;
    if (map['红'] && map['红'].indexOf(num) >= 0) return 'red';
    if (map['蓝'] && map['蓝'].indexOf(num) >= 0) return 'blue';
    if (map['绿'] && map['绿'].indexOf(num) >= 0) return 'green';
    return '';
  },

  /**
   * HTML 转义（安全渲染）
   * @private
   */
  _escapeHtml: function(s) {
    if (s === null || s === undefined) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
};