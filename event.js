const EventBinder = {
  /**
   * 自定义双击检测状态（解决 .tag 双击易误触问题）
   * 浏览器原生 dblclick 默认 500ms 内两次 click 即触发，过于宽松
   * 改为：同元素 + 200ms 内 + 8px 内 才算双击
   */
  _lastTagClick: { target: null, time: 0, x: 0, y: 0 },
  // 自定义双击触发后 500ms 保护窗，期间内原生 dblclick 不处理 .tag（防重复触发）
  _tagDblClickGuardUntil: 0,

  // ============================================================
  // 2026-07-04 新增：长按检测状态（个人中心页长按 div 弹出书签菜单）
  // ============================================================
  _longPressTimer: null,
  _longPressResolved: null, // { kind, el, id?, title? }
  _longPressStartX: 0,
  _longPressStartY: 0,
  _longPressTriggered: false,
  // 长按阈值（毫秒）
  LONG_PRESS_DURATION: 600,
  // 滑动容差（超过则取消长按，避免误触发）
  LONG_PRESS_MOVE_TOLERANCE: 12,

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
    // v2.0.9 修复：html/body 都被设为 overflow:hidden，window 永远不滚动
    // 真实滚动容器是 .page-scroll，scroll 监听必须挂到它上面
    const _pageScrollEl = document.querySelector('.page-scroll');
    if (_pageScrollEl) {
      _pageScrollEl.addEventListener('scroll', Business.handleScroll, { passive: true });
    }
    // 点击空白关闭快捷导航
    document.addEventListener('click', EventBinder.handleClickOutside);
    // 触摸事件 passive 监听（移动端滚动性能优化）
    document.addEventListener('touchstart', EventBinder.handleTouchStart, { passive: true });
    document.addEventListener('touchmove', EventBinder.handleTouchMove, { passive: true });
    document.addEventListener('touchend', EventBinder.handleTouchEnd, { passive: true });
    document.addEventListener('touchcancel', EventBinder.handleTouchEnd, { passive: true });
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
      // 自定义双击保护窗：click 序列检测已命中后，期间内原生 dblclick 直接跳过（防重复触发）
      if (Date.now() < EventBinder._tagDblClickGuardUntil) return;
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
      // 自定义双击检测：同元素 + 200ms 内 + 8px 内（解决原生 dblclick 易误触问题）
      const now = Date.now();
      const lc = EventBinder._lastTagClick;
      if (
        lc.target === tag &&
        now - lc.time < 200 &&
        Math.abs(e.clientX - lc.x) < 8 &&
        Math.abs(e.clientY - lc.y) < 8
      ) {
        // 自定义双击命中：执行锁定/解锁，并设置 500ms 保护窗
        // 期间内原生 dblclick 会被 handleDoubleClick 跳过，避免重复触发
        StateManager.toggleTagLock(group, value);
        EventBinder._lastTagClick = { target: null, time: 0, x: 0, y: 0 };
        EventBinder._tagDblClickGuardUntil = now + 500;
        return;
      }
      // 首次点击 / 不构成双击：记录状态并执行选中
      EventBinder._lastTagClick = { target: tag, time: now, x: e.clientX, y: e.clientY };
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
        } else if (page === 'exclude') {
          // v2.0.9 新增：主页面快捷导航里的"排除"按钮，切换到独立标签页 excludePage
          Business.switchExcludePage();
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
      // ============================================================
      // 2026-07-04 新增：书签相关 action（个人中心页）
      // ============================================================
      // 显示书签输入弹窗（双输入：标题 + URL）
      else if(action === 'showBookmarkInput') {
        if (typeof ViewBookmark !== 'undefined') {
          ViewBookmark.showInputModal();
        }
      }
      // 书签输入弹窗：取消
      else if(action === 'bookmarkInputCancel') {
        if (typeof ViewBookmark !== 'undefined') {
          ViewBookmark.hideInputModal();
        }
      }
      // 书签输入弹窗：保存并打开
      else if(action === 'bookmarkInputConfirm') {
        if (typeof ViewBookmark !== 'undefined') {
          ViewBookmark._submitInput();
        }
      }
      // 打开已保存的书签（点击列表项）
      else if(action === 'openBookmark') {
        const bookmarkId = Number(actionBtn.dataset.bookmarkId);
        const bookmarkList = (typeof BusinessBookmark !== 'undefined') ? BusinessBookmark.getBookmarks() : [];
        const bookmarkTarget = bookmarkList.find(function(b) { return b.id === bookmarkId; });
        if (bookmarkTarget && typeof ViewBookmark !== 'undefined') {
          ViewBookmark.openInIframe(bookmarkTarget.url, bookmarkTarget.title);
        }
      }
      // 删除书签
      else if(action === 'deleteBookmark') {
        const delId = Number(actionBtn.dataset.bookmarkId);
        if (delId && typeof ViewBookmark !== 'undefined') {
          ViewBookmark.deleteBookmarkWithConfirm(delId);
        }
      }
      // 长按书签标签菜单触发的删除（payload 存放 bookmarkId）
      else if(action === 'deleteBookmarkFromMenu') {
        const delId = Number(actionBtn.dataset.payload);
        if (delId && typeof ViewBookmark !== 'undefined') {
          ViewBookmark.closeLongPressMenu();
          ViewBookmark.deleteBookmarkWithConfirm(delId);
        }
      }
      // 关闭 iframe 容器
      else if(action === 'closeBookmarkIframe') {
        if (typeof ViewBookmark !== 'undefined') {
          ViewBookmark.closeIframe();
        }
      }
      // 关闭长按菜单
      else if(action === 'closeLongPressMenu') {
        if (typeof ViewBookmark !== 'undefined') {
          ViewBookmark.closeLongPressMenu();
        }
      }
      // 特码明细：展开/收起折叠区（默认仅展示前 20 条）
      else if(action === 'togglePredrawRecent') {
        const list = actionBtn.previousElementSibling;
        if (!list || !list.classList.contains('tj-predraw-recent-collapsed')) return;
        const collapsed = list.dataset.collapsed === '1';
        if (collapsed) {
          list.style.display = '';
          list.dataset.collapsed = '0';
          const hiddenCount = list.querySelectorAll('.tj-predraw-item').length;
          actionBtn.textContent = '收起剩余 ' + hiddenCount + ' 期';
        } else {
          list.style.display = 'none';
          list.dataset.collapsed = '1';
          const hiddenCount = list.querySelectorAll('.tj-predraw-item').length;
          actionBtn.textContent = '展开剩余 ' + hiddenCount + ' 期';
        }
      }
      // 等级预测回测弹窗（2026-07-12 用户需求）
      else if(action === 'openLevelBacktest') {
        var state = StateManager._state;
        var historyData = BusinessCommonData.ensureHistoryData(state);
        if (historyData && historyData.length) {
          var backtestData = ZodiacPrediction.predictLevelBacktest(historyData);
          LevelPredictModal.show(backtestData);
        }
      }
      // 精选特码回测弹窗-复制预测号码（2026-07-14 新增）
      else if(action === 'copyPredictNums') {
        var nums = target.getAttribute('data-predict-nums') || '';
        if (nums) {
          Utils.copyToClipboard(nums, { successMsg: '预测号码已复制' });
        }
      }
      // 导航操作
      else if(action === CONFIG.ACTIONS.SWITCH_NAV) Business.switchBottomNav(Number(index));
      // 分析页面操作
      else if(action === 'refreshHistory') Business.refreshHistory();
      else if(action === 'syncAnalyze') {
        // 2026-06-21 架构修复：业务层禁止 DOM 操作，由 event.js 读取 DOM value 后传入 domValues
        const _customNumEl = document.getElementById('customNum');
        const _analyzeSelectEl = document.getElementById('analyzeSelect');
        Business.syncAnalyze({
          custom: _customNumEl ? _customNumEl.value.trim() : '',
          selectVal: _analyzeSelectEl ? _analyzeSelectEl.value : '12'
        });
      }
      else if(action === 'syncZodiacAnalyze') {
        // 2026-06-21 架构修复：业务层禁止 DOM 操作，由 event.js 读取 DOM value 后传入 domValues
        const _zodiacCustomNumEl = document.getElementById('zodiacCustomNum');
        const _zodiacAnalyzeSelectEl = document.getElementById('zodiacAnalyzeSelect');
        const _numCountSelectEl = document.getElementById('numCountSelect');
        const _customNumCountEl = document.getElementById('customNumCount');
        Business.syncZodiacAnalyze({
          customPeriod: _zodiacCustomNumEl ? _zodiacCustomNumEl.value.trim() : '',
          selectPeriodVal: _zodiacAnalyzeSelectEl ? _zodiacAnalyzeSelectEl.value : '36',
          countVal: _numCountSelectEl ? _numCountSelectEl.value : '5',
          customCount: _customNumCountEl ? _customNumCountEl.value.trim() : ''
        });
      }
      else if(action === 'toggleDetail') Business.toggleDetail(actionBtn.dataset.target);
      else if(action === 'loadMoreHistory') Business.loadMoreHistory();
      else if(action === 'toggleExcludeLock') {
        // v2.0.9 架构修复：事件层读取 DOM 状态，传递给业务层（业务层禁止读取 DOM）
        const isLocked = DOM.lockExclude.checked;
        Business.toggleExcludeLock(isLocked);
      }
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
        const cards = document.getElementById('swScoreCards');
        if (!cards) return;
        var isExpanded = cards.classList.toggle('expanded');
        actionBtn.textContent = isExpanded
          ? '收起'
          : '展开全部（共' + cards.querySelectorAll('.sw-score-card').length + '个生肖）';
        actionBtn.dataset.expanded = isExpanded ? 'true' : 'false';
      }
      // 回测追踪展开/折叠
      else if(action === 'toggleBacktestSection') {
        const section = document.getElementById('mainBacktestSection');
        if (!section) return;
        const contents = section.querySelectorAll('.sw-backtest-content');
        var isExpanded = section.classList.toggle('expanded');
        contents.forEach(function(c) {
          c.style.display = isExpanded ? '' : 'none';
        });
        const btn = actionBtn.querySelector('svg');
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
        const sortKey = actionBtn.dataset.sortKey;
        if (sortKey && Business && Business.toggleZodiacTongjiSort) {
          Business.toggleZodiacTongjiSort(sortKey);
        }
        return;
      }
      // 区域变动追踪展开/折叠
      else if(action === 'toggleZoneChangeList') {
        const list = actionBtn.closest('.zone-change-list');
        if (!list) return;
        var isExpanded = list.classList.toggle('expanded');
        const toggleText = list.querySelector('.zone-change-toggle-text');
        const toggleIcon = list.querySelector('.zone-change-toggle-icon');
        if (toggleText) toggleText.textContent = isExpanded ? '收起' : '展开更多';
        if (toggleIcon) toggleIcon.textContent = isExpanded ? '▲' : '▼';
        // 持久化用户偏好
        Storage.saveZoneChangeExpanded(isExpanded);
      }
      // 多窗口组合列表展开/折叠
      else if(action === 'toggleZoneChangeComboList') {
        const comboList = actionBtn.closest('.zone-change-combo-list');
        if (!comboList) return;
        const isComboExpanded = comboList.classList.toggle('expanded');
        const comboToggleText = comboList.querySelector('.zone-change-toggle-text');
        const comboToggleIcon = comboList.querySelector('.zone-change-toggle-icon');
        if (comboToggleText) comboToggleText.textContent = isComboExpanded ? '收起' : '展开更多';
        if (comboToggleIcon) comboToggleIcon.textContent = isComboExpanded ? '▲' : '▼';
      }
      // 多窗口组合统计区折叠/展开（默认折叠，只显示 header）
      else if(action === 'toggleComboStatsGrid') {
        const statsSection = actionBtn.closest('.zone-change-combo-stats-section');
        if (!statsSection) return;
        statsSection.classList.toggle('expanded');
      }
      else if(action === 'showZodiacStat') {
        const zodiac = actionBtn.dataset.zodiac;
        if (zodiac && ViewZodiacGiong._cachedFreqResult) {
          const freqResult = ViewZodiacGiong._cachedFreqResult;
          let data = null;
          const periods = ['p12', 'p24', 'p36'];
          for (let i = 0; i < periods.length; i++) {
            const periodData = freqResult[periods[i]];
            if (periodData) {
              for (let j = 0; j < periodData.length; j++) {
                if (periodData[j].zodiac === zodiac) {
                  data = periodData[j];
                  break;
                }
              }
              if (data) break;
            }
          }
          
          let missHistory = null;
          let followStats = null;
          const state = StateManager._state;
          const historyData = state.analysis.historyData;
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
        const freqIndex = Number(actionBtn.dataset.freqIndex);
        if (ViewZodiacGiong.freqSwiperUpdate) {
          ViewZodiacGiong.freqSwiperUpdate(freqIndex);
        }
      }
      else if(action === 'switchFreqTab') {
        const freqKey = actionBtn.dataset.freqKey;
        EventBinder._handleSwitchFreqTab(freqKey);
      }
      else if(action === 'switchPredCard') {
        const predIndex = Number(actionBtn.dataset.predIndex);
        if (ViewZodiacPredict.predSwiperUpdate) {
          ViewZodiacPredict.predSwiperUpdate(predIndex);
        }
      }
      else if(action === 'switchPredTab') {
        const predTab = actionBtn.dataset.predTab;
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

    // 9.1 我的页面标签切换
    const profileTabBtn = target.closest('.zodiac-tab-btn[data-profile-tab]');
    if(profileTabBtn){
      EventBinder._switchProfileTab(profileTabBtn.dataset.profileTab);
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
      const state = StateManager._state;
      const historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      const backtestData = ZodiacPrediction.runSizeBacktest(historyData, 15);

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
      const state = StateManager._state;
      const historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      const backtestData = ZodiacPrediction.runOddEvenBacktest(historyData, 15);

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
      const state = StateManager._state;
      const historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      const backtestData = ZodiacPrediction.runWuxingBacktest(historyData, 15);

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
      const state = StateManager._state;
      const historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 10) {
        Toast.show('数据不足（需至少10期，当前仅' + historyData.length + '期）');
        return;
      }

      const backtestData = ZodiacPrediction.runColorBacktest(historyData, 12);
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
      const state = StateManager._state;
      const historyData = state.analysis.historyData;

      if (!historyData || !historyData.length) {
        Toast.show('暂无历史数据');
        return;
      }

      if (historyData.length < 25) {
        Toast.show('数据不足（需至少25期，当前仅' + historyData.length + '期）');
        return;
      }

      const backtestData = ZodiacPrediction.runFinalZodiacBacktest(historyData, 36);
      if (!backtestData) {
        Toast.show('回测执行失败，请重试');
        return;
      }

      // 新增：获取下期预测号码（与精选特码显示一致）+ 下期号（基于最新一期 + 1）
      var nextPredictText = '';
      var nextExpect = 0;
      try {
        if (historyData[0] && historyData[0].expect) {
          nextExpect = Number(historyData[0].expect) + 1;
        }
        var zodiacData = Business.calcZodiacAnalysis();
        if (zodiacData) {
          nextPredictText = Business.renderZodiacFinalNums(zodiacData);
        }
      } catch(_e) { /* 预测获取失败不影响回测弹窗展示 */ }

      ViewAnalysis.showFinalBacktestModal(backtestData, nextPredictText, nextExpect);
    } catch (e) {
      console.error('精选六肖回测出错:', e);
      Toast.show('回测计算出错，请重试');
    }
  },

  /**
   * 我的页面标签切换（委托 ViewProfile 渲染）
   * @param {string} tab - 标签名称：mine / official / phoenix / daxian / max
   */
  _switchProfileTab: function(tab) {
    // 委托视图层渲染（与 ViewProfile.switchProfileTabUI 行为一致）
    if (typeof ViewProfile !== 'undefined' && ViewProfile.switchProfileTabUI) {
      ViewProfile.switchProfileTabUI(tab);
    }
    // 2026-07-04 适配：原"使用说明"卡片已随空 card 一起移除，不再注入
    // 保留书签管理卡片的注入（由 ViewProfile.switchProfileTabUI 内部触发）
    // 记录『我的』页面当前子 tab（用于再次进入『我的』时恢复）
    Storage.saveLastTab('profile', tab);
    // 懒加载iframe
    if (tab === 'official') {
      const officialFrame = document.getElementById('officialFrame');
      const officialLoading = document.getElementById('officialLoading');
      if (officialFrame && !officialFrame.src) {
        officialFrame.src = 'https://sjz-xl2.09567k.app:7022/#dh2/';
        officialFrame.style.display = 'block';
        officialLoading.style.display = 'none';
      }
    } else if (tab === 'phoenix') {
      const phoenixFrame = document.getElementById('phoenixFrame');
      const phoenixLoading = document.getElementById('phoenixLoading');
      if (phoenixFrame && !phoenixFrame.src) {
        phoenixFrame.src = 'https://176744.com';
        phoenixFrame.style.display = 'block';
        phoenixLoading.style.display = 'none';
      }
    } else if (tab === 'daxian') {
      const daxianFrame = document.getElementById('daxianFrame');
      const daxianLoading = document.getElementById('daxianLoading');
      if (daxianFrame && !daxianFrame.src) {
        daxianFrame.src = 'https://rk3lx78d.66660149m.app:2026/66660149.app#66660149://01492026.com';
        daxianFrame.style.display = 'block';
        daxianLoading.style.display = 'none';
      }
    } else if (tab === 'max') {
      const maxFrame = document.getElementById('maxFrame');
      const maxLoading = document.getElementById('maxLoading');
      if (maxFrame && !maxFrame.src) {
        maxFrame.src = 'https://15549.rs-k1-gif.lzws0931.com/advice/site.k1/#15549';
        maxFrame.style.display = 'block';
        maxLoading.style.display = 'none';
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
    const wSize = parseInt(freqKey.replace('p', '')) || 12;
    const historyData = StateManager._state.analysis.historyData;
    const zoneChangeData = ZodiacPrediction.calcZoneChangeTracking(historyData, wSize);
    ViewZodiacGiong.renderZoneChangeTracking(zoneChangeData);
  }, 200),

  // ============================================================
  // 2026-07-04 新增：长按检测（个人中心页长按 div 弹出书签菜单）
  // 严格遵守分层规范：
  //   ❌ 禁止渲染代码 → 长按触发后调用 ViewBookmark.showLongPressMenu
  //   ❌ 禁止鼠标事件 → 使用 touchstart/touchmove/touchend
  // ============================================================

  /**
   * 触摸开始：判定是否触发长按检测
   * 架构修复：所有 DOM 查询委托给 ViewBookmark（event.js 禁止获取 DOM 元素）
   * 2026-07-04 更新：resolveLongPressTarget 返回 { kind, el, id?, title? }
   */
  handleTouchStart: function(e) {
    if (typeof ViewBookmark === 'undefined') return;

    // 委托视图层判定目标元素（书签标签或 .card-body）
    const resolved = ViewBookmark.resolveLongPressTarget(e.target);
    if (!resolved || !resolved.el) return;

    const touch = e.touches && e.touches[0];
    if (!touch) return;

    EventBinder._clearLongPress();
    EventBinder._longPressResolved = resolved;
    EventBinder._longPressStartX = touch.clientX;
    EventBinder._longPressStartY = touch.clientY;
    EventBinder._longPressTriggered = false;

    EventBinder._longPressTimer = setTimeout(function() {
      // 二次校验：目标元素必须仍在 DOM 中（委托视图层判断）
      if (!EventBinder._longPressResolved) return;
      if (!ViewBookmark.isElementAttached(EventBinder._longPressResolved.el)) return;

      EventBinder._longPressTriggered = true;
      // 委托视图层触发菜单（按 kind 分发：'add' 显示输入网址；'bookmark' 显示删除）
      ViewBookmark.triggerLongPressMenu(EventBinder._longPressResolved);

      // 触觉反馈（如果可用）
      if (navigator.vibrate) {
        try { navigator.vibrate(15); } catch (_) {}
      }
    }, EventBinder.LONG_PRESS_DURATION);
  },

  /**
   * 触摸移动：超过容差取消长按（避免误触）
   */
  handleTouchMove: function(e) {
    if (!EventBinder._longPressTimer) return;
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    const dx = Math.abs(touch.clientX - EventBinder._longPressStartX);
    const dy = Math.abs(touch.clientY - EventBinder._longPressStartY);
    if (dx > EventBinder.LONG_PRESS_MOVE_TOLERANCE || dy > EventBinder.LONG_PRESS_MOVE_TOLERANCE) {
      EventBinder._clearLongPress();
    }
  },

  /**
   * 触摸结束/取消：清理长按定时器
   */
  handleTouchEnd: function() {
    EventBinder._clearLongPress();
  },

  /**
   * 清理长按定时器与状态
   */
  _clearLongPress: function() {
    if (EventBinder._longPressTimer) {
      clearTimeout(EventBinder._longPressTimer);
      EventBinder._longPressTimer = null;
    }
  }
};
