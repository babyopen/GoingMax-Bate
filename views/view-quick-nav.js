/**
 * 视图层：快捷导航栏（拆分自 view-filter.js，2026-06-05）
 * @namespace ViewQuickNav
 * 包含：refreshQuickNav + _navConfigs
 * 依赖：DOM 元素 #navTabs
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ViewFilter.refreshQuickNav() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - _navConfigs 从 view-filter.js 搬入此处
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
      { id: 'mod-exclude', label: '号码排除', type: 'scroll' }
    ],
    analysis: [
      { label: '历史记录', type: 'tab', page: 'analysis', tabName: 'history' },
      { label: '维度分析', type: 'tab', page: 'analysis', tabName: 'analysis' },
      { label: '生肖关联', type: 'tab', page: 'analysis', tabName: 'zodiac' }
    ],
    random: [
      { label: '主推', type: 'tab', page: 'random', tabName: 'main' },
      { label: '终极算法', type: 'tab', page: 'random', tabName: 'ultimate' },
      { label: '生肖预测', type: 'tab', page: 'random', tabName: 'predict' },
      { label: 'Giong', type: 'tab', page: 'random', tabName: 'giong' }
    ],
    profile: [
      { label: '我的', type: 'tab', page: 'profile', tabName: 'mine' },
      { label: '官方', type: 'tab', page: 'profile', tabName: 'official' },
      { label: '凤凰', type: 'tab', page: 'profile', tabName: 'phoenix' },
      { label: '大仙', type: 'tab', page: 'profile', tabName: 'daxian' }
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
      }
      btn.textContent = cfg.label;
      fragment.appendChild(btn);
    });
    navTabs.innerHTML = '';
    navTabs.appendChild(fragment);
  }
};

// 兼容路径：挂载到 ViewFilter，使 event.js / view-filter.js 中 ViewFilter.refreshQuickNav() 调用不变
if (typeof ViewFilter !== 'undefined' && ViewFilter) {
  Object.assign(ViewFilter, ViewQuickNav);
}
