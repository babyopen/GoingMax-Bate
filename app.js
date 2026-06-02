async function initApp() {
  try {
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
    // 6. 渲染排除号码网格
    Render.renderExcludeGrid();
    // 7. 加载本地存储的方案
    Storage.loadSavedFilters();
    // 8. 加载历史记录缓存
    Business.loadHistoryCache();
    // 9. 渲染方案列表
    Render.renderFilterList();
    // 10. 初始化快捷导航（主页默认 filter 页签）
    ViewFilter.refreshQuickNav('filter');
    // 11. 初始化事件绑定
    EventBinder.init();
    // 12. 启动分析页面倒计时和自动刷新检查
    Business.startCountdown();
    Business.checkDrawTimeLoop();
    // 13. 后台静默更新历史数据
    Business.refreshHistory(true);
    // 14. 隐藏加载遮罩
    Render.hideLoading();
    
    console.log(`GiongBeta v${CONFIG.VERSION} 初始化完成，当前农历生肖：${StateManager._state.currentZodiac}`);
  } catch(e) {
    console.error('应用初始化失败', e);
    Toast.show('页面初始化失败，请刷新重试');
    Render.hideLoading();
  }
}

// 页面加载完成后启动应用
window.addEventListener('DOMContentLoaded', initApp);
