/**
 * 平台层：最不可能出现 - 36 期回测记录弹窗（v2.4.0 优化）
 *
 * 职责：弹窗 DOM 创建、显示/隐藏、内容渲染
 * 调用：ImpossibleBacktrackModal.show(rows, stats)
 *
 * v2.3.1 修复：
 * 1. 内容容器固定高度，启用独立滚动，避免被标题/统计条挤压
 * 2. 表头 sticky 定位，滚动时表头固定在顶部
 * 3. ESC 键关闭弹窗
 * 4. 暗色模式补充：胶囊、表格文字、行高亮、底部提示
 * 5. 内容区 max-height + 内边距，防止内容溢出
 *
 * v2.4.0 优化：
 * 1. hide 后延迟 300ms 销毁 DOM（等过渡动画完成），下次 show 自动重建
 * 2. 提供 destroy() 主动清理接口
 * 3. 修复 DOM 重渲染/HMR 场景下的引用失效
 */
const ImpossibleBacktrackModal = {
  _modal: null,
  _escHandler: null,
  _destroyTimer: null,

  /**
   * 初始化（首次调用时创建 DOM）
   * v2.4.0 修复：检查 DOM 是否还在文档中（重渲染/HMR 兼容）
   */
  init: function() {
    // 如果 _modal 引用还在但 DOM 已不在文档中（如父节点被重渲染），清理引用
    if (ImpossibleBacktrackModal._modal) {
      if (document.body.contains(ImpossibleBacktrackModal._modal)) {
        return;
      }
      ImpossibleBacktrackModal._modal = null;
    }

    // 取消待执行的销毁任务（如果用户在延迟期间重新打开）
    if (ImpossibleBacktrackModal._destroyTimer) {
      clearTimeout(ImpossibleBacktrackModal._destroyTimer);
      ImpossibleBacktrackModal._destroyTimer = null;
    }

    const modal = document.createElement('div');
    modal.id = 'impossible-backtrack-modal';
    modal.className = 'impossible-bm-mask';
    modal.innerHTML = [
      '<div class="impossible-bm-card">' +
        '<div class="impossible-bm-header">' +
          '<div class="impossible-bm-title">回测记录</div>' +
          '<button class="impossible-bm-close" type="button" aria-label="关闭">×</button>' +
        '</div>' +
        '<div class="impossible-bm-stats"></div>' +
        '<div class="impossible-bm-body">' +
          '<div class="impossible-bm-content"></div>' +
        '</div>' +
      '</div>'
    ].join('');

    document.body.appendChild(modal);
    ImpossibleBacktrackModal._modal = modal;

    // 关闭事件
    modal.querySelector('.impossible-bm-close').addEventListener('click', function() {
      ImpossibleBacktrackModal.hide();
    });
    modal.addEventListener('click', function(e) {
      if (e.target === modal) ImpossibleBacktrackModal.hide();
    });

    // ESC 关闭
    ImpossibleBacktrackModal._escHandler = function(e) {
      if (e.key === 'Escape' || e.keyCode === 27) {
        ImpossibleBacktrackModal.hide();
      }
    };
  },

  /**
   * 显示弹窗
   * @param {Array} rows - 回测数据行
   * @param {Object} stats - { total, fullHit, acc }
   */
  show: function(rows, stats) {
    ImpossibleBacktrackModal.init();
    if (!rows || !rows.length) {
      if (typeof Toast !== 'undefined') Toast.show('暂无回测数据');
      return;
    }
    const modal = ImpossibleBacktrackModal._modal;
    if (!modal) return;

    // 统计
    const total = stats && stats.total != null ? stats.total : rows.length;
    const fullHit = stats && stats.fullHit != null ? stats.fullHit : 0;
    const acc = stats && stats.acc != null ? stats.acc : 0;
    let accColor = '#DC2626';
    if (acc >= 70) accColor = '#16a34a';
    else if (acc >= 50) accColor = '#f59e0b';

    modal.querySelector('.impossible-bm-stats').innerHTML =
      '共 <b>' + total + '</b> 期 · ' +
      '5维全准 <b style="color:#16a34a;">' + fullHit + '</b> 期 · ' +
      '命中率 <b style="color:' + accColor + ';">' + acc + '%</b>';

    // 渲染表格
    modal.querySelector('.impossible-bm-content').innerHTML = ImpossibleBacktrackModal._renderTable(rows);

    modal.style.visibility = 'visible';
    modal.style.opacity = '1';
    const card = modal.querySelector('.impossible-bm-card');
    if (card) card.style.transform = 'scale(1)';

    // 绑定 ESC
    if (ImpossibleBacktrackModal._escHandler) {
      document.addEventListener('keydown', ImpossibleBacktrackModal._escHandler);
    }

    // 锁定 body 滚动
    document.body.style.overflow = 'hidden';
  },

  /**
   * 隐藏弹窗（v2.4.0 优化）
   * 隐藏后延迟 300ms 销毁 DOM（等待 CSS 过渡完成）
   */
  hide: function() {
    const modal = ImpossibleBacktrackModal._modal;
    if (!modal) return;
    modal.style.opacity = '0';
    modal.style.visibility = 'hidden';
    const card = modal.querySelector('.impossible-bm-card');
    if (card) card.style.transform = 'scale(0.95)';

    // 解绑 ESC
    if (ImpossibleBacktrackModal._escHandler) {
      document.removeEventListener('keydown', ImpossibleBacktrackModal._escHandler);
    }

    // 恢复 body 滚动
    document.body.style.overflow = '';

    // 延迟销毁 DOM（等过渡动画完成）
    ImpossibleBacktrackModal._scheduleDestroy();
  },

  /**
   * 主动销毁弹窗 DOM（v2.4.0 新增）
   * 立即清理，无延迟。用于页面卸载/手动清理场景。
   */
  destroy: function() {
    if (ImpossibleBacktrackModal._destroyTimer) {
      clearTimeout(ImpossibleBacktrackModal._destroyTimer);
      ImpossibleBacktrackModal._destroyTimer = null;
    }
    if (ImpossibleBacktrackModal._modal) {
      if (ImpossibleBacktrackModal._modal.parentNode) {
        ImpossibleBacktrackModal._modal.parentNode.removeChild(ImpossibleBacktrackModal._modal);
      }
      ImpossibleBacktrackModal._modal = null;
    }
    if (ImpossibleBacktrackModal._escHandler) {
      document.removeEventListener('keydown', ImpossibleBacktrackModal._escHandler);
    }
    document.body.style.overflow = '';
  },

  /**
   * 延迟销毁 DOM（私有）
   */
  _scheduleDestroy: function() {
    const self = ImpossibleBacktrackModal;
    if (self._destroyTimer) {
      clearTimeout(self._destroyTimer);
    }
    self._destroyTimer = setTimeout(function() {
      if (self._modal && self._modal.style.opacity === '0') {
        // 仍处于隐藏状态，执行销毁
        if (self._modal.parentNode) {
          self._modal.parentNode.removeChild(self._modal);
        }
        self._modal = null;
      }
      self._destroyTimer = null;
    }, 300); // 与 CSS 过渡时间匹配
  },

  /**
   * 渲染表格 HTML
   * @private
   */
  _renderTable: function(rows) {
    let html = '<table class="impossible-bm-table">';
    html += '<thead><tr>' +
      '<th>期数</th>' +
      '<th>杀一肖</th>' +
      '<th>杀半波</th>' +
      '<th>禁一头</th>' +
      '<th>杀一尾</th>' +
      '<th>开奖结果</th>' +
      '<th>状态</th>' +
    '</tr></thead>';
    html += '<tbody>';

    rows.forEach(function(r) {
      const rowCls = r.allHit ? 'impossible-bm-tr-ok' : 'impossible-bm-tr-err';
      const zCls = r.zodiacHit ? '' : 'impossible-bm-err-cell';
      const halfCls = r.halfHit ? '' : 'impossible-bm-err-cell';
      const headCls = r.headHit ? '' : 'impossible-bm-err-cell';
      const tailCls = r.tailHit ? '' : 'impossible-bm-err-cell';

      const status = r.allHit
        ? '<span class="impossible-bm-status impossible-bm-status-ok">准</span>'
        : '<span class="impossible-bm-status impossible-bm-status-err">错</span>';

      html += '<tr class="' + rowCls + '">' +
        '<th>' + r.expect + '</th>' +
        '<td class="' + zCls + '">' + r.zodiac + '</td>' +
        '<td class="' + halfCls + '">' + r.half + '</td>' +
        '<td class="' + headCls + '">' + r.head + '</td>' +
        '<td class="' + tailCls + '">' + r.tail + '</td>' +
        '<td>' + r.actualZodiac + Utils.formatNum(r.actualTe) + '</td>' +
        '<td>' + status + '</td>' +
      '</tr>';
    });

    html += '</tbody></table>';
    return html;
  }
};