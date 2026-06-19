/**
 * 视图层：资料页 - TongJi 标签页
 * @namespace ViewZodiacTongJi
 * 职责：仅渲染 TongJi 面板内容，不做业务计算
 * 调用方向：被 Business.switchZodiacTab 触发
 * 依赖：ViewCommon（全局）、ZodiacTongJi（业务层）/ ZodiacPrediction（兼容路径）
 *
 * 面板结构：
 *   1) 生肖统计表（生肖 / 出现次数 / 出现概率 / 平均间隔 / 最大间隔 / 最小间隔 / 当前遗漏）
 *   2) 号码冷热等级表（等级 / 区间 / 号码数 / 占比 / 代表号码）
 */
const ViewZodiacTongJi = {

  /**
   * 渲染 TongJi 面板到 #zodiacTongJiPanel（幂等）
   * @param {Object} [stats] - 业务层计算结果，可选
   *   {
   *     zodiac: { total, totalAppearances, rows: [...] },
   *     numLevel: { total, levels: [...], totalMiss }
   *   }
   * @param {Object} [sort] - 当前排序状态 { key, dir }，可选（2026-06-20 用户需求）
   */
  render: function(stats, sort) {
    var panel = document.getElementById('zodiacTongJiPanel');
    if (!panel) return;

    // 已注入则跳过
    if (document.getElementById('zodiacTongJiCard')) {
      // 若已存在但又传入了新数据，则只更新内容（保证切换 tab 后数据是新的）
      if (stats) {
        ViewZodiacTongJi._update(stats, sort);
      }
      return;
    }

    var card = document.createElement('div');
    card.className = 'card';
    card.id = 'zodiacTongJiCard';

    if (!stats) {
      card.innerHTML =
        '<div class="card-body">' +
          '<div class="empty-tip">暂无历史数据，请先刷新数据</div>' +
        '</div>';
      panel.appendChild(card);
      return;
    }

    card.innerHTML =
      '<div class="card-body">' +
        ViewZodiacTongJi._renderZodiacTable(stats.zodiac, sort) +
        ViewZodiacTongJi._renderNumLevelTable(stats.numLevel) +
      '</div>';

    panel.appendChild(card);
  },

  /**
   * 已渲染后用新数据刷新内容
   */
  _update: function(stats, sort) {
    var body = document.querySelector('#zodiacTongJiCard .card-body');
    if (!body) return;
    body.innerHTML =
      ViewZodiacTongJi._renderZodiacTable(stats.zodiac, sort) +
      ViewZodiacTongJi._renderNumLevelTable(stats.numLevel);
  },

  /**
   * 切换到 TongJi 标签时由 event.js / Business 调用
   */
  show: function() {
    this.render();
  },

  // ============================================================
  // 内部渲染方法
  // ============================================================

  /**
   * 渲染生肖统计表
   * @param {Object} zodiacStats - 业务层计算的生肖统计
   * @param {Object} [sort]      - 当前排序状态 { key, dir }（2026-06-20 用户需求）
   *   - key 与 th data-sort-key 一致
   *   - dir ∈ {'asc', 'desc', null}
   * 视图层调用业务层纯函数 sortZodiacRows 进行排序，不修改入参
   */
  _renderZodiacTable: function(zodiacStats, sort) {
    var html = '';
    html += '<div class="tj-section">';
    html += '<div class="tj-section-title">生肖统计</div>';

    if (!zodiacStats || !zodiacStats.rows || !zodiacStats.rows.length) {
      html += '<div class="empty-tip">数据不足</div>';
      html += '</div>';
      return html;
    }

    // 排序（2026-06-20 用户需求：表头点击升序降序）
    //   - 调业务层纯函数 sortZodiacRows；不修改 zodiacStats.rows
    var sortKey = sort && sort.key;
    var sortDir = sort && sort.dir;
    var rows = zodiacStats.rows;
    if (sortKey && typeof ZodiacPrediction !== 'undefined' && ZodiacPrediction.sortZodiacRows) {
      rows = ZodiacPrediction.sortZodiacRows(zodiacStats.rows, sortKey, sortDir);
    }

    // 排序图标辅助
    function sortIcon(key) {
      if (sortKey !== key) return '<span class="tj-sort-icon">↕</span>';
      return sortDir === 'desc'
        ? '<span class="tj-sort-icon tj-sort-icon-active">▼</span>'
        : '<span class="tj-sort-icon tj-sort-icon-active">▲</span>';
    }
    // 排序可点击的列
    function sortTh(key, label, extraCls) {
      var cls = 'tj-th-num tj-th-sortable' + (extraCls ? ' ' + extraCls : '');
      return '<th class="' + cls + '" data-action="zodiac-tongji-sort" data-sort-key="' + key + '">' +
        '<span class="tj-th-label">' + label + '</span>' +
        sortIcon(key) +
        '</th>';
    }

    html += '<div class="tj-zodiac-table-wrap">';
    html += '<table class="tj-zodiac-table">';
    html += '<thead><tr>';
    html += '<th class="tj-th-zod">生肖</th>';
    html += sortTh('count', '次数');
    html += sortTh('percent', '概率');
    html += sortTh('avgInterval', '间隔');
    html += sortTh('maxInterval', '最大间隔');
    html += sortTh('minInterval', '最小间隔');
    html += sortTh('currentMiss', '遗漏');
    html += '</tr></thead>';
    html += '<tbody>';

    rows.forEach(function(r) {
      var missCls = r.currentMiss >= 30 ? 'tj-cell-warn' : '';
      html += '<tr>';
      html += '<td class="tj-td-zod"><span class="tj-zod-name">' + r.zodiac + '</span></td>';
      html += '<td class="tj-td-num">' + r.count + '</td>';
      html += '<td class="tj-td-num">' + r.percent + '%</td>';
      html += '<td class="tj-td-num">' + r.avgInterval + '</td>';
      html += '<td class="tj-td-num">' + r.maxInterval + '</td>';
      html += '<td class="tj-td-num">' + r.minInterval + '</td>';
      html += '<td class="tj-td-num ' + missCls + '">' + r.currentMiss + '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '</div>';

    html += '<div class="tj-zodiac-footer">';
    html += '共 ' + zodiacStats.total + ' 期数据，12 生肖合计出现 ' + zodiacStats.totalAppearances + ' 次';
    html += '</div>';

    html += '</div>';
    return html;
  },

  /**
   * 渲染号码冷热等级表
   */
  _renderNumLevelTable: function(numStats) {
    var html = '';
    html += '<div class="tj-section">';
    html += '<div class="tj-section-title">号码冷热等级</div>';

    if (!numStats || !numStats.levels || !numStats.levels.length) {
      html += '<div class="empty-tip">数据不足</div>';
      html += '</div>';
      return html;
    }

    html += '<div class="tj-level-table-wrap">';
    html += '<table class="tj-level-table">';
    html += '<thead><tr>';
    html += '<th class="tj-th-level">等级</th>';
    html += '<th class="tj-th-range">区间</th>';
    html += '<th class="tj-th-num">号码数</th>';
    html += '<th class="tj-th-num">占比</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    // 2026-06-20 用户需求：每个等级渲染 2 行
    //   第 1 行：等级 / 区间 / 号码数 / 占比
    //   第 2 行：代表号码（跨 4 列，单独占一行；2026-06-20 优化为 chip 化展示）
    numStats.levels.forEach(function(lv) {
      var levelCls = 'tj-level-' + lv.key;

      // 主行：等级 / 区间 / 号码数 / 占比
      //   - 用 inline style 在最左侧加 3px 等级色条（避免给 td 加 class）
      //   - lv.key 已被 CSS 选择器覆盖（.tj-level-hot / warm / cold / deep）
      html += '<tr class="tj-row-main ' + levelCls + '">';
      html += '<td class="tj-td-level"><span class="tj-level-tag ' + levelCls + '">' +
        lv.emoji + ' ' + lv.name +
        '</span></td>';
      html += '<td class="tj-td-range">' + lv.rangeText + '</td>';
      html += '<td class="tj-td-num">' + lv.count + '</td>';
      html += '<td class="tj-td-num">' + lv.percent + '%</td>';
      html += '</tr>';

      // 副行：代表号码（跨 4 列），号码 chip 化
      html += '<tr class="tj-row-rep ' + levelCls + '">';
      html += '<td class="tj-td-rep" colspan="4">';
      if (lv.nums.length) {
        html += '<div class="tj-num-chips">';
        lv.nums.forEach(function(n) {
          var numStr = n < 10 ? '0' + n : '' + n;
          html += '<span class="tj-num-chip ' + levelCls + '">' + numStr + '</span>';
        });
        html += '</div>';
      } else {
        html += '<span class="tj-num-empty">—</span>';
      }
      html += '</td>';
      html += '</tr>';
    });

    html += '</tbody></table>';
    html += '</div>';

    html += '<div class="tj-level-footer">';
    html += '基于最近 ' + (numStats.historyLength || 0) + ' 期数据（共 ' + numStats.total + ' 个号码）';
    html += '</div>';

    html += '</div>';
    return html;
  }
};
