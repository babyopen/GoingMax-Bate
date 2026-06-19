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
    window.addEventListener('scroll', Business.handleScroll, { passive: true });
    // 点击空白关闭快捷导航
    document.addEventListener('click', EventBinder.handleClickOutside);
    // 触摸事件 passive 监听（移动端滚动性能优化）
    document.addEventListener('touchstart', () => {}, { passive: true });
    document.addEventListener('touchmove', () => {}, { passive: true });
    // 页面卸载清理
    window.addEventListener('beforeunload', Business.handlePageUnload);
    // 全局错误捕获
    window.addEventListener('error', EventBinder.handleGlobalError);
    
    // 分析页面：全维度分析选择器change事件（符合分层规范：事件层负责DOM查询）
    const analyzeSelect = document.getElementById('analyzeSelect');
    if(analyzeSelect) {
      analyzeSelect.addEventListener('change', function() {
        const customNumEl = document.getElementById('customNum');
        const domValues = {
          custom: customNumEl ? customNumEl.value.trim() : '',
          selectVal: analyzeSelect.value
        };
        Business.syncAnalyze(domValues);
      });
      analyzeSelect.addEventListener('input', function() {
        const customNumEl = document.getElementById('customNum');
        const domValues = {
          custom: customNumEl ? customNumEl.value.trim() : '',
          selectVal: analyzeSelect.value
        };
        Business.syncAnalyze(domValues);
      });
    }

    // 分析页面：自定义期数输入事件（防抖优化，符合分层规范）
    const customNum = document.getElementById('customNum');
    if(customNum) {
      const debouncedSync = Utils.debounce(() => {
        const analyzeSelectEl = document.getElementById('analyzeSelect');
        const domValues = {
          custom: customNum.value.trim(),
          selectVal: analyzeSelectEl ? analyzeSelectEl.value : '12'
        };
        Business.syncAnalyze(domValues);
      }, 300);
      customNum.addEventListener('input', function() {
        debouncedSync();
      });
    }
    
    // 弹窗键盘监听（移动端键盘弹出时调整弹窗位置）
    let resizeTimer;
    function onViewportChange() {
      if (typeof ViewFilter !== 'undefined' && ViewFilter.adjustModalPosition) {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => ViewFilter.adjustModalPosition(), 100);
      }
    }
    window.addEventListener('resize', onViewportChange);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', onViewportChange);
    }
    
    // 分析页面：特码生肖关联选择器change事件（符合分层规范：事件层负责DOM查询）
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    if(zodiacAnalyzeSelect) {
      zodiacAnalyzeSelect.addEventListener('change', function() {
        const zodiacCustomNumEl = document.getElementById('zodiacCustomNum');
        const numCountSelectEl = document.getElementById('numCountSelect');
        const customNumCountEl = document.getElementById('customNumCount');
        const domValues = {
          customPeriod: zodiacCustomNumEl ? zodiacCustomNumEl.value.trim() : '',
          selectPeriodVal: zodiacAnalyzeSelect.value,
          countVal: numCountSelectEl ? numCountSelectEl.value : '5',
          customCount: customNumCountEl ? customNumCountEl.value.trim() : ''
        };
        Business.syncZodiacAnalyze(domValues);
      });
    }
    
    // 分析页面：号码数量选择器change事件（符合分层规范）
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    
    if(numCountSelect) {
      numCountSelect.addEventListener('change', function() {
        const zodiacCustomNumEl = document.getElementById('zodiacCustomNum');
        const zodiacAnalyzeSelectEl = document.getElementById('zodiacAnalyzeSelect');
        const domValues = {
          customPeriod: zodiacCustomNumEl ? zodiacCustomNumEl.value.trim() : '',
          selectPeriodVal: zodiacAnalyzeSelectEl ? zodiacAnalyzeSelectEl.value : '36',
          countVal: numCountSelect.value,
          customCount: customNumCount ? customNumCount.value.trim() : ''
        };
        Business.syncZodiacAnalyze(domValues);
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
   * 全局双击处理（标签锁定/解锁、标记按钮清除标记）
   * @param {MouseEvent} e - 双击事件
   */
  handleDoubleClick: (e) => {
    const target = e.target;
    // 标记按钮双击：清空该分组所有标记（支持多分组按钮）
    const markBtn = target.closest('.btn-mini[data-action="markGroup"]');
    if (markBtn) {
      const groupAttr = markBtn.dataset.group;
      if (groupAttr) {
        const groups = groupAttr.split(',');
        groups.forEach(g => StateManager.clearGroupMarks(g));
        Toast.show('已清除所有标记');
      }
      return;
    }
    // 标签双击：锁定/解锁
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
    const navTab = target.closest('.nav-tab');
    if(navTab){
      const navType = navTab.dataset.navType;
      if (navType === 'scroll') {
        const targetId = navTab.dataset.target;
        if (targetId) Business.scrollToModule(targetId);
      } else if (navType === 'tab') {
        const page = navTab.dataset.page;
        const tabName = navTab.dataset.tabName;
        if (page === 'analysis') {
          Business.switchAnalysisTab(tabName);
        } else if (page === 'random') {
          Business.switchZodiacTab(tabName);
        } else if (page === 'profile') {
          EventBinder._switchProfileTab(tabName);
        }
      }
      Business.toggleQuickNav(false);
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
      
      // 分组操作（符合分层规范：事件层负责DOM查询，核心层只处理数据）
      if(action === CONFIG.ACTIONS.RESET_GROUP) groups.forEach(g => StateManager.resetGroup(g));
      else if(action === CONFIG.ACTIONS.SELECT_GROUP) {
        groups.forEach(g => {
          // 兼容路径：使用 Utils.getTagValues 消除 querySelectorAll + formatTagValue 重复
          StateManager.selectGroup(g, Utils.getTagValues(g));
        });
      }
      else if(action === CONFIG.ACTIONS.INVERT_GROUP) {
        groups.forEach(g => {
          // 兼容路径：使用 Utils.getTagValues 消除 querySelectorAll + formatTagValue 重复
          StateManager.invertGroup(g, Utils.getTagValues(g));
        });
      }
      else if(action === CONFIG.ACTIONS.CLEAR_GROUP) groups.forEach(g => StateManager.clearGroup(g));
      else if(action === CONFIG.ACTIONS.MARK_GROUP) {
        // 检查是否首次点击标记按钮
        const hasShownHint = Storage.get(Storage.KEYS.MARK_HINT_SHOWN, false);
        if (!hasShownHint) {
          Toast.show('双击可清空所有标记');
          Storage.set(Storage.KEYS.MARK_HINT_SHOWN, true);
        }
        groups.forEach(g => StateManager.markGroup(g));
      }
      else if(action === CONFIG.ACTIONS.LOCK_GROUP) groups.forEach(g => StateManager.lockGroup(g));
      // 全局操作
      else if(action === CONFIG.ACTIONS.SELECT_ALL) Filter.selectAllFilters();
      else if(action === CONFIG.ACTIONS.CLEAR_ALL) Filter.clearAllFilters();
      else if(action === CONFIG.ACTIONS.SAVE_FILTER) Business.saveFilterPrompt();
      else if(action === CONFIG.ACTIONS.SAVE_ZODIAC_FILTER) Business.saveZodiacFilterPrompt();
      else if(action === CONFIG.ACTIONS.CLEAR_ALL_SAVED) Business.clearAllSavedFilters();
      // 排除号码操作
      else if(action === CONFIG.ACTIONS.INVERT_EXCLUDE) Business.invertExclude();
      else if(action === CONFIG.ACTIONS.UNDO_EXCLUDE) Business.undoExclude();
      else if(action === CONFIG.ACTIONS.CLEAR_EXCLUDE) Business.clearExclude();
      // 方案操作
      else if(action === CONFIG.ACTIONS.TOGGLE_SHOW_ALL) Business.toggleShowAllFilters();
      else if(action === CONFIG.ACTIONS.LOAD_FILTER) Business.loadFilter(Number(index));
      else if(action === CONFIG.ACTIONS.RENAME_FILTER) Business.renameFilter(Number(index));
      else if(action === CONFIG.ACTIONS.COPY_FILTER) Business.copyFilterNums(Number(index));
      else if(action === CONFIG.ACTIONS.TOP_FILTER) Business.topFilter(Number(index));
      else if(action === CONFIG.ACTIONS.LOCK_FILTER) Business.toggleLockFilter(Number(index));
      else if(action === CONFIG.ACTIONS.DELETE_FILTER) Business.deleteFilter(Number(index));
      // 2026-06-20 新增：方案分组相关 action（路由到 Business.FilterGroup.*）
      else if(action === 'addFilterGroup') {
        // 弹窗输入分组名（默认"分组一"，由 Business.FilterGroup._genDefaultName 自动取下一个序号）
        const defaultName = (typeof Business.FilterGroup === 'object') ? Business.FilterGroup._genDefaultName() : '分组一';
        GIONGBETA_INPUT_MODAL.show('新建分组', '请输入分组名称', defaultName, (val) => {
          if (!val || !val.trim()) return;
          if (typeof Business.FilterGroup === 'object' && typeof Business.FilterGroup.createGroup === 'function') {
            Business.FilterGroup.createGroup(val);
          }
        });
      }
      else if(action === 'switchFilterGroup') {
        const groupId = actionBtn.dataset.groupId;
        if (groupId && typeof Business.FilterGroup === 'object' && typeof Business.FilterGroup.switchGroup === 'function') {
          Business.FilterGroup.switchGroup(groupId);
        }
      }
      else if(action === 'renameFilterGroup') {
        const groupId = actionBtn.dataset.groupId;
        if (groupId && typeof Business.FilterGroup === 'object' && typeof Business.FilterGroup.renameGroup === 'function') {
          Business.FilterGroup.renameGroup(groupId);
        }
      }
      else if(action === 'deleteFilterGroup') {
        const groupId = actionBtn.dataset.groupId;
        if (groupId && typeof Business.FilterGroup === 'object' && typeof Business.FilterGroup.deleteGroup === 'function') {
          Business.FilterGroup.deleteGroup(groupId);
        }
      }
      // 复制主推与备选生肖（终极推荐卡片右上角按钮，DOM 顺序拼接，空格分隔）
      else if(action === 'copyMainZodiacs') {
        const card = actionBtn.closest('.db-result-container');
        if(!card) return;
        const allNames = card.querySelectorAll('#ultimateMainGrid .db-card-name, #ultimateBackupGrid .db-card-name');
        const zodiacs = Array.prototype.map.call(allNames, n => (n.textContent || '').trim()).filter(Boolean);
        if(zodiacs.length === 0){ Toast.show('暂无生肖'); return; }
        Business.copyMainZodiacs(zodiacs.join(' '));
      }
      // 复制前 6 名生肖（生肖预测 / Giong 推荐 grid 右上角按钮；Giong 与生肖预测标题行也能触发）
      else if(action === 'copyZodiacTop6') {
        const trigger = actionBtn.closest('.zodiac-pred-grid, .zodiac-static-grid, .giong-header-row, .zp-header-row');
        if(!trigger) return;
        let grid = trigger;
        if(trigger.classList.contains('giong-header-row') || trigger.classList.contains('zp-header-row')){
          grid = trigger.parentElement ? trigger.parentElement.querySelector('.zodiac-pred-grid, .zodiac-static-grid') : null;
        }
        if(!grid) return;
        const names = grid.querySelectorAll('.zodiac-static-card .zodiac-static-name');
        const zodiacs = Array.prototype.map.call(names, n => (n.textContent || '').trim()).filter(Boolean).slice(0, 6);
        if(zodiacs.length === 0){ Toast.show('暂无生肖'); return; }
        Business.copyMainZodiacs(zodiacs.join(' '));
      }
      // 复制主页生肖卡片中已选生肖（视图层动态注入的按钮；数据源来自 StateManager.selected.zodiac）
      else if(action === 'copySelectedZodiacs') {
        Business.copySelectedZodiacs();
      }
      // 导航操作
      else if(action === CONFIG.ACTIONS.SWITCH_NAV) Business.switchBottomNav(Number(index));
      // 分析页面操作
      else if(action === 'refreshHistory') Business.refreshHistory();
      else if(action === 'syncAnalyze') Business.syncAnalyze();
      else if(action === 'syncZodiacAnalyze') Business.syncZodiacAnalyze();
      else if(action === 'toggleDetail') Business.toggleDetail(actionBtn.dataset.target);
      else if(action === 'loadMoreHistory') Business.loadMoreHistory();
      else if(action === 'toggleExcludeLock') Business.toggleExcludeLock();
      // 大小回测操作
      else if(action === 'showSizeBacktest') EventBinder._showSizeBacktest();
      // 单双回测操作
      else if(action === 'showOddEvenBacktest') EventBinder._showOddEvenBacktest();
      // 五行回测操作
      else if(action === 'showWuxingBacktest') EventBinder._showWuxingBacktest();
      // 波色回测操作
      else if(action === 'showColorBacktest') EventBinder._showColorBacktest();
      // 未推荐生肖 - 查看来源弹窗
      else if(action === 'showUnrecSources') ViewZodiacUltimate.showUnrecSourcesModal();
      else if(action === 'batchSelectGroup') ViewFilter.showBatchModal(group);
      else if(action === 'closeBatchModal') ViewFilter.closeBatchModal();
      else if(action === 'confirmBatchSelect') ViewFilter.confirmBatchSelect();
      else if(action === 'toggleCollapse') {
        const header = actionBtn.closest('.card-header.collapsible');
        if(header){
          const targetId = header.dataset.target;
          const body = targetId ? document.getElementById(targetId) : header.nextElementSibling;
          if(body && body.classList.contains('card-body')){
            const isCollapsed = header.classList.toggle('collapsed');
            body.classList.toggle('collapsed', isCollapsed);
          }
        }
      }
      else if(action === 'toggleScoreCards') {
        var cards = document.getElementById('swScoreCards');
        if (!cards) return;
        var isExpanded = cards.classList.toggle('expanded');
        actionBtn.textContent = isExpanded
          ? '收起'
          : '展开全部（共' + cards.querySelectorAll('.sw-score-card').length + '个生肖）';
        actionBtn.dataset.expanded = isExpanded ? 'true' : 'false';
      }
      // 回测追踪展开/折叠
      else if(action === 'toggleBacktestSection') {
        var section = document.getElementById('mainBacktestSection');
        if (!section) return;
        var contents = section.querySelectorAll('.sw-backtest-content');
        var isExpanded = section.classList.toggle('expanded');
        contents.forEach(function(c) {
          c.style.display = isExpanded ? '' : 'none';
        });
        var btn = actionBtn.querySelector('svg');
        if (btn) {
          btn.style.transform = isExpanded ? 'rotate(180deg)' : '';
        }
      }
      else if(action === 'showBacktestDetail') {
        ViewZodiacUltimate.toggleBacktestDetailModal(true);
      }
      else if(action === 'closeBacktestDetail') {
        ViewZodiacUltimate.toggleBacktestDetailModal(false);
      }
      // TongJi 生肖表头排序（2026-06-20 用户需求：表头点击升序降序）
      //   - 业务层计算下一排序方向并触发视图重渲染
      //   - 此处提到 if-else 链之前优先匹配（确保不被其它分支吞掉）
      if(action === 'zodiac-tongji-sort') {
        // 阻止冒泡到外层可能的 click 拦截（iOS Safari 触屏场景）
        e.preventDefault();
        e.stopPropagation();
        var sortKey = actionBtn.dataset.sortKey;
        if (sortKey && Business && Business.toggleZodiacTongjiSort) {
          Business.toggleZodiacTongjiSort(sortKey);
        }
        return;
      }
      // 区域变动追踪展开/折叠
      else if(action === 'toggleZoneChangeList') {
        var list = actionBtn.closest('.zone-change-list');
        if (!list) return;
        var isExpanded = list.classList.toggle('expanded');
        var toggleText = list.querySelector('.zone-change-toggle-text');
        var toggleIcon = list.querySelector('.zone-change-toggle-icon');
        if (toggleText) toggleText.textContent = isExpanded ? '收起' : '展开更多';
        if (toggleIcon) toggleIcon.textContent = isExpanded ? '▲' : '▼';
        // 持久化用户偏好
        Storage.saveZoneChangeExpanded(isExpanded);
      }
      // 多窗口组合列表展开/折叠
      else if(action === 'toggleZoneChangeComboList') {
        var comboList = actionBtn.closest('.zone-change-combo-list');
        if (!comboList) return;
        var isComboExpanded = comboList.classList.toggle('expanded');
        var comboToggleText = comboList.querySelector('.zone-change-toggle-text');
        var comboToggleIcon = comboList.querySelector('.zone-change-toggle-icon');
        if (comboToggleText) comboToggleText.textContent = isComboExpanded ? '收起' : '展开更多';
        if (comboToggleIcon) comboToggleIcon.textContent = isComboExpanded ? '▲' : '▼';
      }
      else if(action === 'showZodiacStat') {
        var zodiac = actionBtn.dataset.zodiac;
        if (zodiac && ViewZodiacGiong._cachedFreqResult) {
          var freqResult = ViewZodiacGiong._cachedFreqResult;
          var data = null;
          var periods = ['p12', 'p24', 'p36'];
          for (var i = 0; i < periods.length; i++) {
            var periodData = freqResult[periods[i]];
            if (periodData) {
              for (var j = 0; j < periodData.length; j++) {
                if (periodData[j].zodiac === zodiac) {
                  data = periodData[j];
                  break;
                }
              }
              if (data) break;
            }
          }
          
          var missHistory = null;
          var followStats = null;
          var state = StateManager._state;
          var historyData = state.analysis.historyData;
          if (historyData && historyData.length) {
            missHistory = ZodiacPrediction.calcZodiacMissHistory(historyData, zodiac);
            followStats = ZodiacPrediction.calcZodiacFollowers(historyData, zodiac, 4, 20);
          }
          
          if (data) {
            ZodiacStatModal.show(zodiac, data, freqResult, missHistory, followStats);
          }
        }
      }
      else if(action === 'switchFreqCard') {
        var freqIndex = Number(actionBtn.dataset.freqIndex);
        if (ViewZodiacGiong.freqSwiperUpdate) {
          ViewZodiacGiong.freqSwiperUpdate(freqIndex);
        }
      }
      else if(action === 'switchFreqTab') {
        var freqKey = actionBtn.dataset.freqKey;
        EventBinder._handleSwitchFreqTab(freqKey);
      }
      else if(action === 'switchPredCard') {
        var predIndex = Number(actionBtn.dataset.predIndex);
        if (ViewZodiacPredict.predSwiperUpdate) {
          ViewZodiacPredict.predSwiperUpdate(predIndex);
        }
      }
      else if(action === 'switchPredTab') {
        var predTab = actionBtn.dataset.predTab;
        ViewZodiacPredict.switchPredTabUI(predTab);
      }
      else if(action === 'showOverlap') {
        ViewFilter.showOverlapModal();
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

    // 8.1 精选推荐回测（#zodiacFinalNum 点击）
    const finalNumEl = target.closest('#zodiacFinalNum');
    if(finalNumEl){
      EventBinder._showFinalBacktest();
      return;
    }

    // 9. 资料页标签切换
    const zodiacTabBtn = target.closest('.zodiac-tab-btn[data-zodiac-tab]');
    if(zodiacTabBtn){
      Business.switchZodiacTab(zodiacTabBtn.dataset.zodiacTab);
      return;
    }

    // 10. 更多功能开发中点击跳转
    const emptyTip = target.closest('.empty-tip');
    if(emptyTip && emptyTip.textContent.includes('更多功能开发中')){
      window.location.href = 'https://aebhwxjgna.00512dh1.app:3728/00512.html';
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
    if(DOM.navToggle && DOM.navToggle.contains(e.target)) return;
    // 底部导航栏按钮点击时跳过收起（由 switchBottomNav 中的 setTimeout 控制展开/收起）
    if(e.target.closest('.bottom-nav-item')) return;
    if(DOM.quickNav && !DOM.quickNav.contains(e.target) && DOM.quickNav.classList.contains('expanded')){
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
  },

  /**
   * 显示大小回测追踪弹窗
   */
  _showSizeBacktest: function() {
    try {
      var state = StateManager._state;
      var historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      var backtestData = ZodiacPrediction.runSizeBacktest(historyData, 15);

      if (!backtestData) {
        Toast.show('回测执行失败，请重试');
        return;
      }

      ViewZodiacGiong.showSizeBacktestModal(backtestData);
    } catch (e) {
      console.error('大小回测出错:', e);
      Toast.show('回测计算出错，请重试');
    }
  },

  /**
   * 显示单双回测追踪弹窗
   */
  _showOddEvenBacktest: function() {
    try {
      var state = StateManager._state;
      var historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      var backtestData = ZodiacPrediction.runOddEvenBacktest(historyData, 15);

      if (!backtestData) {
        Toast.show('回测执行失败，请重试');
        return;
      }

      ViewZodiacGiong.showOddEvenBacktestModal(backtestData);
    } catch (e) {
      console.error('单双回测出错:', e);
      Toast.show('回测计算出错，请重试');
    }
  },

  /**
   * 显示五行回测追踪弹窗
   */
  _showWuxingBacktest: function() {
    try {
      var state = StateManager._state;
      var historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      var backtestData = ZodiacPrediction.runWuxingBacktest(historyData, 15);

      if (!backtestData) {
        Toast.show('回测执行失败，请重试');
        return;
      }

      ViewZodiacGiong.showWuxingBacktestModal(backtestData);
    } catch (e) {
      console.error('五行回测出错:', e);
      Toast.show('回测计算出错，请重试');
    }
  },

  _showColorBacktest: function() {
    try {
      var state = StateManager._state;
      var historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      var backtestData = ZodiacPrediction.runColorBacktest(historyData, 12);
      if (!backtestData) {
        Toast.show('回测执行失败，请重试');
        return;
      }

      ViewZodiacGiong.showColorBacktestModal(backtestData);
    } catch (e) {
      console.error('波色回测出错:', e);
      Toast.show('回测计算出错，请重试');
    }
  },

  /**
   * 显示精选推荐 6 肖回测弹窗（点击 #zodiacFinalNum 触发）
   */
  _showFinalBacktest: function() {
    try {
      var state = StateManager._state;
      var historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 14) {
        Toast.show('数据不足（需至少14期，当前仅' + historyData.length + '期）');
        return;
      }

      var backtestData = ZodiacPrediction.runFinalZodiacBacktest(historyData, 20);
      if (!backtestData) {
        Toast.show('回测执行失败，请重试');
        return;
      }

      ViewAnalysis.showFinalBacktestModal(backtestData);
    } catch (e) {
      console.error('精选六肖回测出错:', e);
      Toast.show('回测计算出错，请重试');
    }
  },

  /**
   * 我的页面标签切换（委托 ViewProfile 渲染）
   * @param {string} tab - 标签名称：mine / official / phoenix / daxian
   */
  _switchProfileTab: function(tab) {
    // 委托视图层渲染（与 ViewProfile.switchProfileTabUI 行为一致）
    if (typeof ViewProfile !== 'undefined' && ViewProfile.switchProfileTabUI) {
      ViewProfile.switchProfileTabUI(tab);
    }
    // 切换到『我的』面板时，动态注入"使用说明"卡片（仅一次）
    if (tab === 'mine' && typeof ViewProfile !== 'undefined' && ViewProfile.renderHelpCard) {
      ViewProfile.renderHelpCard();
    }
    // 记录『我的』页面当前子 tab（用于再次进入『我的』时恢复）
    Storage.saveLastTab('profile', tab);
    // 懒加载iframe
    if (tab === 'official') {
      var officialFrame = document.getElementById('officialFrame');
      var officialLoading = document.getElementById('officialLoading');
      if (officialFrame && !officialFrame.src) {
        officialFrame.src = 'https://sjz-xl2.09567k.app:7022/#dh2/';
        officialFrame.style.display = 'block';
        officialLoading.style.display = 'none';
      }
    } else if (tab === 'phoenix') {
      var phoenixFrame = document.getElementById('phoenixFrame');
      var phoenixLoading = document.getElementById('phoenixLoading');
      if (phoenixFrame && !phoenixFrame.src) {
        phoenixFrame.src = 'https://176744.com';
        phoenixFrame.style.display = 'block';
        phoenixLoading.style.display = 'none';
      }
    } else if (tab === 'daxian') {
      var daxianFrame = document.getElementById('daxianFrame');
      var daxianLoading = document.getElementById('daxianLoading');
      if (daxianFrame && !daxianFrame.src) {
        daxianFrame.src = 'https://rk3lx78d.66660149m.app:2026/66660149.app#66660149://01492026.com';
        daxianFrame.style.display = 'block';
        daxianLoading.style.display = 'none';
      }
    }
  },

  /**
   * 切换频率Tab（UI 立即响应，区域变动追踪重计算做防抖避免快速切换浪费）
   * @param {string} freqKey - 频率key（p12/p24/p36）
   */
  _handleSwitchFreqTab: function(freqKey) {
    // UI 切换立即执行，用户感知零延迟
    ViewZodiacGiong.switchFreqTabUI(freqKey);
    // 重计算用防抖，避免快速来回切换
    EventBinder._renderZoneChangeDebounced(freqKey);
  },

  /**
   * 渲染区域变动追踪（防抖，200ms 内多次切换只算最后一次）
   * @param {string} freqKey - 频率key（p12/p24/p36）
   */
  _renderZoneChangeDebounced: Utils.debounce(function(freqKey) {
    var wSize = parseInt(freqKey.replace('p', '')) || 12;
    var historyData = StateManager._state.analysis.historyData;
    var zoneChangeData = ZodiacPrediction.calcZoneChangeTracking(historyData, wSize);
    ViewZodiacGiong.renderZoneChangeTracking(zoneChangeData);
  }, 200)
};
