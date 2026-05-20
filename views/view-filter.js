/**
 * 视图层：筛选页面导航与UI
 * @namespace ViewFilter
 * 职责：只做 DOM 操作，不包含业务计算
 * 依赖方向：被 business/ 调用（business → views，上层→下层）
 */
const ViewFilter = {
  /**
   * 切换底部导航UI（纯DOM，不包含业务逻辑）
   * @param {number} index - 导航索引 (0=筛选,1=机选,2=分析,3=我的)
   */
  switchBottomNavUI: (index) => {
    document.querySelectorAll('.bottom-nav-item').forEach(function(el, i) {
      el.classList.toggle('active', i === index);
    });

    var pages = ['filterPage', 'analysisPage', 'randomPage', 'profilePage'];
    pages.forEach(function(pageId, i) {
      var pageEl = document.getElementById(pageId);
      if(pageEl) {
        pageEl.style.display = i === index ? 'block' : 'none';
        pageEl.classList.toggle('active', i === index);
      }
    });

    var topBox = document.getElementById('topBox');
    if(topBox) {
      topBox.style.display = index === 0 ? 'block' : 'none';
    }

    var bodyBox = document.querySelector('.body-box');
    if(bodyBox) {
      if(index === 0) {
        bodyBox.style.marginTop = 'calc(var(--top-offset) + var(--safe-top))';
      } else {
        bodyBox.style.marginTop = 'calc(12px + var(--safe-top))';
      }
    }

    var quickNav = document.getElementById('quickNav');
    if(quickNav) {
      quickNav.style.display = index === 0 ? 'block' : 'none';
    }
  },

  /**
   * 滚动到指定模块
   * @param {string} targetId - 模块ID
   */
  scrollToModule: (targetId) => {
    var targetEl = document.getElementById(targetId);
    if(targetEl){
      var offset = CONFIG.TOP_OFFSET + Utils.getSafeTop();
      window.scrollTo({top: targetEl.offsetTop - offset, behavior: 'smooth'});
    }
  },

  /**
   * 切换快捷导航展开/收起UI
   * @param {boolean} shouldOpen - 是否展开
   */
  toggleQuickNavUI: (shouldOpen) => {
    if(shouldOpen){
      DOM.quickNav.classList.remove('collapsed');
      DOM.quickNav.classList.add('expanded');
      DOM.navTabs.style.display = 'flex';
      DOM.navToggle.classList.add('active');
    } else {
      DOM.quickNav.classList.remove('expanded');
      DOM.quickNav.classList.add('collapsed');
      DOM.navTabs.style.display = 'none';
      DOM.navToggle.classList.remove('active');
    }
  },

  /**
   * 判断快捷导航是否展开
   * @returns {boolean}
   */
  isQuickNavExpanded: () => {
    return DOM.quickNav.classList.contains('expanded');
  },

  /**
   * 返回顶部
   */
  backToTop: () => {
    window.scrollTo({top: 0, behavior: 'smooth'});
  },

  /**
   * 显示/隐藏返回顶部按钮
   * @param {boolean} show
   */
  toggleBackTopBtn: (show) => {
    if(show) {
      DOM.backTopBtn.classList.add('show');
    } else {
      DOM.backTopBtn.classList.remove('show');
    }
  },

  /**
   * 获取滚动位置
   * @returns {number}
   */
  getScrollTop: () => {
    return document.documentElement.scrollTop || document.body.scrollTop;
  },

  /**
   * 页面卸载清理DOM事件
   */
  cleanupPageEvents: (scrollHandler, unloadHandler) => {
    window.removeEventListener('scroll', scrollHandler);
    window.removeEventListener('beforeunload', unloadHandler);
  },

  /**
   * 批量选择弹窗相关状态
   */
  _batchTargetGroups: [],

  /**
   * 显示批量选择弹窗
   * @param {string} groups - 逗号分隔的组名
   */
  showBatchModal: (groups) => {
    const modal = document.getElementById('batchModal');
    const input = document.getElementById('batchModalInput');
    const title = document.getElementById('batchModalTitle');
    const hint = modal?.querySelector('.batch-modal-hint');
    if (!modal || !input) return;
    ViewFilter._batchTargetGroups = groups ? groups.split(',') : [];
    // 排除组特殊提示
    if (ViewFilter._batchTargetGroups[0] === 'exclude') {
      if (title) title.textContent = '批量排除号码';
      if (hint) hint.textContent = '输入要排除的号码，支持多种分隔符';
      input.placeholder = '例如：1 2 3 10 25';
    } else {
      if (title) title.textContent = '批量选择';
      if (hint) hint.textContent = '输入要选择的名称，支持多种分隔符';
      input.placeholder = '例如：马 牛 虎';
    }
    modal.classList.add('show');
    input.value = '';
    setTimeout(() => input.focus(), 300);
  },

  /**
   * 关闭批量选择弹窗
   */
  closeBatchModal: () => {
    const modal = document.getElementById('batchModal');
    if (!modal) return;
    modal.classList.remove('show');
  },

  /**
   * 确认批量选择
   */
  confirmBatchSelect: () => {
    const input = document.getElementById('batchModalInput');
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) {
      Toast.show('请输入要选择的名称');
      return;
    }
    // 号码排除组特殊处理
    const groups = ViewFilter._batchTargetGroups;
    if (groups.length === 1 && groups[0] === 'exclude') {
      // 提取号码，支持多种分隔符：逗号、空格、换行、点号、斜杠、连字符
      const nums = raw.split(/[,，\s\n.。\/／\\-]+/).map(Number).filter(n => n >= 1 && n <= 49);
      if (nums.length === 0) {
        Toast.show('请输入有效的号码(1-49)');
        return;
      }
      const state = StateManager._state;
      if (state.lockExclude) {
        ViewFilter.closeBatchModal();
        Toast.show('已锁定排除号码');
        return;
      }
      const newExcluded = [...state.excluded];
      const newHistory = [...state.excludeHistory];
      let count = 0;
      nums.forEach(num => {
        if (!newExcluded.includes(num)) { newExcluded.push(num); newHistory.push([num, 'in']); count++; }
      });
      StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
      ViewFilter.closeBatchModal();
      Toast.show(`已排除 ${count} 个号码`);
      return;
    }
    // 普通标签组处理
    const names = raw.split(/[,，\s\n.。\/／\\-]+/).filter(Boolean);
    if (names.length === 0) {
      Toast.show('未识别到有效名称');
      return;
    }
    // 对每个目标组执行批量选择
    ViewFilter._batchTargetGroups.forEach(group => {
      const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
      const lockedSet = new Set(StateManager._state.locked[group] || []);
      const isNumGroup = CONFIG.NUMBER_GROUPS.includes(group);
      const matched = allTags
        .map(tag => Utils.formatTagValue(tag.dataset.value, group))
        .filter(v => {
          if (lockedSet.has(v)) return false;
          if (isNumGroup) {
            const numVal = Number(v);
            return names.some(n => {
              const targetNum = Number(n);
              return !isNaN(targetNum) && targetNum === numVal;
            });
          }
          return names.some(n => v.includes(n) || n.includes(v));
        });
      const newSelected = { ...StateManager._state.selected };
      newSelected[group] = matched;
      StateManager.setState({ selected: newSelected });
    });
    // 关闭弹窗并提示
    ViewFilter.closeBatchModal();
    Toast.show(`已选择 ${names.length} 个名称`);
  }
};