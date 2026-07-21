/**
 * 【视图层】最不可能出现 - 弹窗式回测入口（v2.3.0 重构）
 *
 * 职责：
 * - 注入「最不可能出现」入口卡片 DOM（首次调用时动态追加到 combinedAnalysisPanel 之后）
 * - 入口卡片仅展示"下一期预测"和回测摘要，点击进入弹窗查看 36 期完整回测
 * - 调用业务层算法 BusinessImpossible.calculateBacktrack 获取回测数据（动态加载）
 * - 通过 ImpossibleBacktrackModal 弹窗展示 36 期回测明细
 *
 * 列说明：期数 / 杀一肖 / 杀半波 / 禁一头 / 杀一尾 / 开奖结果 / 状态
 *   "杀" 命中 = 实际开奖不含被杀的项（正确杀掉）
 *   "杀" 错 = 实际开奖 = 被杀项（漏杀）
 *
 * 依赖方向：view → business → platform modal
 */
const ViewImpossible = {

  /** 动态加载状态，避免重复加载 */
  _bizLoaded: false,
  _bizLoading: null,

  /** 弹窗是否已加载 */
  _modalLoaded: false,

  /** 当前回测数据缓存（用于弹窗展示） */
  _btRows: null,

  /**
   * 确保容器存在。不存在则在 combinedAnalysisPanel 所在 card-body 末尾追加。
   * v2.4.0 修复：校验父容器存在且为可挂载元素
   */
  _ensureContainer: function() {
    const card = document.getElementById('impossibleCard');
    if (card && card.parentNode) return card;

    const host = document.getElementById('combinedAnalysisPanel');
    if (!host) return null;
    const body = host.parentNode;
    if (!body || typeof body.appendChild !== 'function') return null;

    const wrap = document.createElement('div');
    wrap.id = 'impossibleCard';
    wrap.innerHTML = '<div class="empty-tip">计算中…</div>';
    body.appendChild(wrap);
    return wrap;
  },

  /**
   * 按需加载业务层脚本。
   */
  _loadBusiness: function() {
    const self = this;
    if (self._bizLoaded) return Promise.resolve();
    if (self._bizLoading) return self._bizLoading;

    self._bizLoading = new Promise(function(resolve, reject) {
      const s = document.createElement('script');
      s.src = 'business/exclude/business-impossible.js';
      s.async = true;
      s.onload = function() {
        self._bizLoaded = true;
        self._bizLoading = null;
        resolve();
      };
      s.onerror = function() {
        self._bizLoading = null;
        reject(new Error('加载 business-impossible.js 失败'));
      };
      document.head.appendChild(s);
    });
    return self._bizLoading;
  },

  /**
   * 按需加载弹窗脚本。
   */
  _loadModal: function() {
    const self = this;
    if (self._modalLoaded) return Promise.resolve();

    return new Promise(function(resolve, reject) {
      const s = document.createElement('script');
      s.src = 'platform/web/modals/impossible-backtrack-modal.js';
      s.async = true;
      s.onload = function() {
        self._modalLoaded = true;
        resolve();
      };
      s.onerror = function() {
        reject(new Error('加载弹窗脚本失败'));
      };
      document.head.appendChild(s);
    });
  },

  /**
   * 主入口：渲染整张卡片（由 initGiongTab 调用）
   * @param {Array} historyData
   * @param {Array} precomputedSpecials - 与 historyData 前 N 项对齐的 specials
   * @param {number} backtrackLimit     - 回测最近 N 期，默认 36
   */
  render: function(historyData, precomputedSpecials, backtrackLimit) {
    const card = this._ensureContainer();
    if (!card) return;

    const self = this;
    self._loadBusiness().then(function() {
      if (typeof BusinessImpossible === 'undefined') {
        card.innerHTML = '<div class="empty-tip">算法加载失败</div>';
        return;
      }
      // 数据不足检查
      if (!historyData || historyData.length < BusinessImpossible.DEFAULT_WINDOW + 1) {
        card.innerHTML = '<div class="empty-tip">历史数据不足（需 ≥ ' +
          (BusinessImpossible.DEFAULT_WINDOW + 1) + ' 期）</div>';
        return;
      }
      // 当前预测（用于下一期）
      const nowData = BusinessImpossible.calculate(historyData, precomputedSpecials, { window: 24 });
      // 历史回测（36 期数据）
      const btRows = BusinessImpossible.calculateBacktrack(historyData, backtrackLimit || 36);
      // 缓存数据供弹窗使用
      self._btRows = btRows;
      self._render(card, nowData, btRows);
    }).catch(function(err) {
      card.innerHTML = '<div class="empty-tip">' + (err && err.message ? err.message : '加载失败') + '</div>';
    });
  },

  /**
   * 实际渲染 DOM：标题 + 下一期预测条 + 回测入口按钮 + 评分规则说明
   */
  _render: function(card, nowData, btRows) {
    let html = '';
    html += '<div class="impossible-card">';

    // 标题头
    html += '<div class="impossible-header">';
    html += '<div class="impossible-header-left">';
    html += '<span class="impossible-title">禁</span>';
    html += '<span class="impossible-subtitle">基于最近 24 期 · 5 维加权评分 · 每期=杀掉该选项</span>';
    html += '</div>';
    html += '</div>';

    // 下一期预测条
    if (nowData && nowData.zodiac) {
      html += this._renderNextRow(nowData);
    }

    // 回测入口（点击弹窗）
    html += this._renderBacktrackEntry(btRows);

    // 评分规则说明
    html += '<div class="impossible-footer">';
    html += '<div class="impossible-footer-title">评分规则（5 维加权）</div>';
    html += '<div class="impossible-footer-grid">';
    html += '<div class="footer-cell"><span class="footer-cell-label">频率倒数</span><span class="footer-cell-weight">30%</span></div>';
    html += '<div class="footer-cell"><span class="footer-cell-label">遗漏衰减</span><span class="footer-cell-weight">25%</span></div>';
    html += '<div class="footer-cell"><span class="footer-cell-label">近期冷热</span><span class="footer-cell-weight">20%</span></div>';
    html += '<div class="footer-cell"><span class="footer-cell-label">趋势方向</span><span class="footer-cell-weight">15%</span></div>';
    html += '<div class="footer-cell"><span class="footer-cell-label">反转信号</span><span class="footer-cell-weight">10%</span></div>';
    html += '</div>';
    html += '<div class="impossible-footer-tip">仅供娱乐参考 · 不构成投资建议</div>';
    html += '</div>';

    html += '</div>';

    card.innerHTML = html;

    // 绑定回测入口点击事件
    const entry = card.querySelector('.impossible-entry');
    if (entry) {
      const self = this;
      entry.addEventListener('click', function() {
        self._openBacktrackModal();
      });
    }
  },

  /**
   * 打开弹窗
   */
  _openBacktrackModal: function() {
    const self = this;
    self._loadModal().then(function() {
      if (typeof ImpossibleBacktrackModal === 'undefined') {
        if (typeof Toast !== 'undefined') Toast.show('弹窗加载失败');
        return;
      }
      const rows = self._btRows || [];
      let fullHit = 0;
      rows.forEach(function(r) { if (r.allHit) fullHit++; });
      const acc = rows.length ? Math.round((fullHit / rows.length) * 100) : 0;
      ImpossibleBacktrackModal.show(rows, {
        total: rows.length,
        fullHit: fullHit,
        acc: acc
      });
    }).catch(function() {
      if (typeof Toast !== 'undefined') Toast.show('弹窗加载失败');
    });
  },

  /**
   * 渲染"下一期预测"行
   */
  _renderNextRow: function(nowData) {
    const nextExpect = nowData.nextExpect;
    const z = nowData.zodiac.top.name;
    const half = (nowData.color.top.name) + (nowData.recentOdd ? '单' : '双');
    const t = nowData.tail.top.name;
    const h = nowData.head.top.name;

    return '<div class="impossible-next-block">' +
      '<div class="impossible-next-title">第 ' + nextExpect + ' 期 · 待开奖</div>' +
      '<div class="impossible-next-table-grid">' +
        '<div class="impossible-next-th">期数</div>' +
        '<div class="impossible-next-th">生肖</div>' +
        '<div class="impossible-next-th">波色</div>' +
        '<div class="impossible-next-th">头数</div>' +
        '<div class="impossible-next-th">尾数</div>' +
        '<div class="impossible-next-th">结果</div>' +
        '<div class="impossible-next-th">状态</div>' +
        '<div class="impossible-next-td"><b>' + nextExpect + '</b></div>' +
        '<div class="impossible-next-td">' + this._pill(z) + '</div>' +
        '<div class="impossible-next-td">' + this._pill(half) + '</div>' +
        '<div class="impossible-next-td">' + this._pill(h) + '</div>' +
        '<div class="impossible-next-td">' + this._pill(t) + '</div>' +
        '<div class="impossible-next-td"><span class="impossible-td-pending">？</span></div>' +
        '<div class="impossible-next-td"><span class="impossible-status impossible-status-pending">待开</span></div>' +
      '</div>' +
    '</div>';
  },

  /**
   * 渲染回测入口（点击弹窗）
   */
  _renderBacktrackEntry: function(rows) {
    if (!rows || !rows.length) {
      return '<div class="empty-tip">回测数据不足</div>';
    }

    let fullHit = 0;
    rows.forEach(function(r) { if (r.allHit) fullHit++; });
    const acc = rows.length ? Math.round((fullHit / rows.length) * 100) : 0;

    let accClass = 'impossible-summary-acc-low';
    if (acc >= 70) { accClass = 'impossible-summary-acc-high'; }
    else if (acc >= 50) { accClass = 'impossible-summary-acc-mid'; }

    return '<div class="impossible-entry" data-action="open-backtrack">' +
      '<div class="impossible-entry-left">' +
        '<div class="impossible-entry-title">回测记录（共 ' + rows.length + ' 期）</div>' +
        '<div class="impossible-entry-tip">点击查看 36 期完整回测明细</div>' +
      '</div>' +
      '<div class="impossible-entry-right">' +
        '<div class="impossible-entry-stats">' +
          '<span class="impossible-entry-stat">' +
            '<span class="impossible-entry-stat-label">5维全准</span>' +
            '<span class="impossible-entry-stat-val">' + fullHit + '</span>' +
          '</span>' +
          '<span class="impossible-entry-stat">' +
            '<span class="impossible-entry-stat-label">命中率</span>' +
            '<span class="impossible-entry-stat-val ' + accClass + '">' + acc + '%</span>' +
          '</span>' +
        '</div>' +
        '<div class="impossible-entry-arrow">›</div>' +
      '</div>' +
    '</div>';
  },

  /**
   * 杀号单元：命中=普通文本，错误=红色文字
   */
  _killCell: function(name, hit, numeric) {
    const cls = [
      'impossible-pill',
      numeric ? 'impossible-pill-num' : '',
      'impossible-pill-' + (hit ? 'ok' : 'err')
    ].filter(Boolean).join(' ');
    return '<span class="' + cls + '">' + name + '</span>';
  },

  /**
   * 单元（仅用于"下一期预测"行，无命中标记）
   */
  _pill: function(name) {
    return '<span class="impossible-pill">' + name + '</span>';
  }
};

window.ViewImpossible = ViewImpossible;