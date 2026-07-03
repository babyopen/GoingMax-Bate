async function initApp() {
  try {
    // 0. 初始化性能监控（v2.0.9 新增）
    if (typeof PerformanceMonitor !== 'undefined') {
      PerformanceMonitor.init();
      console.log('[App] 性能监控已初始化');
    }
    
    // 0.5. 注册事件总线监听器（解耦核心层与平台层，v2.0.9 新增）
    // StateManager 状态变更时自动触发渲染，替代 core/state.js 中直接调用 Render.renderAll()
    if (typeof BusinessEventBus !== 'undefined') {
      BusinessEventBus.on('state:change', function() {
        try {
          Render.renderAll();
        } catch(e) {
          console.error('[App] 状态变更渲染失败:', e);
        }
      });
      console.log('[App] 事件总线监听器已注册');
    }
    
    // 1. 生成生肖数据
    Render.buildZodiacCycle();
    // 2. 生成号码基础数据
    Render.buildNumList();
    // 3. 初始化数据查询模块（打通所有数据关联）
    DataQuery.init();
    // 4. 渲染生肖标签
    Render.renderZodiacTags();
    // 5. 渲染号码选择标签
    Render.renderNumTags();
    // 6. 排除号码网格由第 15 步 Render.renderAll() 统一渲染，避免重复创建 49 个 DOM 节点（2026-06-21 性能优化）
    // 7. 加载本地存储的方案
    Storage.loadSavedFilters();
    // 7.1 加载本地存储的方案分组（2026-06-20 新增）
    Business.FilterGroup.loadGroupsFromStorage();
    // 7.2 如果有当前激活分组，将分组的快照覆盖 state（覆盖 savedFilters 等）
    try {
      const s = StateManager._state;
      if (s.currentGroupId) {
        const target = (s.filterGroups || []).find(g => g && g.id === s.currentGroupId);
        if (target) {
          // 委托 FilterGroup.applyGroupSnapshot 应用快照（含 DOM 同步）
          Business.FilterGroup.applyGroupSnapshot(target);
        }
      }
    } catch (e) {
      console.warn('分组快照应用失败:', e);
    }
    // 7.3 加载本地存储的用户书签（2026-07-04 新增）
    if (typeof BusinessBookmark !== 'undefined') {
      BusinessBookmark.initBookmarks();
    }
    // 8. 加载历史记录缓存
    Business.loadHistoryCache();
    // 9. 渲染方案列表
    Render.renderFilterList();
    // 9.1 渲染方案分组标签栏（2026-06-20 新增）
    ViewFilterGroup.render();
    // 10. 初始化快捷导航（主页默认 filter 页签）
    ViewFilter.refreshQuickNav('filter');
    // 10.1 注入主页生肖卡片的"复制已选生肖"按钮（仅主页生肖卡片，不影响其它页面）
    ViewFilter.injectZodiacCopyBtn();
    // 11. 初始化事件绑定
    EventBinder.init();
    // 12. 启动分析页面倒计时和自动刷新检查
    Business.startCountdown();
    Business.checkDrawTimeLoop();
    // 13. 后台静默更新历史数据
    Business.refreshHistory(true);
    // 14. 新增：初始化当前主页临时筛选状态持久化（必须在 renderAll 之前完成恢复）
    Business.initFilterPersistence();
    // 14.1 新增：注册方案分组的兜底持久化（iOS WebView 切后台/页面隐藏时立即保存分组数据）
    //   由入口层注册 window/document 事件（业务层不能直接使用 window/document）
    // v2.0.8 重构：同时 flush 分组 + 当前筛选状态（共用一个监听器）
    // v2.0.9 修复：同时注册 storage 事件监听器，跨标签页同步 LRU 缓存
    (function initFilterGroupFlushPersist() {
      const flush = function() {
        try { Business.FilterGroup._persistGroups(); } catch(_) {}
        try { if (Business._flushCurrentFilter) Business._flushCurrentFilter(); } catch(_) {}
      };
      window.addEventListener('pagehide', flush);
      document.addEventListener('visibilitychange', function() {
        if(document.visibilityState === 'hidden') flush();
      });
      // v2.0.9 新增：storage 事件监听器（跨标签页同步）
      // 1) 同步方案分组和筛选状态
      // 2) 同步滑动窗口 LRU 缓存（由业务层提供处理函数）
      window.addEventListener('storage', function(e) {
        try { Business.FilterGroup._persistGroups(); } catch(_) {}
        try { if (Business._flushCurrentFilter) Business._flushCurrentFilter(); } catch(_) {}
        // 调用滑动窗口业务层提供的处理函数同步 LRU 缓存
        try {
          if (typeof BusinessSlidingWindow !== 'undefined' && typeof BusinessSlidingWindow._handleStorageEvent === 'function') {
            BusinessSlidingWindow._handleStorageEvent(e);
          }
        } catch(_) {}
      });
    })();
    // 15. 重新渲染一次以反映从 localStorage 恢复的筛选状态
    Render.renderAll();
    // 16. 隐藏加载遮罩
    Render.hideLoading();

    // 17. 同步顶部版本号显示（2026-06-28 用户需求：迭代版本号）
    //   index.html 中 .top-title 最后一个 span 硬编码了版本号文本（受宪法保护不能改 HTML），
    //   此处用 CONFIG.VERSION 作为单一数据源在启动时动态注入，
    //   后续升级版本只需改 core/config.js 的 VERSION 字段即可，无需再改 HTML
    if(typeof CONFIG !== 'undefined' && CONFIG.VERSION) {
      const versionSpan = document.querySelector('.top-title > span:last-child');
      if(versionSpan) versionSpan.textContent = 'v' + CONFIG.VERSION;
    }

    console.log(`Gemini v${CONFIG.VERSION} 初始化完成，当前农历生肖：${StateManager._state.currentZodiac}`);
  } catch(e) {
    console.error('应用初始化失败', e);
    Toast.show('页面初始化失败，请刷新重试');
    Render.hideLoading();
  }
}

// 页面加载完成后启动应用
window.addEventListener('DOMContentLoaded', initApp);
