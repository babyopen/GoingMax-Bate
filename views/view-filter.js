/**
 * 视图层：筛选页面导航与UI
 * @namespace ViewFilter
 * 职责：只做 DOM 操作，不包含业务计算
 * 依赖方向：被 business/ 调用（business → views，上层→下层）
 *
 * 子模块拆分（2026-06-05 兼容性重构，零行为变更）：
 * - 批量选择弹窗（adjustModalPosition / showBatchModal / closeBatchModal / confirmBatchSelect）
 *   → views/modals/view-batch-modal.js
 * - 快捷导航栏（refreshQuickNav + _navConfigs）
 *   → views/view-quick-nav.js
 * - 重叠号码弹窗（showOverlapModal）
 *   → views/modals/view-overlap-modal.js
 * 子模块加载完毕后通过 Object.assign 自动挂载到 ViewFilter 上，
 * event.js / app.js 中的 ViewFilter.xxx() 调用方式完全不变。
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
      if (index === 0 || index === 1 || index === 2 || index === 3) {
        quickNav.style.display = 'block';
      } else {
        quickNav.style.display = 'none';
      }
    }

    if (index === 0) {
      ViewFilter.refreshQuickNav('filter');
    } else if (index === 1) {
      ViewFilter.refreshQuickNav('analysis');
    } else if (index === 2) {
      ViewFilter.refreshQuickNav('random');
    } else if (index === 3) {
      ViewFilter.refreshQuickNav('profile');
    } else {
      var navTabs = document.getElementById('navTabs');
      if (navTabs) navTabs.innerHTML = '';
    }
  },

  /**
   * 滚动到指定模块
   * @param {string} targetId - 模块ID
   */
  scrollToModule: (targetId) => {
    var targetEl = document.getElementById(targetId);
    if (!targetEl) return;
    var scrollContainer = document.querySelector('.page-scroll');
    if (scrollContainer) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      var offset = CONFIG.TOP_OFFSET + Utils.getSafeTop();
      window.scrollTo({ top: targetEl.offsetTop - offset, behavior: 'smooth' });
    }
    Business.toggleQuickNav(false);
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
  }
};
