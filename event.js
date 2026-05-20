const EventBinder = {
  /**
   * 初始化所有事件绑定
   */
  init: () => {
    // 全局点击事件委托
    document.addEventListener('click', EventBinder.handleGlobalClick);
    // 全局双击事件委托（标签锁定/解锁）
    document.addEventListener('dblclick', EventBinder.handleDoubleClick);
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
          const curState = StateManager.getState();
          const newAnalysis = { 
            ...curState.analysis, 
            selectedNumCount: Number(val)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          Business.renderZodiacAnalysis();
        }
      });
    }
  },

  /**
   * 全局双击处理（标签锁定/解锁）
   * @param {MouseEvent} e - 双击事件
   */
  handleDoubleClick: (e) => {
    const target = e.target;
    const tag = target.closest('.tag[data-group]');

    if (tag) {
      const group = tag.dataset.group;
      const value = Utils.formatTagValue(tag.dataset.value, group);
      StateManager.toggleTagLock(group, value);
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
    if(DOM.navToggle && DOM.navToggle.contains(target)){
      Business.toggleQuickNav();
      return;
    }

    // 5. 返回顶部
    if(DOM.backTopBtn && target === DOM.backTopBtn){
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
      else if(action === CONFIG.ACTIONS.SELECT_GROUP) groups.forEach(g => StateManager.selectGroup(g));
      else if(action === CONFIG.ACTIONS.INVERT_GROUP) groups.forEach(g => StateManager.invertGroup(g));
      else if(action === CONFIG.ACTIONS.CLEAR_GROUP) groups.forEach(g => StateManager.clearGroup(g));
      else if(action === CONFIG.ACTIONS.MARK_GROUP) groups.forEach(g => StateManager.markGroup(g));
      else if(action === CONFIG.ACTIONS.LOCK_GROUP) groups.forEach(g => StateManager.lockGroup(g));
      // 全局操作
      else if(action === CONFIG.ACTIONS.SELECT_ALL) Filter.selectAllFilters();
      else if(action === CONFIG.ACTIONS.CLEAR_ALL) Filter.clearAllFilters();
      else if(action === CONFIG.ACTIONS.SAVE_FILTER) Business.saveFilterPrompt();
      else if(action === CONFIG.ACTIONS.CLEAR_ALL_SAVED) Business.clearAllSavedFilters();
      // 排除号码操作
      else if(action === CONFIG.ACTIONS.INVERT_EXCLUDE) Business.invertExclude();
      else if(action === CONFIG.ACTIONS.UNDO_EXCLUDE) Business.markExclude();
      else if(action === CONFIG.ACTIONS.BATCH_EXCLUDE) Business.batchExcludePrompt();
      else if(action === CONFIG.ACTIONS.CLEAR_EXCLUDE) Business.clearExclude();
      // 方案操作
      else if(action === CONFIG.ACTIONS.TOGGLE_SHOW_ALL) Business.toggleShowAllFilters();
      else if(action === CONFIG.ACTIONS.LOAD_FILTER) Business.loadFilter(Number(index));
      else if(action === CONFIG.ACTIONS.RENAME_FILTER) Business.renameFilter(Number(index));
      else if(action === CONFIG.ACTIONS.COPY_FILTER) Business.copyFilterNums(Number(index));
      else if(action === CONFIG.ACTIONS.TOP_FILTER) Business.topFilter(Number(index));
      else if(action === CONFIG.ACTIONS.DELETE_FILTER) Business.deleteFilter(Number(index));
      // 导航操作
      else if(action === CONFIG.ACTIONS.SWITCH_NAV) Business.switchBottomNav(Number(index));
      // 分析页面操作
      else if(action === 'refreshHistory') Business.refreshHistory();
      else if(action === 'syncAnalyze') Business.syncAnalyze();
      else if(action === 'syncZodiacAnalyze') Business.syncZodiacAnalyze();
      else if(action === 'toggleDetail') Business.toggleDetail(actionBtn.dataset.target);
      else if(action === 'loadMoreHistory') Business.loadMoreHistory();
      else if(action === 'toggleExcludeLock') Business.toggleExcludeLock();
      else if(action === 'toggleDBDetail') ViewZodiacPrediction.toggleDBDetail();
      else if(action === 'batchSelectGroup') ViewFilter.showBatchModal(group);
      else if(action === 'closeBatchModal') ViewFilter.closeBatchModal();
      else if(action === 'confirmBatchSelect') ViewFilter.confirmBatchSelect();
      else if(action === 'showBacktestDetail') {
        var modal = document.getElementById('backtestDetailModal');
        if (modal) modal.style.display = 'flex';
      }
      else if(action === 'closeBacktestDetail') {
        var modal = document.getElementById('backtestDetailModal');
        if (modal) modal.style.display = 'none';
      }
      else if(action === 'showGiongDetail') {
        var giongData = ViewZodiacPrediction._cachedGiongData;
        if (giongData) ViewZodiacPrediction.showGiongDetailModal(giongData);
      }
      else if(action === 'closeGiongDetail') {
        ViewZodiacPrediction.closeGiongDetailModal();
      }
      else if(action === 'switchFreqCard') {
        var freqIndex = Number(actionBtn.dataset.freqIndex);
        if (ViewZodiacPrediction.freqSwiperUpdate) {
          ViewZodiacPrediction.freqSwiperUpdate(freqIndex);
        }
      }
      else if(action === 'switchFreqTab') {
        var freqKey = actionBtn.dataset.freqKey;
        document.querySelectorAll('.freq-tab-btn').forEach(function(btn) {
          btn.classList.toggle('active', btn.dataset.freqKey === freqKey);
        });
        document.querySelectorAll('.freq-panel').forEach(function(panel) {
          panel.style.display = panel.dataset.freqPanel === freqKey ? '' : 'none';
        });
      }
      else if(action === 'switchPredCard') {
        var predIndex = Number(actionBtn.dataset.predIndex);
        if (ViewZodiacPrediction.predSwiperUpdate) {
          ViewZodiacPrediction.predSwiperUpdate(predIndex);
        }
      }
      else if(action === 'switchPredTab') {
        var predTab = actionBtn.dataset.predTab;
        document.querySelectorAll('#zodiacPredictionGrid .freq-tab-btn').forEach(function(btn) {
          btn.classList.toggle('active', btn.dataset.predTab === predTab);
        });
        document.querySelectorAll('#zodiacPredictionGrid .freq-panel').forEach(function(panel) {
          panel.style.display = panel.dataset.predPanel === predTab ? '' : 'none';
        });
      }
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

    // 9. 资料页标签切换
    const zodiacTabBtn = target.closest('.zodiac-tab-btn[data-zodiac-tab]');
    if(zodiacTabBtn){
      Business.switchZodiacTab(zodiacTabBtn.dataset.zodiacTab);
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
    if(DOM.navToggle.contains(e.target)) return;
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
