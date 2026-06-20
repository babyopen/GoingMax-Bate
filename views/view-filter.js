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
   * v2.0.9 修复：html/body 都被设为 overflow:hidden，真正的滚动容器是 .page-scroll
   * 改用 .page-scroll.scrollTo 而不是 window.scrollTo（window 不能滚动）
   */
  backToTop: () => {
    var scrollContainer = document.querySelector('.page-scroll');
    if (scrollContainer) {
      scrollContainer.scrollTo({top: 0, behavior: 'smooth'});
    }
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
   * v2.0.9 修复：html/body 都是 overflow:hidden，scrollTop 永远为 0
   * 改读 .page-scroll 的 scrollTop
   * @returns {number}
   */
  getScrollTop: () => {
    var scrollContainer = document.querySelector('.page-scroll');
    return scrollContainer ? scrollContainer.scrollTop : 0;
  },

  /**
   * 页面卸载清理DOM事件
   * v2.0.9 修复：scroll 监听已迁移到 .page-scroll，清理时也要从 .page-scroll 上解绑
   */
  cleanupPageEvents: (scrollHandler, unloadHandler) => {
    var scrollContainer = document.querySelector('.page-scroll');
    if (scrollContainer) {
      scrollContainer.removeEventListener('scroll', scrollHandler);
    }
    window.removeEventListener('beforeunload', unloadHandler);
  },

  /**
   * 动态注入"复制已选生肖"按钮到主页生肖卡片(#mod-zodiac) 头部按钮组
   * 说明：仅在主页生肖卡片内注入，不影响 index.html 已有的 DOM 结构
   * 幂等：多次调用只注入一次
   * 位置：插入到"清除"按钮(btn-icon-red)之前，与"清除"按钮互换相对位置
   */
  injectZodiacCopyBtn: () => {
    const card = document.getElementById('mod-zodiac');
    if(!card) return;
    const btnGroup = card.querySelector('.card-header .btn-group[aria-label="生肖操作"]');
    if(!btnGroup) return;
    if(btnGroup.querySelector('[data-action="copySelectedZodiacs"]')) return;

    const btn = document.createElement('button');
    btn.className = 'btn-mini btn-icon';
    btn.setAttribute('data-action', 'copySelectedZodiacs');
    btn.setAttribute('data-group', 'zodiac');
    btn.setAttribute('type', 'button');
    btn.setAttribute('title', '复制已选生肖');
    btn.setAttribute('aria-label', '复制已选生肖');
    btn.innerHTML = '<i class="fa-solid fa-copy"></i>';

    // 插入到"反选"按钮之前(与"反选"按钮互换位置)
    // 兼容：找不到 invertGroup 时回退到"清除"按钮之前
    const invertBtn = btnGroup.querySelector('[data-action="invertGroup"]');
    const clearBtn = btnGroup.querySelector('[data-action="clearGroup"]');
    if(invertBtn){
      btnGroup.insertBefore(btn, invertBtn);
    } else if(clearBtn){
      btnGroup.insertBefore(btn, clearBtn);
    } else {
      btnGroup.appendChild(btn);
    }
  }
};
