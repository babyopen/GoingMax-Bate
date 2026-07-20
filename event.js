const EventBinder = {
  // ============================================================
  // 2026-07-21 变更：标签由"双击锁定"改为"长按锁定"
  // 删除自定义双击检测状态（_lastTagClick / _tagDblClickGuardUntil）
  // 改用统一的长按定时器实现
  // ============================================================

  // ============================================================
  // 2026-07-04 新增：长按检测状态（个人中心页长按 div 弹出书签菜单）
  // 2026-07-21 扩展：长按 .tag 触发锁定/解锁
  // ============================================================
  _longPressTimer: null,
  _longPressResolved: null, // { kind, el, id?, title? }
  _longPressStartX: 0,
  _longPressStartY: 0,
  _longPressTriggered: false,
  // 2026-07-21 优化：触屏笔记本同时发 touchstart + mousedown 时避免双重启动 timer
  // 计数 > 0 表示已有 touch 在握持中，mousedown 应忽略
  _touchActiveCount: 0,
  // 长按命中后 500ms 内不再触发 click（避免长按抬起触发单击选中）
  _longPressClickGuardUntil: 0,
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
    // 2026-07-21 变更：标签由"双击锁定"改为"长按锁定"，不再监听 dblclick
    // 保留 dblclick 委托用于标记按钮清除标记（handleDoubleClick 中处理）
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
    // 2026-07-21 新增：桌面浏览器 mousedown/mouseup 长按路径
    // 原因：macOS 桌面浏览器不触发 touchstart，调试/桌面用户也必须能用"按住"锁定
    // 注：未使用 mouseover/mouseenter/mouseleave/hover（项目规范禁用）
    document.addEventListener('mousedown', EventBinder.handleMouseDown);
    document.addEventListener('mouseup', EventBinder.handleMouseUp);
    // 兜底：mousemove 超容差即视为离开（与 touchmove 一致）
    document.addEventListener('mousemove', EventBinder.handleMouseMove);
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
   * 全局双击处理（标记按钮清除标记）
   * 2026-07-21 变更：标签双击锁定/解锁改为长按（见 handleTouchStart），此处不再处理 .tag
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
    // 标签双击锁定/解锁已迁移到长按（见 handleTouchStart），此处不处理
  },

  /**
   * 全局点击处理
   * @param {MouseEvent} e - 点击事件
   */
  handleGlobalClick: (e) => {
    const target = e.target;

    // 1. 筛选标签点击
    // 2026-07-21 变更：标签锁定/解锁由双击改为长按，此处只处理单击选中
    const tag = target.closest('.tag[data-group]');
    if(tag){
      // 长按保护窗：长按命中后 500ms 内不再响应 click，避免长按抬起触发选中
      if (Date.now() < EventBinder._longPressClickGuardUntil) {
        return;
      }
      const group = tag.dataset.group;
      const value = Utils.formatTagValue(tag.dataset.value, group);
      // 触觉反馈（如果可用）
      if (navigator.vibrate) {
        try { navigator.vibrate(10); } catch (_) {}
      }
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
   * 2026-07-21 扩展：长按 .tag 触发锁定/解锁（替代原双击）
   * 2026-07-21 重构：抽出 _startLongPress 统一入口，桌面 mousedown 复用同一逻辑
   */
  handleTouchStart: function(e) {
    const touch = e.touches && e.touches[0];
    if (!touch) return;
    EventBinder._touchActiveCount++;
    EventBinder._startLongPress(e.target, touch.clientX, touch.clientY);
  },

  /**
   * 触摸移动：超过容差取消长按（避免误触）
   */
  handleTouchMove: function(e) {
    EventBinder._maybeCancelLongPress(e.touches && e.touches[0]);
  },

  /**
   * 触摸结束/取消：清理长按定时器
   * 2026-07-21 优化：减计数（用于触屏笔记本双发场景）
   */
  handleTouchEnd: function() {
    if (EventBinder._touchActiveCount > 0) EventBinder._touchActiveCount--;
    EventBinder._clearLongPress();
  },

  /**
   * 鼠标按下：桌面浏览器长按路径（2026-07-21 新增）
   * 2026-07-21 优化：触屏笔记本同时发 touchstart + mousedown 时跳过 mousedown，避免双 timer 冲突
   */
  handleMouseDown: function(e) {
    if (e.button !== undefined && e.button !== 0) return; // 仅左键
    if (EventBinder._touchActiveCount > 0) return; // 触屏已在握持中，忽略鼠标事件
    EventBinder._startLongPress(e.target, e.clientX, e.clientY);
  },

  /**
   * 鼠标松开：清理长按定时器（长按命中由 _startLongPress 内的 timer 自行处理）
   */
  handleMouseUp: function() {
    EventBinder._clearLongPress();
  },

  /**
   * 鼠标移动（仅用于检测拖出原位置）
   * 2026-07-21 新增：避免按在 .tag 上拖到 .tag 外松开后还被判定为长按
   * 注：项目禁用 mouseover/mouseenter/mouseleave/hover，但 mousemove 不在禁用名单
   */
  handleMouseMove: function(e) {
    EventBinder._maybeCancelLongPress({ clientX: e.clientX, clientY: e.clientY });
  },

  /**
   * 统一长按启动入口（触屏/桌面共用）
   * 2026-07-21 新增
   * @param {Element} target - 触发元素
   * @param {number} clientX - 起始 clientX
   * @param {number} clientY - 起始 clientY
   */
  _startLongPress: function(target, clientX, clientY) {
    // 1) 优先判定书签/个人中心长按菜单（保持原有行为）
    let resolved = null;
    if (typeof ViewBookmark !== 'undefined') {
      resolved = ViewBookmark.resolveLongPressTarget(target);
    }

    // 2) 其次判定筛选标签长按锁定（2026-07-21 新增）
    //    与 handleGlobalClick 中 .tag 单击选中互不冲突：
    //    - 长按命中后通过 _longPressClickGuardUntil 保护窗跳过后续 click
    //    - 短按（未到 600ms 抬起）走原单击选中逻辑
    const tag = target && typeof target.closest === 'function'
      ? target.closest('.tag[data-group]')
      : null;
    if (tag && (!resolved || !resolved.el)) {
      // 不在按钮/输入框内才响应
      if (!target.closest('button, input, textarea, iframe, [data-no-longpress]')) {
        const group = tag.dataset.group;
        const value = Utils.formatTagValue(tag.dataset.value, group);
        resolved = { kind: 'tag', el: tag, group: group, value: value };
      }
    }

    if (!resolved || !resolved.el) return;

    EventBinder._clearLongPress();
    EventBinder._longPressResolved = resolved;
    EventBinder._longPressStartX = clientX;
    EventBinder._longPressStartY = clientY;
    EventBinder._longPressTriggered = false;

    EventBinder._longPressTimer = setTimeout(function() {
      // 二次校验：目标元素必须仍在 DOM 中
      if (!EventBinder._longPressResolved) return;
      if (!EventBinder._longPressResolved.el || !document.body.contains(EventBinder._longPressResolved.el)) return;

      EventBinder._longPressTriggered = true;

      // 按 kind 分发：书签/面板 → ViewBookmark；标签 → toggleTagLock
      const r = EventBinder._longPressResolved;
      // 触觉反馈（统一处理）
      if (navigator.vibrate) {
        try {
          navigator.vibrate(r.kind === 'tag' ? [10, 30, 10] : 15);
        } catch (_) {}
      }
      if (r.kind === 'tag') {
        StateManager.toggleTagLock(r.group, r.value);
      } else if (typeof ViewBookmark !== 'undefined') {
        ViewBookmark.triggerLongPressMenu(r);
      }
      // 设置 500ms 保护窗：期间内 click 处理跳过选中，避免长按抬起后触发选中
      EventBinder._longPressClickGuardUntil = Date.now() + 500;
    }, EventBinder.LONG_PRESS_DURATION);
  },

  /**
   * 移动检测（touch/mouse 共用）：超过容差取消长按
   */
  _maybeCancelLongPress: function(point) {
    if (!EventBinder._longPressTimer) return;
    if (!point) return;
    const dx = Math.abs(point.clientX - EventBinder._longPressStartX);
    const dy = Math.abs(point.clientY - EventBinder._longPressStartY);
    if (dx > EventBinder.LONG_PRESS_MOVE_TOLERANCE || dy > EventBinder.LONG_PRESS_MOVE_TOLERANCE) {
      EventBinder._clearLongPress();
    }
  },

  /**
   * 清理长按定时器与状态
   * 2026-07-21 优化：清理 _longPressResolved 等引用，避免悬空旧节点引用
   */
  _clearLongPress: function() {
    if (EventBinder._longPressTimer) {
      clearTimeout(EventBinder._longPressTimer);
      EventBinder._longPressTimer = null;
    }
    EventBinder._longPressResolved = null;
    EventBinder._longPressStartX = 0;
    EventBinder._longPressStartY = 0;
    EventBinder._longPressTriggered = false;
  }
};
