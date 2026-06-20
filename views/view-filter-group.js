/**
 * 视图层：方案分组标签组件
 * @namespace ViewFilterGroup
 * 职责：渲染分组标签栏 + 长按菜单（重命名/删除）
 * 依赖：DOM 节点 #mod-saved .card-body（动态注入 #filterGroupBar）
 *
 * 设计原则：
 * - 只显示标签按钮 + 添加按钮，不显示其他操作入口
 * - 长按 500ms 弹出操作菜单（重命名/删除）
 * - 当前激活分组高亮显示
 * - 遵循"只能新增、不能破坏"：通过 JS 动态注入 DOM，不修改 index.html
 */
const ViewFilterGroup = {
  /** 容器 ID（动态注入 #mod-saved .card-body 末尾） */
  CONTAINER_ID: 'filterGroupBar',
  /** 长按阈值（毫秒） */
  LONG_PRESS_MS: 500,
  /** 当前菜单的 doc click 监听器引用（用于清理，避免长按多个标签时累积泄漏） */
  _currentMenuDocClickHandler: null,

  /**
   * 注入分组标签容器到"我的筛选方案"卡片末尾（幂等）
   */
  ensureContainer: () => {
    if (document.getElementById(ViewFilterGroup.CONTAINER_ID)) return;
    const card = document.getElementById('mod-saved');
    if (!card) return;
    const body = card.querySelector('.card-body');
    if (!body) return;
    const filterList = document.getElementById('filterList');
    const wrapper = document.createElement('div');
    wrapper.id = ViewFilterGroup.CONTAINER_ID;
    wrapper.className = 'filter-group-bar';
    wrapper.setAttribute('role', 'group');
    wrapper.setAttribute('aria-label', '方案分组');
    if (filterList && filterList.parentNode === body) {
      body.insertBefore(wrapper, filterList.nextSibling);
    } else {
      body.appendChild(wrapper);
    }
  },

  /**
   * 创建单个分组标签按钮 DOM
   */
  _createTabBtn: (g, currentId) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    const isActive = g.id === currentId;
    btn.className = 'filter-group-tab' + (isActive ? ' active' : '');
    btn.setAttribute('data-action', 'switchFilterGroup');
    btn.setAttribute('data-group-id', g.id);
    btn.setAttribute('aria-pressed', isActive ? 'true' : 'false');
    btn.setAttribute('aria-label', g.name + (isActive ? '（当前）' : ''));
    btn.textContent = g.name;
    return btn;
  },

  /**
   * 创建"添加"按钮 DOM
   */
  _createAddBtn: () => {
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'filter-group-add';
    addBtn.setAttribute('data-action', 'addFilterGroup');
    addBtn.setAttribute('aria-label', '新建分组');
    addBtn.innerHTML = '<i class="fa-solid fa-plus"></i>';
    return addBtn;
  },

  /**
   * 构建分组栏 DOM 片段
   */
  _buildFragment: (groups, currentId) => {
    const fragment = document.createDocumentFragment();
    groups.forEach((g) => {
      if (!g || !g.id) return;
      fragment.appendChild(ViewFilterGroup._createTabBtn(g, currentId));
    });
    fragment.appendChild(ViewFilterGroup._createAddBtn());
    return fragment;
  },

  /**
   * 渲染分组标签栏
   * - 分组列表为空时：只显示"添加"按钮（提供操作入口）
   * - 分组列表非空时：显示所有分组标签 + 添加按钮
   */
  render: () => {
    try {
      ViewFilterGroup.ensureContainer();
      const wrapper = document.getElementById(ViewFilterGroup.CONTAINER_ID);
      if (!wrapper) return;

      const state = StateManager._state;
      const groups = Array.isArray(state.filterGroups) ? state.filterGroups : [];
      const currentId = state.currentGroupId;

      wrapper.style.display = '';
      wrapper.innerHTML = '';
      wrapper.appendChild(ViewFilterGroup._buildFragment(groups, currentId));
      ViewFilterGroup._bindLongPress(wrapper);
    } catch (e) {
      console.error('[ViewFilterGroup.render] 渲染分组标签失败:', e);
    }
  },

  /**
   * 判断节点是否仍在 DOM 中（用于长按 timer 回调兜底）
   * @param {HTMLElement} el
   * @returns {boolean}
   */
  _isInDOM: (el) => !!el && el.isConnected && document.body.contains(el),

  /**
   * 长按 timer 到达阈值后的回调（tab 已被移除则不弹菜单）
   */
  _onLongPress: (tab, state) => {
    state.timer = null;
    if (!ViewFilterGroup._isInDOM(tab)) return;
    state.triggered = true;
    const groupId = tab.getAttribute('data-group-id');
    ViewFilterGroup._showGroupMenu(groupId, tab);
  },

  /**
   * 绑定单个标签的长按事件
   */
  _bindTabLongPress: (tab) => {
    const state = { timer: null, triggered: false };
    const cancel = () => {
      if (state.timer) { clearTimeout(state.timer); state.timer = null; }
    };
    const start = () => {
      state.triggered = false;
      cancel();
      state.timer = setTimeout(() => ViewFilterGroup._onLongPress(tab, state), ViewFilterGroup.LONG_PRESS_MS);
    };
    tab.addEventListener('touchstart', start, { passive: true });
    tab.addEventListener('touchend', cancel);
    tab.addEventListener('touchmove', cancel);
    tab.addEventListener('touchcancel', cancel);
    tab.addEventListener('mousedown', start);
    tab.addEventListener('mouseup', cancel);
    tab.addEventListener('mouseleave', cancel);
    ViewFilterGroup._bindSuppressClickAfterLongPress(tab, () => state.triggered);
  },

  /**
   * 长按触发后阻止冒泡点击（避免长按后误触发点击切换）
   */
  _bindSuppressClickAfterLongPress: (tab, isTriggered) => {
    tab.addEventListener('click', (e) => {
      if (isTriggered()) {
        e.preventDefault();
        e.stopPropagation();
      }
    }, true);
  },

  /**
   * 绑定容器内所有标签的长按事件
   */
  _bindLongPress: (wrapper) => {
    const tabs = wrapper.querySelectorAll('.filter-group-tab');
    tabs.forEach(ViewFilterGroup._bindTabLongPress);
  },

  /**
   * 定位弹出菜单位置（不超出视口：上下方向自适应，水平居中并夹紧）
   */
  _positionMenu: (menu, anchor) => {
    const rect = anchor.getBoundingClientRect();
    const menuRect = menu.getBoundingClientRect();
    const margin = 8;
    const gap = 6;
    // 默认显示在 anchor 下方；空间不够则改在 anchor 上方
    let top = rect.bottom + gap;
    if (top + menuRect.height > window.innerHeight - margin) {
      top = rect.top - menuRect.height - gap;
    }
    if (top < margin) top = margin;
    // 水平居中，超出左右边界则夹紧
    let left = rect.left + rect.width / 2 - menuRect.width / 2;
    if (left < margin) left = margin;
    if (left + menuRect.width > window.innerWidth - margin) {
      left = window.innerWidth - menuRect.width - margin;
    }
    menu.style.top = top + 'px';
    menu.style.left = left + 'px';
  },

  /**
   * 构建弹出菜单 DOM
   */
  _buildMenuEl: (groupId, groupName) => {
    const menu = document.createElement('div');
    menu.id = 'filterGroupMenu';
    menu.className = 'filter-group-menu';
    menu.setAttribute('role', 'menu');
    menu.innerHTML = `
      <div class="filter-group-menu-title" role="presentation">${Utils.escapeHtml(groupName)}</div>
      <button type="button" role="menuitem" data-action="renameFilterGroup" data-group-id="${Utils.escapeHtml(groupId)}" class="filter-group-menu-item">
        <i class="fa-solid fa-pen"></i>重命名
      </button>
      <button type="button" role="menuitem" data-action="deleteFilterGroup" data-group-id="${Utils.escapeHtml(groupId)}" class="filter-group-menu-item danger">
        <i class="fa-solid fa-trash"></i>删除
      </button>
    `;
    return menu;
  },

  /**
   * 清理上一份菜单的 doc click 监听器（修复长按多个标签时累积泄漏的漏洞）
   */
  _cleanupPrevMenuListener: () => {
    if (ViewFilterGroup._currentMenuDocClickHandler) {
      document.removeEventListener('click', ViewFilterGroup._currentMenuDocClickHandler, true);
      ViewFilterGroup._currentMenuDocClickHandler = null;
    }
    const old = document.getElementById('filterGroupMenu');
    if (old) old.remove();
  },

  /**
   * 显示分组操作菜单（重命名 / 删除）
   */
  _showGroupMenu: (groupId, anchor) => {
    if (!groupId || !anchor) return;
    const list = StateManager._state.filterGroups || [];
    const target = list.find(g => g && g.id === groupId);
    if (!target) return;

    ViewFilterGroup._cleanupPrevMenuListener();

    const menu = ViewFilterGroup._buildMenuEl(groupId, target.name);
    document.body.appendChild(menu);
    ViewFilterGroup._positionMenu(menu, anchor);

    // 点击空白关闭（长按后用户抬手会产生 click，需忽略触发的 anchor 自身）
    setTimeout(() => {
      const onDocClick = (ev) => {
        if (menu.contains(ev.target) || anchor.contains(ev.target)) return;
        menu.remove();
        document.removeEventListener('click', onDocClick, true);
        if (ViewFilterGroup._currentMenuDocClickHandler === onDocClick) {
          ViewFilterGroup._currentMenuDocClickHandler = null;
        }
      };
      ViewFilterGroup._currentMenuDocClickHandler = onDocClick;
      document.addEventListener('click', onDocClick, true);
    }, 0);
  },

  /**
   * 同步排除锁定复选框 UI（业务层委托）
   * @param {boolean} checked
   */
  syncLockExcludeUI: (checked) => {
    if (typeof DOM !== 'undefined' && DOM.lockExclude) {
      DOM.lockExclude.checked = !!checked;
    }
  }
};