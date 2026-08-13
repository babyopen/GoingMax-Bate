/**
 * 视图层：快捷导航栏（拆分自 view-filter.js，2026-06-05）
 * @namespace ViewQuickNav
 * 包含：refreshQuickNav + _navConfigs
 * 依赖：DOM 元素 #navTabs
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ViewFilter.refreshQuickNav() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - _navConfigs 从 view-filter.js 搬入此处
 *
 * 2026-08-14 新增：profile 页书签列表展示 + 添加按钮注入到快捷导航栏
 */
const ViewQuickNav = {
  /**
   * 快捷导航配置
   */
  _navConfigs: {
    filter: [
      { id: 'mod-saved', label: '方案', type: 'scroll' },
      { id: 'mod-zodiac', label: '生肖', type: 'scroll' },
      { id: 'mod-color', label: '波色', type: 'scroll' },
      { id: 'mod-type', label: '属性', type: 'scroll' },
      { id: 'mod-element', label: '五行', type: 'scroll' },
      { id: 'mod-head', label: '头数', type: 'scroll' },
      { id: 'mod-tail', label: '尾数', type: 'scroll' },
      { id: 'mod-sum', label: '尾合', type: 'scroll' },
      { id: 'mod-bs', label: '大小', type: 'scroll' },
      { id: 'mod-num', label: '号码选择', type: 'scroll' },
      { id: 'mod-exclude', label: '号码排除', type: 'scroll' },
      // v2.0.9 新增：独立标签页入口（在主页面快捷导航，type='tab' 切换到独立 page）
      { label: '排除', type: 'tab', page: 'exclude', tabName: '' }
    ],
    analysis: [
      { label: '历史记录', type: 'tab', page: 'analysis', tabName: 'history' },
      { label: '维度分析', type: 'tab', page: 'analysis', tabName: 'analysis' },
      { label: '生肖关联', type: 'tab', page: 'analysis', tabName: 'zodiac' }
    ],
    random: [
      { label: '主推', type: 'tab', page: 'random', tabName: 'main' },
      { label: '算法', type: 'tab', page: 'random', tabName: 'ultimate' },
      { label: 'Gemini', type: 'tab', page: 'random', tabName: 'predict' },
      { label: 'Giong', type: 'tab', page: 'random', tabName: 'giong' },
      { label: 'TongJi', type: 'tab', page: 'random', tabName: 'tongji' }
    ],
    profile: [
      // 2026-08-14 调整：「我的」tab 已移除（用户要求），书签入口直接承担导航作用
      { label: '+书签', type: 'bookmark', id: 'bookmarkAddBtn' }
    ]
  },

  /**
   * 刷新快捷导航栏内容（根据当前页面）
   * @param {string} pageKey - 'filter', 'analysis', 'random', 'profile'
   */
  refreshQuickNav: (pageKey) => {
    const navTabs = document.getElementById('navTabs');
    if (!navTabs) return;
    const configs = ViewFilter._navConfigs[pageKey];
    if (!configs) return;

    // 读取当前激活的子 tab（用于高亮快捷导航按钮）
    // 仅 analysis/random/profile 需要高亮（filter 页面是滚动定位类型不需要）
    var currentActiveTab = null;
    if (pageKey !== 'filter' && typeof Storage !== 'undefined' && Storage.getLastTab) {
      currentActiveTab = Storage.getLastTab(pageKey);
    }

    const fragment = document.createDocumentFragment();
    configs.forEach(cfg => {
      const btn = document.createElement('button');
      btn.className = 'nav-tab';
      if (cfg.type === 'scroll') {
        btn.dataset.target = cfg.id;
        btn.dataset.navType = 'scroll';
      } else if (cfg.type === 'tab') {
        btn.dataset.navType = 'tab';
        btn.dataset.page = cfg.page;
        btn.dataset.tabName = cfg.tabName;
        // 如果是当前激活的 tab，添加 active 类
        if (currentActiveTab && cfg.tabName === currentActiveTab) {
          btn.classList.add('active');
        }
      } else if (cfg.type === 'bookmark') {
        // 2026-08-14 新增：书签添加按钮（不参与激活高亮逻辑）
        btn.dataset.navType = 'bookmark';
        btn.id = cfg.id || 'bookmarkAddBtn';
        // 2026-08-14 调整：按钮内容改为 Font Awesome 图标（fa-bookmark）
        // 长按入口仍由事件层识别 #bookmarkAddBtn，单击弹输入框
        btn.setAttribute('title', '添加书签');
        btn.setAttribute('aria-label', '添加书签');
        // 图标按钮更紧凑：方形小尺寸 + 图标居中
        btn.style.padding = '8px 12px';
        btn.style.minWidth = '40px';
        btn.style.display = 'inline-flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'center';
        btn.style.fontSize = '14px';
      }
      // 内容渲染：bookmark 类型使用图标，其他类型用文本
      if (cfg.type === 'bookmark') {
        // 2026-08-14 调整：图标改为「圆圈内 + 号」（fa-circle-plus）
        btn.innerHTML = '<i class="fa-solid fa-circle-plus"></i>';
      } else {
        btn.textContent = cfg.label;
      }
      fragment.appendChild(btn);
    });
    navTabs.innerHTML = '';
    navTabs.appendChild(fragment);

    // 2026-08-14 新增：profile 页渲染书签标签到快捷导航栏内
    if (pageKey === 'profile' && typeof ViewBookmark !== 'undefined') {
      ViewBookmark.renderBookmarkTagsIntoNav(navTabs);
    }
  }
};

// 兼容路径：挂载到 ViewFilter，使 event.js / view-filter.js 中 ViewFilter.refreshQuickNav() 调用不变
if (typeof ViewFilter !== 'undefined' && ViewFilter) {
  Object.assign(ViewFilter, ViewQuickNav);
}
