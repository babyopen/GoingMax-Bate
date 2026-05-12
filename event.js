const EventBinder = {
  /**
   * 初始化所有事件绑定
   */
  init: () => {
    // 全局点击事件委托
    document.addEventListener('click', EventBinder.handleGlobalClick);
    // 键盘回车/空格事件（无障碍支持）
    document.addEventListener('keydown', EventBinder.handleKeyDown);
    // 滚动事件（已节流）
    window.addEventListener('scroll', Business.handleScroll);
    // 点击空白关闭快捷导航
    document.addEventListener('click', EventBinder.handleClickOutside);
    // 页面卸载清理
    window.addEventListener('beforeunload', Business.handlePageUnload);
    // 全局错误捕获
    window.addEventListener('error', EventBinder.handleGlobalError);
    
    // 分析页面：全维度分析选择器change事件
    const analyzeSelect = document.getElementById('analyzeSelect');
    if(analyzeSelect) {
      analyzeSelect.addEventListener('change', function() {
        Business.syncAnalyze();
      });
      analyzeSelect.addEventListener('input', function() {
        Business.syncAnalyze();
      });
    }
    
    // 分析页面：自定义期数输入事件（防抖优化）
    const customNum = document.getElementById('customNum');
    if(customNum) {
      const debouncedSync = Utils.debounce(() => Business.syncAnalyze(), 300);
      customNum.addEventListener('input', function() {
        debouncedSync();
      });
    }
    
    // 分析页面：特码生肖关联选择器change事件
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    if(zodiacAnalyzeSelect) {
      zodiacAnalyzeSelect.addEventListener('change', function() {
        Business.syncZodiacAnalyze();
      });
    }
    
    // 分析页面：号码数量选择器change事件
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    
    if(numCountSelect) {
      numCountSelect.addEventListener('change', function() {
        Business.syncZodiacAnalyze();
      });
    }
    
    if(customNumCount) {
      customNumCount.addEventListener('input', function() {
        const val = this.value.trim();
        if(val && !isNaN(val) && Number(val) >= 1 && Number(val) <= 49) {
          const newAnalysis = { 
            ...StateManager._state.analysis, 
            selectedNumCount: Number(val)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          Business.renderZodiacAnalysis();
        }
      });
    }
  },

  /**
   * 全局点击处理
   * @param {MouseEvent} e - 点击事件
   */
  handleGlobalClick: (e) => {
    const target = e.target;

    // 1. 筛选标签点击
    const tag = target.closest('.tag[data-group]');
    if(tag){
      const group = tag.dataset.group;
      const value = Utils.formatTagValue(tag.dataset.value, group);
      StateManager.updateSelected(group, value);
      return;
    }

    // 2. 排除号码点击
    const excludeTag = target.closest('.exclude-tag[data-num]');
    if(excludeTag){
      Business.toggleExclude(Number(excludeTag.dataset.num));
      return;
    }

    // 3. 快捷导航跳转
    const navTab = target.closest('.nav-tab[data-target]');
    if(navTab){
      const targetId = navTab.dataset.target;
      Business.scrollToModule(targetId);
      return;
    }

    // 4. 快捷导航开关
    if(target === DOM.navToggle){
      Business.toggleQuickNav();
      return;
    }

    // 5. 返回顶部
    if(target === DOM.backTopBtn){
      Business.backToTop();
      return;
    }

    // 6. 按钮动作处理（用枚举避免硬编码错误）
    const actionBtn = target.closest('[data-action]');
    if(actionBtn){
      const action = actionBtn.dataset.action;
      const group = actionBtn.dataset.group;
      const groups = group ? group.split(',') : [];
      const index = actionBtn.dataset.index;
      
      // 分组操作
      if(action === CONFIG.ACTIONS.RESET_GROUP) groups.forEach(g => StateManager.resetGroup(g));
      if(action === CONFIG.ACTIONS.SELECT_GROUP) groups.forEach(g => StateManager.selectGroup(g));
      if(action === CONFIG.ACTIONS.INVERT_GROUP) groups.forEach(g => StateManager.invertGroup(g));
      if(action === CONFIG.ACTIONS.CLEAR_GROUP) groups.forEach(g => StateManager.clearGroup(g));
      if(action === CONFIG.ACTIONS.MARK_GROUP) groups.forEach(g => StateManager.markGroup(g));
      if(action === CONFIG.ACTIONS.LOCK_GROUP) groups.forEach(g => StateManager.lockGroup(g));
      // 全局操作
      if(action === CONFIG.ACTIONS.SELECT_ALL) Filter.selectAllFilters();
      if(action === CONFIG.ACTIONS.CLEAR_ALL) Filter.clearAllFilters();
      if(action === CONFIG.ACTIONS.SAVE_FILTER) Business.saveFilterPrompt();
      if(action === CONFIG.ACTIONS.CLEAR_ALL_SAVED) Business.clearAllSavedFilters();
      // 排除号码操作
      if(action === CONFIG.ACTIONS.INVERT_EXCLUDE) Business.invertExclude();
      if(action === CONFIG.ACTIONS.UNDO_EXCLUDE) Business.undoExclude();
      if(action === CONFIG.ACTIONS.BATCH_EXCLUDE) Business.batchExcludePrompt();
      if(action === CONFIG.ACTIONS.CLEAR_EXCLUDE) Business.clearExclude();
      // 方案操作
      if(action === CONFIG.ACTIONS.TOGGLE_SHOW_ALL) Business.toggleShowAllFilters();
      if(action === CONFIG.ACTIONS.LOAD_FILTER) Business.loadFilter(Number(index));
      if(action === CONFIG.ACTIONS.RENAME_FILTER) Business.renameFilter(Number(index));
      if(action === CONFIG.ACTIONS.COPY_FILTER) Business.copyFilterNums(Number(index));
      if(action === CONFIG.ACTIONS.TOP_FILTER) Business.topFilter(Number(index));
      if(action === CONFIG.ACTIONS.DELETE_FILTER) Business.deleteFilter(Number(index));
      // 导航操作
      if(action === CONFIG.ACTIONS.SWITCH_NAV) Business.switchBottomNav(Number(actionBtn.dataset.index));
      // 分析页面操作
      if(action === 'refreshHistory') Business.refreshHistory();
      if(action === 'syncAnalyze') Business.syncAnalyze();
      if(action === 'syncZodiacAnalyze') Business.syncZodiacAnalyze();
      if(action === 'toggleDetail') Business.toggleDetail(actionBtn.dataset.target);
      if(action === 'loadMoreHistory') Business.loadMoreHistory();
      if(action === 'toggleExcludeLock') Business.toggleExcludeLock();
      return;
    }

    // 7. 分析标签页切换
    const analysisTabBtn = target.closest('.analysis-tab-btn[data-analysis-tab]');
    if(analysisTabBtn){
      Business.switchAnalysisTab(analysisTabBtn.dataset.analysisTab);
      return;
    }

    // 8. 加载更多历史
    const loadMoreBtn = target.closest('#loadMore');
    if(loadMoreBtn){
      Business.loadMoreHistory();
      return;
    }
  },

  /**
   * 键盘事件处理（无障碍支持，回车/空格触发可交互元素）
   * @param {KeyboardEvent} e - 键盘事件
   */
  handleKeyDown: (e) => {
    // 仅处理回车和空格
    if(e.key !== 'Enter' && e.key !== ' ') return;
    
    const target = e.target;
    // 可交互元素
    const isInteractive = target.matches('.tag, .exclude-tag, .btn-mini, .btn-line, .nav-tab, .nav-toggle-btn, .back-top-btn, .filter-expand, .filter-item-btns button, .bottom-nav-item');
    
    if(isInteractive){
      e.preventDefault();
      target.click();
    }
  },

  /**
   * 点击空白关闭快捷导航
   * @param {MouseEvent} e - 点击事件
   */
  handleClickOutside: (e) => {
    if(!DOM.quickNav.contains(e.target) && DOM.quickNav.classList.contains('expanded')){
      Business.toggleQuickNav(false);
    }
  },

  /**
   * 全局错误捕获
   * @param {ErrorEvent} e - 错误事件
   */
  handleGlobalError: (e) => {
    console.error('全局错误', e.error);
    Toast.show('页面出现异常，请刷新重试');
  }
};
