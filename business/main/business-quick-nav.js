/**
 * 业务层：快捷导航栏 + 底部导航栏统一管理（2026-06-13 拆分自 business-main.js）
 * @namespace BusinessQuickNav
 *
 * 职责：
 *   1) 快捷导航栏的展开/收起/防反弹（通用 API）
 *   2) 底部导航栏点击的页面切换 + 快捷导航联动（统一入口）
 *   3) 底部导航 → 子 tab 记忆恢复（4 个 tab 的配置中心）
 *
 * 设计原则（只新增不破坏）：
 *   - 拆分自原 business-main.js 的 switchBottomNav / toggleQuickNav / isQuickNavExpanded
 *   - 外部调用方（business-main.js / event.js）原有调用方式完全保留
 *   - 防反弹机制内建在 toggleLater()，调用方无需关心 setTimeout 队列
 *   - 与 Utils.delayedToggle 配合，提供通用化、可复用的"防反弹延迟切换"能力
 *
 * 加载顺序（见 index.html）：
 *   core/utils.js → business/business-quick-nav.js → business/business-main.js
 */
const BusinessQuickNav = {
  // ============================================================
  // 内部状态
  // ============================================================

  /**
   * 当前底部导航索引（用于判断"重复点击"）
   * 初始为 0（主页）：页面刷新后首次点击主页按钮即可触发快捷导航栏
   * 其他页面（资料/广播/我的）首次点击时不触发，需停留后再次点击才触发
   */
  _currentBottomNavIndex: 0,

  /**
   * 防反弹：待执行的 toggle 任务句柄（由 Utils.delayedToggle 返回）
   * 任何 toggle() 都会先清掉这个 pending，避免 setTimeout 反弹
   */
  _pendingToggle: null,

  /**
   * 底部导航 → 页面的子 tab 记忆配置
   * index:    底部导航索引（0=主页 / 1=广播 / 2=资料 / 3=我的）
   * page:     TAB_MEMORY 配置名（profile / analysis / random；主页无子 tab，传 null）
   * restore:  恢复函数（接收 tab 参数；主页无需恢复，传空函数）
   * toggleQuickNav:
   *           是否支持重复点击切换快捷导航展开/收起
   *           默认 true；"我的"页面（profile）设为 false
   */
  _TAB_MEMORY: [
    { index: 0, page: null,       toggleQuickNav: true,  restore: function() {} },
    { index: 1, page: 'analysis', toggleQuickNav: true,  restore: function(tab) { Business.switchAnalysisTab(tab); } },
    { index: 2, page: 'random',   toggleQuickNav: true,  restore: function(tab) { Business.switchZodiacTab(tab); } },
    { index: 3, page: 'profile',  toggleQuickNav: false, restore: function(tab) {
        if (typeof ViewProfile !== 'undefined' && ViewProfile.switchProfileTabUI) {
          ViewProfile.switchProfileTabUI(tab);
        }
      } }
  ],

  // ============================================================
  // 快捷导航栏：通用 API
  // ============================================================

  /**
   * 判断快捷导航栏是否处于展开状态
   * @returns {boolean}
   */
  isExpanded: () => {
    return ViewFilter.isQuickNavExpanded();
  },

  /**
   * 切换快捷导航栏展开/收起（同步；防反弹：自动清掉待执行任务）
   * @param {boolean|null} isOpen - true 展开，false 收起，null 反转
   *
   * 任何调用入口（navToggle 点击 / nav-tab 跳转 / 切换页面收起 / 延迟任务到期）都会走这里
   * 入口先清掉待执行的 setTimeout，避免"反弹"竞态
   */
  toggle: (isOpen = null) => {
    BusinessQuickNav._clearPending();
    const shouldOpen = isOpen === null ? !BusinessQuickNav.isExpanded() : isOpen;
    ViewFilter.toggleQuickNavUI(shouldOpen);
  },

  /**
   * 延迟切换（用于避开 handleClickOutside 立即收起）
   * 适用场景：底部导航栏重复点击时，setTimeout 50ms 后才执行 toggle
   *           让 handleClickOutside 先走完（被 .bottom-nav-item 守卫拦下）
   * @param {number} [delay=50] - 延迟毫秒数
   *
   * 防反弹机制：
   *   - 连点同一底部导航：trigger() 自动 clearTimeout 上一次，最终只保留最后一次
   *   - 50ms 内点 nav-tab 关闭：toggle() 内部 _clearPending 取消本次
   *   - 50ms 内切换其他页面：toggle(false) 内部 _clearPending 取消本次
   */
  toggleLater: (delay = 50) => {
    BusinessQuickNav._clearPending();
    BusinessQuickNav._pendingToggle = Utils.delayedToggle(() => {
      BusinessQuickNav._pendingToggle = null;
      BusinessQuickNav.toggle();
    }, delay);
    BusinessQuickNav._pendingToggle.trigger();
  },

  /**
   * 清掉待执行的 toggle 任务（防反弹）
   * @private
   */
  _clearPending: () => {
    if (BusinessQuickNav._pendingToggle) {
      BusinessQuickNav._pendingToggle.cancel();
      BusinessQuickNav._pendingToggle = null;
    }
  },

  // ============================================================
  // 底部导航栏：统一入口
  // ============================================================

  /**
   * 处理底部导航栏点击（统一入口，整合"导航"按钮 + 4 个 tab 切换）
   * @param {number} index - 底部导航索引（0=主页 / 1=广播 / 2=资料 / 3=我的）
   *
   * 执行流程：
   *   1) 切换页面 UI（显示对应 page 区域，隐藏其他）
   *   2) 初始化对应页面（仅广播需要 initAnalysisPage）
   *   3) 查找 _TAB_MEMORY 中对应的 memItem
   *   4) 快捷导航栏联动：
   *      a) 重复点击当前页面（toggleQuickNav=true 且 index 不变）→ 延迟切换展开/收起
   *      b) 切换到其他页面 + 当前是展开状态 → 主动收起
   *   5) 更新 _currentBottomNavIndex
   *   6) 恢复对应页面的子 tab（通过 Storage.getLastTab）
   *
   * 调用方：event.js handleGlobalClick → CONFIG.ACTIONS.SWITCH_NAV → 委托给 Business
   */
  handleBottomNavClick: (index) => {
    // 1. 切换页面 UI
    ViewFilter.switchBottomNavUI(index);

    // 2. 初始化对应页面（仅广播需要）
    if (index === 1) {
      Business.initAnalysisPage();
    }

    // 3. 查找 memItem
    var memItem = null;
    for (var i = 0; i < BusinessQuickNav._TAB_MEMORY.length; i++) {
      if (BusinessQuickNav._TAB_MEMORY[i].index === index) {
        memItem = BusinessQuickNav._TAB_MEMORY[i];
        break;
      }
    }

    // 4. 快捷导航栏联动
    var isRepeatClick = memItem
                      && memItem.toggleQuickNav
                      && BusinessQuickNav._currentBottomNavIndex === index;
    if (isRepeatClick) {
      // 重复点击当前页面：延迟切换展开/收起（避开 handleClickOutside 立即收起）
      BusinessQuickNav.toggleLater(50);
    } else if (BusinessQuickNav._currentBottomNavIndex !== index
               && BusinessQuickNav.isExpanded()) {
      // 切换到其他页面：主动收起（同步执行，无需延迟）
      BusinessQuickNav.toggle(false);
    }

    // 5. 更新当前底部导航索引
    BusinessQuickNav._currentBottomNavIndex = index;

    // 6. 恢复对应页面的子 tab
    if (memItem && typeof Storage !== 'undefined' && Storage.getLastTab) {
      var lastTab = Storage.getLastTab(memItem.page);
      if (lastTab) memItem.restore(lastTab);
    }
  }
};
