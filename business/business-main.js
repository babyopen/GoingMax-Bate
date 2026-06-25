// v2.0.9 新增：requestIdleCallback polyfill + 业务层工具
// 原因：业务层 initGiongTab / initUltimateAlgorithm 中用 setTimeout(100/150ms) 推迟回测渲染，
//       这些 setTimeout 会在用户进入资料页时立即触发，与滚动争抢主线程。
//       改用 requestIdleCallback：浏览器空闲时才执行，用户滚动时不会被打断。
//       兼容：Safari 16.4 之前不支持，回退到 setTimeout(150ms)（行为与原来一致）
const _requestIdleCallback = window.requestIdleCallback || function(fn) {
  return setTimeout(function() {
    var start = Date.now();
    fn({
      didTimeout: false,
      timeRemaining: function() { return Math.max(0, 50 - (Date.now() - start)); }
    });
  }, 150);
};
const _cancelIdleCallback = window.cancelIdleCallback || function(id) {
  clearTimeout(id);
};
// 业务层专用：在资料页初始化时调度的回测/重计算，统一走空闲回调
// 用法：Business._scheduleIdle(workFn) 返回一个可取消的 id
const _scheduleIdle = function(workFn) {
  return _requestIdleCallback(workFn, { timeout: 500 });
};

const Business = {
  // ====================== 排除号码相关 ======================
  /**
   * 切换号码排除状态
   * @param {number} num - 号码
   */
  toggleExclude: (num) => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];

    if(newExcluded.includes(num)){
      newHistory.push([num, 'out']);
      const index = newExcluded.indexOf(num);
      newExcluded.splice(index, 1);
    } else {
      newHistory.push([num, 'in']);
      newExcluded.push(num);
    }

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
  },

  /**
   * 反选排除号码（已排除的恢复，未排除的排除）
   */
  invertExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    const allNums = Array.from({length: 49}, (_, i) => i + 1);
    const newExcluded = [];
    const newHistory = [...state.excludeHistory];

    allNums.forEach(num => {
      const isCurrentlyExcluded = state.excluded.includes(num);
      if(!isCurrentlyExcluded){
        // 当前未排除的，现在排除
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      } else {
        // 当前已排除的，现在恢复
        newHistory.push([num, 'out']);
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    Toast.show(`已反选，当前排除 ${newExcluded.length} 个号码`);
  },

  /**
   * 撤销上一次排除操作
   */
  undoExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude || !state.excludeHistory.length) return;

    const newHistory = [...state.excludeHistory];
    const [num, act] = newHistory.pop();
    const newExcluded = [...state.excluded];

    act === 'in' 
      ? newExcluded.splice(newExcluded.indexOf(num), 1)
      : newExcluded.push(num);

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
  },

  /**
   * 清空所有排除号码
   */
  clearExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;
    StateManager.setState({ excluded: [], excludeHistory: [] });
    Toast.show('已清空所有排除号码');
  },

  /**
   * 切换排除锁定状态
   */
  toggleExcludeLock: () => {
    const isLocked = DOM.lockExclude.checked;
    StateManager.setState({ lockExclude: isLocked }, false);
    Toast.show(isLocked ? '已锁定排除号码' : '已解锁排除号码');
  },

  // ====================== 方案管理相关 ======================
  /**
   * 提交保存的新方案：持久化 + 渲染 + 智能重命名提示
   * @param {Object} filterItem - 完整方案对象
   * @param {string} rawName - 用户输入的原始名
   * @param {string} filterName - 去重后的最终名
   * @param {string} toastPrefix - Toast 文案前缀（如：保存成功 / 已保存生肖方案（5肖））
   */
  _commitSaveFilter: (filterItem, rawName, filterName, toastPrefix) => {
    const success = Storage.saveFilter(filterItem);
    if(!success) return;
    Render.renderFilterList();
    // 2026-06-25 修复：保存方案时同步到当前激活分组的快照，避免刷新页面后被
    //   applyGroupSnapshot(target) 覆盖为分组内旧快照导致方案"消失"。
    //   之前实现仅写入全局 SAVED_FILTERS，分组快照从不感知 savedFilters 变化。
    Business._syncFilterToActiveGroup(filterItem);
    if(filterName !== rawName){
      Toast.show(`${toastPrefix}（重名自动调整为：${filterName}）`);
    } else {
      Toast.show(toastPrefix);
    }
  },

  /**
   * 同步当前保存的方案到激活分组的快照（2026-06-25 新增）
   * 解决问题：用户保存方案后，刷新页面时被 FilterGroup.applyGroupSnapshot
   *   覆盖回分组创建时的旧快照，导致新保存的方案"消失"。
   * 设计原则：
   *   - 仅在 currentGroupId 存在时生效（未启用分组场景无副作用）
   *   - 在副本上修改再 setState，避免直接污染 s.filterGroups（防御性编程）
   *   - 调用 FilterGroup._persistGroups() 持久化到 localStorage
   * @param {Object} filterItem - 已保存的方案对象
   */
  _syncFilterToActiveGroup: (filterItem) => {
    try {
      const s = StateManager._state;
      if(!s.currentGroupId) return; // 未启用分组，无须同步
      const list = (s.filterGroups || []).slice();
      const idx = list.findIndex(g => g && g.id === s.currentGroupId);
      if(idx < 0) return;
      // 在副本上修改，避免直接污染 s.filterGroups
      const existed = Array.isArray(list[idx].savedFilters) ? list[idx].savedFilters : [];
      list[idx] = Object.assign({}, list[idx], {
        savedFilters: [Utils.deepClone(filterItem)].concat(existed)
      });
      StateManager.setState({ filterGroups: list }, false);
      // 委托 FilterGroup 持久化（保持分层：业务层 FilterGroup 拥有分组存储细节）
      if(typeof Business !== 'undefined' && Business.FilterGroup && typeof Business.FilterGroup._persistGroups === 'function'){
        Business.FilterGroup._persistGroups();
      }
    } catch(e) {
      // 仅记录错误，不影响主流程（保存方案已经成功）
      try { console.error('[Business._syncFilterToActiveGroup] 同步方案到分组失败:', e); } catch(_) {}
    }
  },

  /**
   * 保存方案弹窗
   */
  saveFilterPrompt: () => {
    const state = StateManager._state;
    if(state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    // P1-3: 默认名用"最大编号+1"避免与现存方案冲突
    const defaultName = Utils.nextDefaultName(state.savedFilters);
    GIONGBETA_INPUT_MODAL.show('请输入方案名称', '请输入方案名称', defaultName, (name) => {
      if(name === null) return;
      const rawName = (name.trim() || defaultName).slice(0, 20); // P1-2: 输入超长截断
      // P1-1: 智能去重（已存在同名则自动追加 " (2)" 后缀）
      const filterName = Utils.ensureUniqueName(rawName, state.savedFilters);
      const filterItem = {
        name: filterName,
        selected: Utils.deepClone(state.selected),
        excluded: Utils.deepClone(state.excluded),
        locked: Utils.deepClone(state.locked),
        lockedScheme: false
      };
      Business._commitSaveFilter(filterItem, rawName, filterName, '保存成功');
    });
  },

  /**
   * 保存生肖方案弹窗
   * 仅保存生肖卡片内的已选生肖 + 已锁定生肖 + 已标记生肖，其他筛选条件不保存
   */
  saveZodiacFilterPrompt: () => {
    const state = StateManager._state;
    if(state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    const selectedZodiacs = (state.selected && state.selected.zodiac) ? state.selected.zodiac : [];
    const lockedZodiacs = (state.locked && state.locked.zodiac) ? state.locked.zodiac : [];
    const markedMap = (state.marked && state.marked.zodiac) ? state.marked.zodiac : {};
    if(selectedZodiacs.length === 0 && lockedZodiacs.length === 0 && Object.keys(markedMap).length === 0){
      Toast.show('请先选择、标记或锁定生肖');
      return;
    }

    // 默认名带"生肖方案"前缀
    const count = selectedZodiacs.length + lockedZodiacs.length + Object.keys(markedMap).length;
    const defaultName = Utils.nextDefaultName(state.savedFilters, '生肖方案');
    GIONGBETA_INPUT_MODAL.show('请输入生肖方案名称', '请输入生肖方案名称', defaultName, (name) => {
      if(name === null) return;
      const rawName = (name.trim() || defaultName).slice(0, 20);
      const filterName = Utils.ensureUniqueName(rawName, state.savedFilters);
      // 仅保存 zodiac 维度的选择 / 锁定 / 标记，其他字段保持空
      const filterItem = {
        name: filterName,
        selected: { zodiac: Utils.deepClone(selectedZodiacs) },
        excluded: [],
        locked: lockedZodiacs.length > 0 ? { zodiac: Utils.deepClone(lockedZodiacs) } : {},
        marked: Object.keys(markedMap).length > 0 ? { zodiac: Utils.deepClone(markedMap) } : {},
        // 标记为生肖方案，便于加载时识别
        scope: 'zodiac',
        // 锁定方案标记（默认未锁定，避免与 state.locked 字段混淆）
        lockedScheme: false
      };
      Business._commitSaveFilter(filterItem, rawName, filterName, `已保存生肖方案（${count}肖）`);
    });
  },

  /**
   * 加载保存的方案
   * 普通方案：完整覆盖 selected/excluded/locked/marked/markCount
   * 生肖方案（scope='zodiac'）：仅合并 zodiac 维度的 selected/locked/marked，不影响其他卡片
   * @param {number} index - 方案索引
   */
  loadFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    if(item.scope === 'zodiac') {
      // 校验：生肖方案为空（已选/已锁/已标记都没有生肖数据）时拒绝加载，避免误清空当前选中
      const selectedZodiacs = (item.selected && item.selected.zodiac) || [];
      const lockedZodiacs = (item.locked && item.locked.zodiac) || [];
      const markedMap = (item.marked && item.marked.zodiac) || {};
      if(selectedZodiacs.length === 0 && lockedZodiacs.length === 0 && Object.keys(markedMap).length === 0){
        Toast.show('该生肖方案为空，无法加载');
        return;
      }

      // 生肖方案：仅更新 zodiac 维度的 selected / locked / marked，其他卡片保留
      const newSelected = { ...state.selected };
      newSelected.zodiac = Utils.deepClone(selectedZodiacs);

      const newLocked = { ...state.locked };
      if(lockedZodiacs.length > 0) {
        newLocked.zodiac = Utils.deepClone(lockedZodiacs);
      } else {
        delete newLocked.zodiac;
      }

      const newMarked = { ...state.marked };
      const newMarkCount = { ...state.markCount };
      if(Object.keys(markedMap).length > 0) {
        newMarked.zodiac = Utils.deepClone(markedMap);
        // markCount.zodiac 恢复为该组最大槽位索引 + 1，保证下次 mark 不冲突
        let maxSlot = -1;
        Object.keys(markedMap).forEach(k => {
          const slots = markedMap[k] || [];
          slots.forEach(s => { if(s > maxSlot) maxSlot = s; });
        });
        newMarkCount.zodiac = maxSlot + 1;
      } else {
        delete newMarked.zodiac;
        delete newMarkCount.zodiac;
      }

      StateManager.setState({
        selected: newSelected,
        locked: newLocked,
        marked: newMarked,
        markCount: newMarkCount
      });
      const zodiacCount = (newSelected.zodiac || []).length
        + (newLocked.zodiac || []).length
        + Object.keys(newMarked.zodiac || {}).length;
      Toast.show(`已加载生肖方案（${zodiacCount}肖）`);
    } else {
      // 普通方案：完整覆盖（与旧版行为一致）
      const newMarked = Utils.deepClone(item.marked || {});
      const newMarkCount = Utils.deepClone(item.markCount || {});
      // 旧方案可能没有 markCount，从 marked 重建（取每个分组最大槽位 + 1）
      Object.keys(newMarked).forEach(g => {
        if(typeof newMarkCount[g] !== 'number') {
          let maxSlot = -1;
          Object.keys(newMarked[g] || {}).forEach(k => {
            (newMarked[g][k] || []).forEach(s => { if(s > maxSlot) maxSlot = s; });
          });
          newMarkCount[g] = maxSlot + 1;
        }
      });
      StateManager.setState({
        selected: Utils.deepClone(item.selected),
        excluded: Utils.deepClone(item.excluded),
        locked: Utils.deepClone(item.locked || {}),
        marked: newMarked,
        markCount: newMarkCount
      });
      Toast.show('加载成功');
    }
  },

  /**
   * 复制终极推荐生肖（主推 + 备选，事件层传入已拼接的字符串）
   * @param {string} zodiacStr - 已拼接好的生肖字符串（如 "主推：xx xx 备选：xx xx"）
   */
  copyMainZodiacs: (zodiacStr) => {
    if(!zodiacStr) return;
    CommonPlatform.copyToClipboard(zodiacStr, {
      fallback: (text) => {
        GIONGBETA_INPUT_MODAL.show('复制生肖', '点击选中并复制', text, () => {});
      }
    });
  },

  /**
   * 复制主页生肖筛选已选生肖（按12生肖顺序拼接，空格分隔）
   * 数据源：StateManager._state.selected.zodiac
   */
  copySelectedZodiacs: () => {
    const state = StateManager._state;
    const selected = (state.selected && state.selected.zodiac) ? state.selected.zodiac : [];
    if(!selected || selected.length === 0){
      Toast.show('暂未选择生肖');
      return;
    }
    // 2026-06-21 通用化：复用 Utils.formatZodiacList（按12生肖固定顺序拼接）
    const zodiacStr = Utils.formatZodiacList(selected, ' ');
    Business.copyMainZodiacs(zodiacStr);
  },

  /**
   * 复制方案号码 / 生肖
   * 普通方案：复制筛选出的号码
   * 生肖方案（scope='zodiac'）：只复制已选生肖（按 12 生肖顺序拼接，空格分隔）
   * @param {number} index - 方案索引
   */
  copyFilterNums: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    // 生肖方案：仅复制"已选"生肖，不复制已锁/已标记
    if(item.scope === 'zodiac') {
      const selected = (item.selected && item.selected.zodiac) || [];
      if(selected.length === 0){
        Toast.show('该生肖方案暂无已选生肖');
        return;
      }
      // 2026-06-21 通用化：复用 Utils.formatZodiacList
      const zodiacStr = Utils.formatZodiacList(selected, ' ');
      CommonPlatform.copyToClipboard(zodiacStr, {
        successMsg: '复制成功',
        fallback: (text) => {
          GIONGBETA_INPUT_MODAL.show('复制生肖', '点击选中并复制', text, () => {});
        }
      });
      return;
    }

    // 修复复制一致性：使用方案自带的 locked，避免受当前 state.locked 影响
    const list = Filter.getFilteredList(item.selected, item.excluded, item.locked || {});
    if(list.length === 0){
      // P2-1: 空态提示更详细（让用户知道为什么没有号码）
      const excludedCount = (item.excluded || []).length;
      if(excludedCount >= 49){
        Toast.show('该方案全部号码均已排除');
      } else if(excludedCount > 0){
        Toast.show(`该方案无符合条件的号码（已排除${excludedCount}个）`);
      } else {
        Toast.show('该方案筛选条件下无号码');
      }
      return;
    }

    const numStr = list.map(n => n.s).join(' ');
    CommonPlatform.copyToClipboard(numStr, {
      successMsg: '复制成功',
      fallback: (text) => {
        GIONGBETA_INPUT_MODAL.show('复制号码', '点击选中并复制', text, () => {});
      }
    });
  },

  /**
   * 重命名方案
   * @param {number} index - 方案索引
   */
  renameFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    GIONGBETA_INPUT_MODAL.show('修改方案名称', '请输入新名称', item.name, (newName) => {
      if(newName === null || newName.trim() === "") return;
      const rawName = newName.trim().slice(0, 20); // P1-2: 输入超长截断
      const newList = [...state.savedFilters];
      // P1-1: 重命名去重（排除自身）
      const finalName = Utils.ensureUniqueName(rawName, newList, index);
      newList[index].name = finalName;
      const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      if(success){
        StateManager.setState({ savedFilters: newList }, false);
        Render.renderFilterList();
        if(finalName !== rawName){
          Toast.show(`已重命名（重名自动调整为：${finalName}）`);
        } else {
          Toast.show('重命名成功');
        }
      }
    });
  },

  /**
   * 置顶方案
   * @param {number} index - 方案索引
   */
  topFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const newList = [...state.savedFilters];
    newList.splice(index, 1);
    newList.unshift(item);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
      Render.renderFilterList();
      Toast.show('置顶成功');
    }
  },

  /**
   * 删除方案
   * @param {number} index - 方案索引
   */
  deleteFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    // 2026-06-20 用户需求：方案被锁定时不允许删除（与 clearAllSavedFilters 保留锁定方案的语义一致）
    if(item && item.lockedScheme){
      Toast.show('方案已锁定，请先解锁后再删除');
      return;
    }

    const doDelete = () => {
      const newList = [...StateManager._state.savedFilters];
      newList.splice(index, 1);
      const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      if(success){
        StateManager.setState({ savedFilters: newList }, false);
        Render.renderFilterList();
        Toast.show('删除成功');
      }
    };

    GIONGBETA_CONFIRM_MODAL.show('确定删除该方案？', (result) => {
      if(result) doDelete();
    });
  },

  /**
   * 清空所有方案（锁定方案会被保留）
   */
  clearAllSavedFilters: () => {
    const state = StateManager._state;
    const lockedCount = state.savedFilters.filter(i => i.lockedScheme).length;
    const confirmText = lockedCount > 0
      ? `确定清空未锁定的方案？将保留${lockedCount}个锁定方案`
      : '确定清空所有方案？';

    const doClear = () => {
      const unlocked = state.savedFilters.filter(item => !item.lockedScheme);
      if(unlocked.length === state.savedFilters.length){
        // 没有锁定项：走原清空逻辑
        Storage.remove(Storage.KEYS.SAVED_FILTERS);
        StateManager.setState({ savedFilters: [] }, false);
        Render.renderFilterList();
        Toast.show('已清空所有方案');
      } else if(unlocked.length === 0){
        // 全部都被锁定
        Toast.show('所有方案都已锁定，无法清空');
      } else {
        const success = Storage.set(Storage.KEYS.SAVED_FILTERS, unlocked);
        if(success){
          StateManager.setState({ savedFilters: unlocked }, false);
          Render.renderFilterList();
          Toast.show(`已清空（${lockedCount}个锁定方案保留）`);
        }
      }
    };

    GIONGBETA_CONFIRM_MODAL.show(confirmText, (result) => {
      if(result) doClear();
    });
  },

  /**
   * 切换方案锁定状态（锁定后不被"清空全部"影响）
   * 状态使用独立字段 lockedScheme，避免与方案保存的分组锁定标签 item.locked 混淆
   * @param {number} index - 方案索引
   */
  toggleLockFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const newList = [...state.savedFilters];
    newList[index] = { ...item, lockedScheme: !item.lockedScheme };
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
      Render.renderFilterList();
      Toast.show(newList[index].lockedScheme ? '已锁定方案' : '已解锁方案');
    }
  },

  /**
   * 切换方案列表展开/收起
   */
  toggleShowAllFilters: () => {
    const state = StateManager._state;
    StateManager.setState({ showAllFilters: !state.showAllFilters }, false);
    Render.renderFilterList();
  },

  // ====================== 重叠号码相关 ======================
  /**
   * 计算所有保存方案中的重叠号码
   * @returns {Object} { overlapNums: Array<{num, s, color, zodiac, count: number, schemes: string[]}>, totalSchemes: number }
   */
  calcOverlapNumbers: () => {
    const state = StateManager._state;
    const savedFilters = state.savedFilters;
    
    if (!savedFilters || savedFilters.length === 0) {
      return { overlapNums: [], totalSchemes: 0 };
    }

    const numMap = {};
    
    savedFilters.forEach((scheme, index) => {
      // 修复重叠一致性：每个方案使用各自的 locked，互不干扰
      const filteredList = Filter.getFilteredList(scheme.selected, scheme.excluded, scheme.locked || {});
      
      filteredList.forEach(item => {
        const numKey = item.num;
        if (!numMap[numKey]) {
          numMap[numKey] = {
            num: item.num,
            s: item.s,
            color: item.color,
            zodiac: item.zodiac,
            count: 0,
            schemes: []
          };
        }
        numMap[numKey].count++;
        numMap[numKey].schemes.push(scheme.name);
      });
    });

    const overlapNums = Object.values(numMap)
      .filter(item => item.count > 1)
      .sort((a, b) => b.count - a.count);

    return { overlapNums, totalSchemes: savedFilters.length };
  },

  /**
   * 按重叠次数分组号码（2026-06-21 架构修复）
   * 从 view-overlap-modal.js 抽取到业务层，视图层只负责渲染
   * @param {Array} overlapNums - calcOverlapNumbers() 返回的 overlapNums
   * @returns {Object} { groupedNums: { [count]: Array }, sortedCounts: number[] }
   */
  groupOverlapNums: (overlapNums) => {
    const groupedNums = {};
    overlapNums.forEach(item => {
      const count = item.count;
      if (!groupedNums[count]) groupedNums[count] = [];
      groupedNums[count].push(item);
    });
    const sortedCounts = Object.keys(groupedNums)
      .map(Number)
      .sort((a, b) => b - a);
    return { groupedNums, sortedCounts };
  },

  // ====================== 导航相关（2026-06-13 拆分至 business/business-quick-nav.js）======================
  switchBottomNav: (index) => BusinessQuickNav.handleBottomNavClick(index),

  /**
   * v2.0.9 新增：切换到排除页（独立标签页，入口在主页面快捷导航）
   * 委托给视图层 ViewExclude.render 执行 DOM 操作（业务层禁止 DOM）
   */
  switchExcludePage: () => {
    ViewExclude.render();
  },

  // ============================================================
  // 新增：当前主页临时筛选状态持久化（2026-06-07）
  // 解决问题：主页筛选后切到后台，被系统杀掉进程或刷新页面后丢失未保存的筛选
  // ============================================================
  /**
   * 初始化筛选状态持久化
   *   1) 启动时从 localStorage 恢复（覆盖任何 applyGroupSnapshot 写入的分组旧快照）
   *   2) 注册 setState 钩子：所有状态变更节流（500ms）写入 localStorage
   *   3) 注册 pagehide / visibilitychange 兜底：iOS WebView 切后台时立即 flush
   *
   * 2026-06-25 修复：移除 hasAnyState 闸门
   *   原实现"仅在 state 全空时恢复"会在有分组场景失效——
   *   applyGroupSnapshot 在 initFilterPersistence 之前用分组的"创建/上次切换时"快照
   *   覆盖 state.selected，导致 hasAnyState=true，闸门常闭，currentFilter 永远不被恢复。
   *   修复后：只要 currentFilter 存在就恢复（currentFilter 总是反映 StateManager._state
   *   的最新值，且 setState 钩子保证 500ms 内写入磁盘），保证用户最新筛选状态优先。
   */
  initFilterPersistence: () => {
    // 1) 启动恢复：只要 currentFilter 存在就恢复（覆盖 applyGroupSnapshot 的旧快照）
    const cache = Storage.loadCurrentFilter();
    if(cache){
      const s = StateManager._state;
      // 合并：以默认结构为底，覆盖缓存字段
      const restored = {
        selected: { ...s.selected, ...cache.selected },
        excluded: cache.excluded,
        locked: cache.locked,
        marked: cache.marked,
        markCount: cache.markCount,
        excludeHistory: cache.excludeHistory,
        lockExclude: cache.lockExclude,
        showAllFilters: cache.showAllFilters
      };
      // 使用 needRender=false 避免初始化期重复渲染（Render.renderAll 会在 initApp 末尾被调用）
      StateManager.setState(restored, false);
      // 同步排除锁定复选框
      if(typeof DOM !== 'undefined' && DOM.lockExclude){
        DOM.lockExclude.checked = !!cache.lockExclude;
      }
    }

    // 2) 注册节流持久化钩子（500ms 合并连续点击）
    const persistDebounced = CommonCache.debounce(() => {
      const s = StateManager._state;
      Storage.saveCurrentFilter({
        selected: s.selected,
        excluded: s.excluded,
        locked: s.locked,
        marked: s.marked,
        markCount: s.markCount,
        excludeHistory: s.excludeHistory,
        lockExclude: s.lockExclude,
        showAllFilters: s.showAllFilters
      });
    }, 500);
    StateManager._persistCurrentFilter = persistDebounced;

    // 3) pagehide / visibilitychange 兜底：iOS WebView 切后台时立即 flush
    // v2.0.8 重构：将监听注册上移到 app.js（业务层禁止直接使用 window/document）
    // app.js initApp() 中的 initFilterGroupFlushPersist 已统一注册对应监听器
    const flushPersist = () => {
      try {
        const s = StateManager._state;
        Storage.saveCurrentFilter({
          selected: s.selected,
          excluded: s.excluded,
          locked: s.locked,
          marked: s.marked,
          markCount: s.markCount,
          excludeHistory: s.excludeHistory,
          lockExclude: s.lockExclude,
          showAllFilters: s.showAllFilters
        });
      } catch(_) {}
    };
    // 暴露到全局供 app.js 调用（避免重复定义 flushPersist 逻辑）
    Business._flushCurrentFilter = flushPersist;
  },

  // ====================== 分析页面相关 ======================
  /**
   * 加载历史记录缓存
   */
  loadHistoryCache: () => {
    const cache = Storage.getHistoryCache();
    const currentHistoryData = BusinessCommonData.getHistoryData(StateManager._state);
    const currentLatestExpect = currentHistoryData.length ? Number(currentHistoryData[0].expect || 0) : 0;
    const cacheLatestExpect = cache && cache.data && cache.data.length ? Number(cache.data[0].expect || 0) : 0;

    if(cache && cache.data && cache.data.length > 0 && cacheLatestExpect > currentLatestExpect) {
      const newAnalysis = {
        ...StateManager._state.analysis,
        historyData: cache.data,
        historyTimestamp: cache.timestamp || 0
      };
      StateManager.setState({ analysis: newAnalysis }, false);
      Business.renderLatest(cache.data[0]);
      Business.renderHistory();
      Business.renderFullAnalysis();
      Business.renderZodiacAnalysis();
      Business.renderZodiacPrediction();
      Business.initZodiacBacktest();
      Business.initGiongTab();
      // 2026-06-20 修复：缓存加载后同步刷新 TongJi 标签页
      //   解决：首次切到 TongJi 时数据为空 → render(null) → 之后加载数据但 TongJi 不刷新
      if (typeof Business.initTongJiTab === 'function') {
        Business.initTongJiTab();
      }
      ViewAnalysis.updateLoadMoreBtn(
        BusinessCommonData.getHistoryData(StateManager._state).length > StateManager._state.analysis.showCount
      );
    }
  },

  /**
   * 初始化分析页面
   */
  initAnalysisPage: () => {
    Business.loadHistoryCache();
    const state = StateManager._state;
    if(BusinessCommonData.getHistoryData(state).length === 0) {
      Business.refreshHistory();
    }
    Business.startCountdown();
    Business.startAutoRefresh();
  },

  /**
   * 刷新历史数据
   * @param {boolean} silentUpdate - 是否静默更新（不显示loading）
   */
  refreshHistory: async (silentUpdate = false) => {
    const state = StateManager._state;
    const cache = Storage.getHistoryCache();
    const cacheLatestExpect = cache && cache.data && cache.data.length ? Number(cache.data[0].expect || 0) : 0;
    const currentHistoryData = BusinessCommonData.getHistoryData(state);
    const currentLatestExpect = currentHistoryData.length ? Number(currentHistoryData[0].expect || 0) : 0;

    if(!silentUpdate) ViewAnalysis.showHistoryLoading();

    try {
      const year = new Date().getFullYear();
      // 网络请求超时控制（弱网环境避免无限等待）
      const abortController = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      const timeoutId = abortController ? setTimeout(() => abortController.abort(), 10000) : null;
      const res = await fetch(CONFIG.API.HISTORY + year, abortController ? { signal: abortController.signal } : {});
      if(timeoutId) clearTimeout(timeoutId);
      const data = await res.json();
      let rawData = data.data || [];

      rawData = rawData.filter(item => {
        const expect = item.expect || '';
        const openCode = item.openCode || '';
        return expect && openCode && openCode.split(',').length === 7;
      });

      const uniqueMap = new Map();
      rawData.forEach(item => {
        const expectNum = Number(item.expect || 0);
        if(expectNum && !isNaN(expectNum)) {
          uniqueMap.set(expectNum, item);
        }
      });

      const sortedData = Array.from(uniqueMap.values()).sort((a, b) => {
        return Number(b.expect || 0) - Number(a.expect || 0);
      });

      const newLatestExpect = sortedData.length ? Number(sortedData[0].expect || 0) : 0;
      if(newLatestExpect > currentLatestExpect) {
        const now = Date.now();
        Storage.saveHistoryCache(sortedData);
        const newAnalysis = {
          ...StateManager._state.analysis,
          historyData: sortedData,
          historyTimestamp: now
        };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        const latestItem = sortedData[0];
        if(latestItem) Business.renderLatest(latestItem);
        Business.renderHistory();
        Business.renderFullAnalysis();
        Business.renderZodiacAnalysis();
        if(!silentUpdate) Toast.show('数据加载成功');
      } else if(cacheLatestExpect > currentLatestExpect) {
        const newAnalysis = {
          ...state.analysis,
          historyData: cache.data,
          historyTimestamp: cache.timestamp || 0
        };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        const latestItem2 = cache.data[0];
        if(latestItem2) Business.renderLatest(latestItem2);
        Business.renderHistory();
        Business.renderFullAnalysis();
        Business.renderZodiacAnalysis();
        if(!silentUpdate) Toast.show('已加载缓存最新数据');
      } else {
        if(!silentUpdate) Toast.show('已是最新数据');
      }
    } catch(e) {
      if(cacheLatestExpect > currentLatestExpect) {
        const newAnalysis = { ...state.analysis, historyData: cache.data };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        const latestItem3 = cache.data[0];
        if(latestItem3) Business.renderLatest(latestItem3);
        Business.renderHistory();
        Business.renderFullAnalysis();
        Business.renderZodiacAnalysis();
        if(!silentUpdate) Toast.show('使用缓存数据（网络不可用）');
      } else {
        if(!silentUpdate) {
          ViewAnalysis.showHistoryError();
          Toast.show('数据加载失败');
        }
      }
    }

    ViewAnalysis.updateLoadMoreBtn(
      BusinessCommonData.getHistoryData(StateManager._state).length > StateManager._state.analysis.showCount
    );
  },

  /**
   * 获取特码信息
   * @param {Object} item - 历史数据项
   * @returns {Object} 特码信息
   */
  /**
   * 获取特码信息
   * 兼容路径：getSpecial 包装层已删除（2026-06-05 重构，统一使用 Utils.SpecialCalculator.getSpecial）
   * 旧包装层为 (item) => Utils.SpecialCalculator.getSpecial(item)，无逻辑增值
   * 现调用方全部直接使用 Utils.SpecialCalculator.getSpecial(item)
   * （business-main.js 内部 10 处调用已统一替换）
   */

  /**
   * 获取五行
   * @param {number} n - 号码
   * @returns {string} 五行
   */
  getColor: (n) => {
    const colorName = Utils.getColorName(n);
    return CONFIG.COLOR_NAME_TO_EN[colorName] || 'red';
  },

  getColorName: (n) => {
    return Utils.getColorName(n);
  },

  getWuxing: (n) => {
    return Utils.getWuxing(n);
  },

  /**
   * 获取生肖等级
   * @param {number} count - 出现次数
   * @param {number} miss - 遗漏期数
   * @param {number} total - 总期数
   * @returns {Object} 等级信息
   */
  getZodiacLevel: (count, miss, total) => {
    const avgCount = total / 12;
    if(count >= avgCount * 1.5 && miss <= 3) return { cls: 'hot', text: '热' };
    if(count <= avgCount * 0.5 || miss >= 8) return { cls: 'cold', text: '冷' };
    return { cls: 'warm', text: '温' };
  },

  /**
   * 渲染最新开奖
   * @param {Object} item - 最新数据项
   */
  renderLatest: (item) => {
    if(!item) return;
    // 2026-06-21 通用化：复用 Utils.parseCodeArr
    const codeArr = Utils.parseCodeArr(item);
    const s = BusinessCommonSpecials.getOne(item);
    const zodArr = s.fullZodArr;

    let html = '';
    for(let i = 0; i < 6; i++) {
      const num = Number(codeArr[i]);
      html += Business.buildBall(codeArr[i], Business.getColor(num), zodArr[i]);
    }
    html += '<div class="ball-sep">+</div>' + Business.buildBall(codeArr[6], s.wave, zodArr[6]);

    ViewAnalysis.renderLatest({ ballsHtml: html, expect: item.expect || '--' });
  },

  /**
   * 构建球元素
   * @param {string} num - 号码
   * @param {string} color - 颜色
   * @param {string} zodiac - 生肖
   * @returns {string} HTML字符串
   */
  buildBall: (num, color, zodiac) => {
    return `
    <div class="ball-item">
      <div class="ball ${color}">${num}</div>
      <div class="ball-zodiac">${zodiac}</div>
    </div>`;
  },

  /**
   * 渲染历史记录
   */
  renderHistory: () => {
    const state = StateManager._state;
    const list = BusinessCommonData.getHistoryData(state).slice(0, state.analysis.showCount);

    if(!list.length) {
      ViewAnalysis.renderHistory({ isEmpty: true });
      return;
    }

    const historyHtml = list.map(item => {
      // 2026-06-21 通用化：复用 Utils.parseCodeArr
      const codeArr = Utils.parseCodeArr(item);
      const waveArr = (item.wave || 'red,red,red,red,red,red,red').split(',');
      const s = BusinessCommonSpecials.getOne(item);
      const zodArr = s.fullZodArr;
      let balls = '';
      for(let i = 0; i < 6; i++) balls += Business.buildBall(codeArr[i], waveArr[i], zodArr[i]);
      balls += '<div class="ball-sep">+</div>' + Business.buildBall(codeArr[6], waveArr[6], zodArr[6]);
      return '<div class="history-item"><div class="history-expect">第' + (item.expect || '') + '期</div><div class="ball-group">' + balls + '</div></div>';
    }).join('');

    const loadMoreVisible = state.analysis.showCount < BusinessCommonData.getHistoryData(state).length;
    ViewAnalysis.renderHistory({ historyHtml: historyHtml, isEmpty: false, loadMoreVisible: loadMoreVisible });
  },

  /**
   * 计算全维度分析
   * @returns {Object} 分析数据
   */
  calcFullAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    if(!historyData.length) return null;

    const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
    const total = list.length;
    const latestExpect = historyData[0]?.expect || 0;

    const singleDouble = { '单': 0, '双': 0 };
    const bigSmall = { '大': 0, '小': 0 };
    const range = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0 };
    const head = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const tail = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const color = { '红': 0, '蓝': 0, '绿': 0 };
    const wuxing = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    const animal = { '家禽': 0, '野兽': 0 };
    const zodiac = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiac[z] = 0);
    const numCount = {};
    for(let i = 1; i <= 49; i++) numCount[CommonString.formatNum(i)] = 0;

    const lastAppearIdx = {};
    for(let i = 1; i <= 49; i++) lastAppearIdx[i] = -1;
    
    const lastAppearSD = { '单': -1, '双': -1 };
    const lastAppearBS = { '大': -1, '小': -1 };
    const lastAppearRange = { '1-9': -1, '10-19': -1, '20-29': -1, '30-39': -1, '40-49': -1 };
    const lastAppearHead = { 0: -1, 1: -1, 2: -1, 3: -1, 4: -1 };
    const lastAppearTail = { 0: -1, 1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1, 8: -1, 9: -1 };
    const lastAppearColor = { '红': -1, '蓝': -1, '绿': -1 };
    const lastAppearWuxing = { '金': -1, '木': -1, '水': -1, '火': -1, '土': -1 };
    const lastAppearAnimal = { '家禽': -1, '野兽': -1 };
    const lastAppearZod = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => lastAppearZod[z] = -1);

    list.forEach((item, idx) => {
      const s = BusinessCommonSpecials.getOne(item);
      s.odd ? singleDouble['单']++ : singleDouble['双']++;
      s.big ? bigSmall['大']++ : bigSmall['小']++;
      const rangeKey = Utils.getRangeCategory(s.te);
      range[rangeKey]++;
      head[s.head]++;
      tail[s.tail]++;
      color[s.colorName]++;
      wuxing[s.wuxing]++;
      animal[s.animal]++;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zodiac[s.zod]++;
      numCount[CommonString.formatNum(s.te)]++;
      
      if(lastAppearIdx[s.te] === -1) lastAppearIdx[s.te] = idx;
      if(s.odd && lastAppearSD['单'] === -1) lastAppearSD['单'] = idx;
      else if(!s.odd && lastAppearSD['双'] === -1) lastAppearSD['双'] = idx;
      if(s.big && lastAppearBS['大'] === -1) lastAppearBS['大'] = idx;
      else if(!s.big && lastAppearBS['小'] === -1) lastAppearBS['小'] = idx;
      if(lastAppearRange[rangeKey] === -1) lastAppearRange[rangeKey] = idx;
      if(lastAppearHead[s.head] === -1) lastAppearHead[s.head] = idx;
      if(lastAppearTail[s.tail] === -1) lastAppearTail[s.tail] = idx;
      if(lastAppearColor[s.colorName] === -1) lastAppearColor[s.colorName] = idx;
      if(lastAppearWuxing[s.wuxing] === -1) lastAppearWuxing[s.wuxing] = idx;
      if(lastAppearAnimal[s.animal] === -1) lastAppearAnimal[s.animal] = idx;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod) && lastAppearZod[s.zod] === -1) {
        lastAppearZod[s.zod] = idx;
      }
    });

    const sdMiss = { '单': Utils.calcMiss(lastAppearSD['单'], total, latestExpect, list), '双': Utils.calcMiss(lastAppearSD['双'], total, latestExpect, list) };
    const bsMiss = { '大': Utils.calcMiss(lastAppearBS['大'], total, latestExpect, list), '小': Utils.calcMiss(lastAppearBS['小'], total, latestExpect, list) };
    const rangeMiss = {
      '1-9': Utils.calcMiss(lastAppearRange['1-9'], total, latestExpect, list),
      '10-19': Utils.calcMiss(lastAppearRange['10-19'], total, latestExpect, list),
      '20-29': Utils.calcMiss(lastAppearRange['20-29'], total, latestExpect, list),
      '30-39': Utils.calcMiss(lastAppearRange['30-39'], total, latestExpect, list),
      '40-49': Utils.calcMiss(lastAppearRange['40-49'], total, latestExpect, list)
    };
    const headMiss = {
      0: Utils.calcMiss(lastAppearHead[0], total, latestExpect, list),
      1: Utils.calcMiss(lastAppearHead[1], total, latestExpect, list),
      2: Utils.calcMiss(lastAppearHead[2], total, latestExpect, list),
      3: Utils.calcMiss(lastAppearHead[3], total, latestExpect, list),
      4: Utils.calcMiss(lastAppearHead[4], total, latestExpect, list)
    };
    const tailMiss = {};
    for(let t = 0; t <= 9; t++) tailMiss[t] = Utils.calcMiss(lastAppearTail[t], total, latestExpect, list);
    const colorMiss = { '红': Utils.calcMiss(lastAppearColor['红'], total, latestExpect, list), '蓝': Utils.calcMiss(lastAppearColor['蓝'], total, latestExpect, list), '绿': Utils.calcMiss(lastAppearColor['绿'], total, latestExpect, list) };
    const wuxingMiss = {
      '金': Utils.calcMiss(lastAppearWuxing['金'], total, latestExpect, list),
      '木': Utils.calcMiss(lastAppearWuxing['木'], total, latestExpect, list),
      '水': Utils.calcMiss(lastAppearWuxing['水'], total, latestExpect, list),
      '火': Utils.calcMiss(lastAppearWuxing['火'], total, latestExpect, list),
      '土': Utils.calcMiss(lastAppearWuxing['土'], total, latestExpect, list)
    };
    const animalMiss = { '家禽': Utils.calcMiss(lastAppearAnimal['家禽'], total, latestExpect, list), '野兽': Utils.calcMiss(lastAppearAnimal['野兽'], total, latestExpect, list) };
    const zodiacMiss = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiacMiss[z] = Utils.calcMiss(lastAppearZod[z], total, latestExpect, list));

    let totalMissSum = 0, maxMiss = 0, hot = 0, warm = 0, cold = 0;
    const allMiss = [];
    for(let m = 1; m <= 49; m++) {
      const miss = Utils.calcMiss(lastAppearIdx[m], total, latestExpect, list);
      allMiss.push(miss);
      totalMissSum += miss;
      if(miss > maxMiss) maxMiss = miss;
      if(miss <= 3) hot++;
      else if(miss <= 9) warm++;
      else cold++;
    }
    const avgMiss = (totalMissSum / 49).toFixed(1);
    const curMaxMiss = Math.max(...allMiss);

    let curStreak = 1, maxStreak = 1, current = 1;
    if(list.length >= 2) {
      const firstS = BusinessCommonSpecials.getOne(list[0]);
      const firstShape = `${firstS.odd}_${firstS.big}`;
      for(let i = 1; i < list.length; i++) {
        const s = BusinessCommonSpecials.getOne(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === firstShape) curStreak++;
        else break;
      }
      let prevShape = firstShape;
      for(let i = 1; i < list.length; i++) {
        const s = BusinessCommonSpecials.getOne(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === prevShape) {
          current++;
          if(current > maxStreak) maxStreak = current;
        } else {
          current = 1;
          prevShape = shape;
        }
      }
    }

    const hotSD = Object.entries(singleDouble).sort((a, b) => b[1] - a[1])[0];
    const hotBS = Object.entries(bigSmall).sort((a, b) => b[1] - a[1])[0];
    const hotHead = Object.entries(head).sort((a, b) => b[1] - a[1])[0];
    const hotTail = Object.entries(tail).sort((a, b) => b[1] - a[1])[0];
    const hotColor = Object.entries(color).sort((a, b) => b[1] - a[1])[0];
    const hotWx = Object.entries(wuxing).sort((a, b) => b[1] - a[1])[0];
    // 2026-06-21 通用化：复用 Utils.getTopN
    const hotZod = Utils.getTopN(zodiac, 3, undefined, '、');
    const hotAni = Object.entries(animal).sort((a, b) => b[1] - a[1])[0];
    const hotNum = Utils.getTopN(numCount, 5, undefined, ' ');

    return {
      total, singleDouble, bigSmall, range, head, tail, color, wuxing, animal, zodiac, numCount,
      hotSD, hotBS, hotHead, hotTail, hotColor, hotWx, hotZod, hotAni, hotNum,
      miss: { curMaxMiss, avgMiss, maxMiss, hot, warm, cold },
      streak: { curStreak, maxStreak },
      sdMiss, bsMiss, rangeMiss, headMiss, tailMiss, colorMiss, wuxingMiss, animalMiss, zodiacMiss
    };
  },

  /**
   * 渲染全维度分析
   */
  renderFullAnalysis: () => {
    const data = Business.calcFullAnalysis();
    if(!data) {
      ViewAnalysis.renderFullAnalysis(null);
      return;
    }

    const rankKeys = ['singleDoubleRank', 'bigSmallRank', 'rangeRank', 'headRank', 'tailRank', 'colorRank', 'wuxingRank', 'animalRank', 'zodiacRank'];
    const rankDataObjs = [data.singleDouble, data.bigSmall, data.range, data.head, data.tail, data.color, data.wuxing, data.animal, data.zodiac];
    const rankMissMaps = [data.sdMiss, data.bsMiss, data.rangeMiss, data.headMiss, data.tailMiss, data.colorMiss, data.wuxingMiss, data.animalMiss, data.zodiacMiss];
    const rankHtmls = {};
    rankKeys.forEach(function(k, i) {
      rankHtmls[k] = ViewAnalysis.buildRankHtml(rankDataObjs[i], data.total, rankMissMaps[i]);
    });

    ViewAnalysis.renderFullAnalysis({
      hotSD: data.hotSD[0] + ' / ' + data.hotBS[0],
      hotZodiac: data.hotZod,
      hotHT: data.hotHead[0] + '头 / ' + data.hotTail[0] + '尾',
      hotCW: data.hotColor[0] + ' / ' + data.hotWx[0],
      hotMiss: '热:' + data.miss.hot + ' 温:' + data.miss.warm + ' 冷:' + data.miss.cold + ' | 最大遗漏:' + data.miss.maxMiss + '期',
      odd: data.singleDouble['单'], even: data.singleDouble['双'],
      big: data.bigSmall['大'], small: data.bigSmall['小'],
      r1: data.range['1-9'], r2: data.range['10-19'], r3: data.range['20-29'], r4: data.range['30-39'], r5: data.range['40-49'],
      h0: data.head[0], h1: data.head[1], h2: data.head[2], h3: data.head[3], h4: data.head[4],
      cRed: data.color['红'], cBlue: data.color['蓝'], cGreen: data.color['绿'],
      wJin: data.wuxing['金'], wMu: data.wuxing['木'], wShui: data.wuxing['水'], wHuo: data.wuxing['火'], wTu: data.wuxing['土'],
      aniHome: data.animal['家禽'], aniWild: data.animal['野兽'],
      _hotShape2: Business.getTopHot(Object.entries(data.singleDouble).concat(Object.entries(data.bigSmall))),
      _hotRange2: Business.getTopHot(Object.entries(data.range)),
      _hotHead2: Business.getTopHot(Object.entries(data.head)),
      _hotTail2: Business.getTopHot(Object.entries(data.tail)),
      _hotColor2: Business.getTopHot(Object.entries(data.color)),
      _hotWuxing2: Business.getTopHot(Object.entries(data.wuxing)),
      _hotAnimal: Business.getTopHot(Object.entries(data.animal)),
      _hotZodiac2: Utils.getTopN(data.zodiac, 5, function(i) { return i[0] + '(' + i[1] + ')'; }, ' '),
      hotNum: data.hotNum,
      missCur: data.miss.curMaxMiss, missAvg: data.miss.avgMiss, missMax: data.miss.maxMiss,
      missHot: data.miss.hot, missWarm: data.miss.warm, missCold: data.miss.cold,
      hotColdTip: '热:' + data.miss.hot + ' 温:' + data.miss.warm + ' 冷:' + data.miss.cold,
      streakCur: data.streak.curStreak, streakMax: data.streak.maxStreak,
      streakTip: '当前:' + data.streak.curStreak + '期 最长:' + data.streak.maxStreak + '期',
      tailArr: data.tail,
      rankHtmls: rankHtmls,
      zodiacMiss: data.zodiacMiss
    });
  },

  /**
   * 获取热门值
   * @param {Array} arr - 数组
   * @param {number} limit - 限制数量
   * @returns {string} 热门值字符串
   */
  getTopHot: (arr, limit = 2) => {
    return arr.sort((a, b) => b[1] - a[1]).slice(0, limit).map(i => i[0]).join(' / ');
  },

  /**
   * 计算生肖关联分析
   * @returns {Object} 分析数据
   */
  calcZodiacAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    if(!historyData.length || historyData.length < 2) return null;

    const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
    const total = list.length;
    const avgExpect = total / 12;
    const latestExpect = historyData[0]?.expect || 0;

    const zodCount = {};
    const lastAppearIdx = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => { zodCount[z] = 0; lastAppearIdx[z] = -1; });
    const tailZodMap = {};
    for(let t = 0; t <= 9; t++) tailZodMap[t] = {};
    const followMap = {};

    list.forEach((item, idx) => {
      const s = BusinessCommonSpecials.getOne(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        zodCount[s.zod]++;
        if(lastAppearIdx[s.zod] === -1) lastAppearIdx[s.zod] = idx;
      }
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        tailZodMap[s.tail][s.zod] = (tailZodMap[s.tail][s.zod] || 0) + 1;
      }
    });

    for(let i = 1; i < list.length; i++) {
      const preZod = BusinessCommonSpecials.getOne(list[i-1]).zod;
      const curZod = BusinessCommonSpecials.getOne(list[i]).zod;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(preZod) && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curZod)) {
        if(!followMap[preZod]) followMap[preZod] = {};
        followMap[preZod][curZod] = (followMap[preZod][curZod] || 0) + 1;
      }
    }

    const zodMiss = {};
    const zodAvgMiss = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      zodMiss[z] = Utils.calcMiss(lastAppearIdx[z], total, latestExpect, list);
      zodAvgMiss[z] = zodCount[z] > 0 ? (total / zodCount[z]).toFixed(1) : total;
    });

    const topZod = Object.entries(zodCount).sort((a, b) => b[1] - a[1]);
    const topTail = Array.from({ length: 10 }, (_, t) => ({
      t, sum: Object.values(tailZodMap[t]).reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.sum - a.sum);

    return { list, total, avgExpect, zodCount, zodMiss, zodAvgMiss, tailZodMap, followMap, topZod, topTail };
  },

  /**
   * 渲染生肖关联分析
   */
  renderZodiacAnalysis: () => {
    const data = Business.calcZodiacAnalysis();

    if(!data) {
      ViewAnalysis.renderZodiacAnalysis(null);
      return;
    }

    const combo1 = '1. 首选：尾' + (data.topTail[0]?.t ?? '-') + ' + ' + (data.topZod[0]?.[0] ?? '-') + '（出现' + (data.topZod[0]?.[1] ?? 0) + '次）';
    const combo2 = '2. 次选：尾' + (data.topTail[1]?.t ?? '-') + ' + ' + (data.topZod[1]?.[0] ?? '-') + '（出现' + (data.topZod[1]?.[1] ?? 0) + '次）';
    const combo3 = '3. 备选：尾' + (data.topTail[2]?.t ?? '-') + ' + ' + (data.topZod[2]?.[0] ?? '-') + '（出现' + (data.topZod[2]?.[1] ?? 0) + '次）';

    let tailZodiacHtml = '';
    for(let t = 0; t <= 9; t++) {
      const arr = Object.entries(data.tailZodMap[t]).sort((a, b) => b[1] - a[1]);
      const topZ = arr.length ? arr[0][0] : '-';
      const cnt = arr.length ? arr[0][1] : 0;
      const level = Business.getZodiacLevel(cnt, data.zodMiss[topZ] || 0, data.total);
      tailZodiacHtml += '<div class="data-item-z ' + level.cls + '">尾' + t + '<br>' + topZ + '<br>' + cnt + '次</div>';
    }

    let followTableHtml = '<tr><th>上期生肖</th><th>首选(次数)</th><th>次选(次数)</th><th>排除生肖</th></tr>';
    const followKeys = Object.keys(data.followMap).slice(0, 4);
    followKeys.forEach(k => {
      const arr = Object.entries(data.followMap[k]).sort((a, b) => b[1] - a[1]);
      const first = arr[0] ? arr[0][0] + '(' + arr[0][1] + ')' : '-';
      const second = arr[1] ? arr[1][0] + '(' + arr[1][1] + ')' : '-';
      const exclude = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => !arr.some(x => x[0] === z)).slice(0, 2).join('、');
      followTableHtml += '<tr><td>' + k + '</td><td>' + first + '</td><td>' + second + '</td><td>' + (exclude || '-') + '</td></tr>';
    });

    let zodiacTotalHtml = '';
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      const cnt = data.zodCount[z];
      const miss = data.zodMiss[z];
      const rate = ((cnt / data.total) * 100).toFixed(0) + '%';
      const level = Business.getZodiacLevel(cnt, miss, data.total);
      zodiacTotalHtml += '<div class="data-item-z ' + level.cls + '">' + z + '<br>' + cnt + '次/' + rate + '<br>遗' + miss + '</div>';
    });

    let zodiacMissHtml = '';
    const missSort = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 3);
    missSort.forEach(function(entry) {
      const z = entry[0], m = entry[1];
      const avgMiss = data.zodAvgMiss[z];
      const tag = m > avgMiss ? '超平均' : '';
      zodiacMissHtml += '<div class="data-item-z cold">' + z + '<br>遗' + m + '期<br>' + tag + '</div>';
    });

    ViewAnalysis.renderZodiacAnalysis({
      combo1, combo2, combo3,
      tailZodiacHtml, followTableHtml, zodiacTotalHtml, zodiacMissHtml,
      finalNums: Business.renderZodiacFinalNums(data)
    });
  },

  /**
   * 精选特码 5 维加权打分核心（v2 5 维算法核心，供实时推荐 + 回测共用）
   * 算法说明：基于近期 12 期特码的头/尾/波色/五行统计热度，再结合
   *          "上期开出生肖→下期常跟生肖"的跟随规律，对 1-49
   *          每个号码进行加权打分，按分数降序推荐。
   * @param {Array} list - 历史数据（[0] 最新，[1] 次新，…）
   * @param {number} targetCount - 推荐数量
   * @param {Array} followZodiacs - 跟随生肖（外部传入，回测可动态计算）
   * @returns {Object} { numbers: number[], candidateNums: [{num, score}] }
   */
  _calcFinalZodiacRecommend: (list, targetCount, followZodiacs) => {
    if(!list || list.length === 0) return { numbers: [], candidateNums: [] };

    // ========== 1. 号码→生肖 映射（最新一期 openCode+zodiac）==========
    const numZodiacMap = new Map();
    const latestItem = list[0];
    if(latestItem) {
      const codeArr = (latestItem.openCode || '').split(',');
      const zodArr = Utils.parseZodiacArr(latestItem);
      codeArr.forEach((num, idx) => {
        const numVal = Number(num);
        if(numVal && zodArr[idx]) numZodiacMap.set(numVal, zodArr[idx]);
      });
    }

    // ========== 2. 1-49 号码 → 波色 / 五行 反查表 ==========
    const numColorMap = {};
    const numWuxingMap = {};
    for(let n = 1; n <= 49; n++) {
      numColorMap[n]  = Utils.getColorName(n);
      numWuxingMap[n] = Utils.getWuxing(n);
    }

    // ========== 3. 近期12期 头/尾/波色/五行 频次统计 ==========
    const RECENT_N = 12;
    const recentList = list.slice(0, Math.min(RECENT_N, list.length));
    const headCount  = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const tailCount  = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const colorCount = { '红': 0, '蓝': 0, '绿': 0 };
    const wuxingCount = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    recentList.forEach(item => {
      const s = BusinessCommonSpecials.getOne(item);
      headCount[s.head]   = (headCount[s.head]   || 0) + 1;
      tailCount[s.tail]   = (tailCount[s.tail]   || 0) + 1;
      colorCount[s.colorName]  = (colorCount[s.colorName]  || 0) + 1;
      wuxingCount[s.wuxing]    = (wuxingCount[s.wuxing]    || 0) + 1;
    });

    // ========== 4. 提取热头/热尾/热色/热五行 TOP ==========
    // 2026-06-21 通用化：复用 Utils.getTopN（用空格分隔输出便于后续 Number 转换）
    const topHeads   = Utils.getTopN(headCount, 2, e => Number(e[0]), ' ').split(' ').filter(Boolean).map(Number).filter(n => !isNaN(n));
    const topTails   = Utils.getTopN(tailCount, 3, e => Number(e[0]), ' ').split(' ').filter(Boolean).map(Number).filter(n => !isNaN(n));
    const topColors  = Utils.getTopN(colorCount, 2, undefined, ' ').split(' ').filter(Boolean);
    const topWuxing  = Utils.getTopN(wuxingCount, 2, undefined, ' ').split(' ').filter(Boolean);
    const topFollowZodiacs = Array.isArray(followZodiacs) ? followZodiacs : [];

    // ========== 5. 1-49 号码 5 维加权打分 ==========
    // 权重设计（满分 10）：
    //   跟随生肖 3   —— 最强信号（"上期开X→下期常跟Y"）
    //   头数/尾数 2   —— 位置信号
    //   波色/五行 1.5 —— 属性信号
    const W_FOLLOW = 3, W_HEAD = 2, W_TAIL = 2, W_COLOR = 1.5, W_WUXING = 1.5;

    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod   = numZodiacMap.get(num);
      if(!zod) continue;
      const head  = Math.floor(num / 10);
      const tail  = num % 10;
      const color = numColorMap[num];
      const wx    = numWuxingMap[num];

      let score = 0;
      if(topFollowZodiacs.includes(zod))    score += W_FOLLOW;
      if(topHeads.includes(head))           score += W_HEAD;
      if(topTails.includes(tail))           score += W_TAIL;
      if(topColors.includes(color))         score += W_COLOR;
      if(topWuxing.includes(wx))            score += W_WUXING;

      candidateNums.push({ num, score });
    }

    // ========== 6. 排序 + 选取 + 补位 ==========
    const primary  = candidateNums.filter(c => c.score > 0)
      .sort((a, b) => b.score - a.score || a.num - b.num);
    const fallback = candidateNums.filter(c => c.score === 0)
      .sort((a, b) => a.num - b.num);

    let numbers = primary.slice(0, targetCount).map(c => c.num);

    if(numbers.length < targetCount) {
      const fillNums = fallback.map(c => c.num)
        .filter(n => !numbers.includes(n))
        .slice(0, targetCount - numbers.length);
      numbers.push(...fillNums);
    }

    if(numbers.length < targetCount) {
      const historyFill = [...new Set(list.map(item => BusinessCommonSpecials.getOne(item).te))]
        .filter(num => !numbers.includes(num))
        .slice(0, targetCount - numbers.length);
      numbers.push(...historyFill);
    }

    return { numbers, candidateNums };
  },

  /**
   * 渲染生肖精选号码（v2 5维加权算法 - 实时推荐）
   * @param {Object} data - 分析数据（由 calcZodiacAnalysis 提供）
   * @returns {string} 推荐号码字符串
   */
  renderZodiacFinalNums: (data) => {
    const state = StateManager._state;
    const targetCount = state.analysis.selectedNumCount;

    // 1. 计算"上期开出生肖的常跟随生肖"（来自全量 followMap）
    const latestItem = data.list && data.list[0];
    let topFollowZodiacs = [];
    if(latestItem) {
      const codeArr = (latestItem.openCode || '').split(',');
      const zodArr = Utils.parseZodiacArr(latestItem);
      const latestZodiac = zodArr[6] || '';
      if(latestZodiac && data.followMap && data.followMap[latestZodiac]) {
        topFollowZodiacs = Object.entries(data.followMap[latestZodiac])
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(e => e[0]);
      }
    }

    // 2. 调用核心算法
    const result = Business._calcFinalZodiacRecommend(data.list, targetCount, topFollowZodiacs);
    let finalNums = (result.numbers || []).slice();

    // 3. 升序展示
    finalNums.sort((a, b) => a - b);
    const finalFormatNums = finalNums.map(num => CommonString.formatNum(num));
    return '✅ 精选特码：' + (finalFormatNums.join(' ') || '无');
  },

  /**
   * 同步全维度分析
   * @param {Object} [domValues] - 可选：从事件层传入的DOM值对象（符合分层规范）
   */
  syncAnalyze: (domValues) => {
    // v2.0.8 修复：业务层禁止 DOM 操作，强制要求事件层传入 domValues
    // 若未传则使用默认值（兜底行为兼容）
    const custom = (domValues && domValues.custom) || '';
    const selectVal = (domValues && domValues.selectVal) || '12';
    const historyData = BusinessCommonData.getHistoryData(StateManager._state);

    let newLimit;
    if(custom && !isNaN(custom) && custom > 0) {
      newLimit = Number(custom);
    } else if(selectVal === 'all') {
      const currentYear = new Date().getFullYear();
      const yearData = historyData.filter(item => {
        const expect = item.expect || '';
        return String(expect).startsWith(String(currentYear));
      });
      newLimit = yearData.length;
    } else {
      newLimit = Number(selectVal);
    }

    const newAnalysis = { ...StateManager._state.analysis, analyzeLimit: newLimit };
    StateManager.setState({ analysis: newAnalysis }, false);

    ViewAnalysis.syncSelectors({ zodiacAnalyzeSelect: selectVal, zodiacCustomNum: custom });

    Business.renderFullAnalysis();
    Business.renderZodiacAnalysis();
  },

  /**
   * 同步生肖关联分析
   * @param {Object} [domValues] - 可选：从事件层传入的DOM值对象（符合分层规范）
   */
  syncZodiacAnalyze: (domValues) => {
    // v2.0.8 修复：业务层禁止 DOM 操作，强制要求事件层传入 domValues
    const customPeriod = (domValues && domValues.customPeriod) || '';
    const selectPeriodVal = (domValues && domValues.selectPeriodVal) || '36';
    const countVal = (domValues && domValues.countVal) || '5';
    const customCount = (domValues && domValues.customCount) || '';
    const historyData = BusinessCommonData.getHistoryData(StateManager._state);

    let newLimit;
    if(customPeriod && !isNaN(customPeriod) && customPeriod > 0) {
      newLimit = Number(customPeriod);
    } else if(selectPeriodVal === 'all') {
      const currentYear = new Date().getFullYear();
      const yearData = historyData.filter(item => {
        const expect = item.expect || '';
        return String(expect).startsWith(String(currentYear));
      });
      newLimit = yearData.length;
    } else {
      newLimit = Number(selectPeriodVal);
    }

    let finalCount = 5;

    if(countVal === 'custom') {
      finalCount = customCount && !isNaN(customCount) && Number(customCount) >= 1 && Number(customCount) <= 49
        ? Number(customCount) : 5;
    } else {
      finalCount = Number(countVal);
    }

    const newAnalysis = { ...StateManager._state.analysis, analyzeLimit: newLimit, selectedNumCount: finalCount };
    StateManager.setState({ analysis: newAnalysis }, false);

    ViewAnalysis.syncSelectors({
      analyzeSelect: selectPeriodVal,
      customNum: customPeriod,
      customNumCountVisible: countVal === 'custom'
    });

    Business.renderFullAnalysis();
    Business.renderZodiacAnalysis();
  },

  /**
   * 切换详情显示
   * @param {string} targetId - 目标元素ID
   */
  toggleDetail: (targetId) => {
    ViewAnalysis.toggleDetail(targetId);
  },

  /**
   * 切换分析标签页
   * @param {string} tab - 标签名
   */
  switchAnalysisTab: (tab) => {
    ViewAnalysis.switchTabUI(tab);
    const newAnalysis = { ...StateManager._state.analysis, currentTab: tab };
    StateManager.setState({ analysis: newAnalysis }, false);
    // 记录『广播』页面当前子 tab（用于再次进入『广播』时恢复）
    Storage.saveLastTab('analysis', tab);
  },

  /**
   * 加载更多历史
   */
  loadMoreHistory: () => {
    const state = StateManager._state;
    const newShowCount = state.analysis.showCount + 30;
    const newAnalysis = { ...state.analysis, showCount: newShowCount };
    StateManager.setState({ analysis: newAnalysis }, false);
    Business.renderHistory();
    ViewAnalysis.updateLoadMoreBtn(newShowCount < BusinessCommonData.getHistoryData(StateManager._state).length);
  },

  /**
   * 开始倒计时（使用统一定时器管理器）
   * v2.0.9 优化：只在秒数变化时调用 updateCountdown（避免每秒固定 DOM 写入）
   *   原版每秒都调用一次 updateCountdown，在低端机上与滚动争抢主线程
   *   优化后：定时器仍每秒触发，但内部对比上次字符串，相同则跳过 DOM 更新
   *   配合新增的 _lastCountdownText 缓存
   */
  startCountdown: () => {
    const state = StateManager._state;
    if(state.analysis.countdownTimer) {
      clearInterval(state.analysis.countdownTimer);
      CommonCache.TimerManager.clearInterval('countdown');
    }

    const timer = CommonCache.TimerManager.setInterval('countdown', () => {
      const now = new Date();
      const target = new Date();
      target.setHours(21, 32, 32, 0);
      if(now > target) target.setDate(target.getDate() + 1);
      const diff = target - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      const text = h + ':' + m + ':' + s;
      // v2.0.9：仅在文本变化时调用 DOM 更新，省掉 59/60 次重复写入
      if(text !== Business._lastCountdownText) {
        Business._lastCountdownText = text;
        ViewAnalysis.updateCountdown(text);
      }
    }, 1000);

    const newAnalysis = { ...state.analysis, countdownTimer: timer };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  /**
   * 检查是否在开奖时间
   * @returns {boolean} 是否在开奖时间
   */
  isInDrawTime: () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    return h === 21 && m >= 32 && m <= 40;
  },

  /**
   * 开始自动刷新（使用统一定时器管理器）
   */
  startAutoRefresh: () => {
    const state = StateManager._state;
    if(state.analysis.autoRefreshTimer) {
      clearInterval(state.analysis.autoRefreshTimer);
      CommonCache.TimerManager.clearInterval('autoRefresh');
    }

    const newTimer = CommonCache.TimerManager.setInterval('autoRefresh', () => {
      if(Business.isInDrawTime()) {
        Business.refreshHistory();
      } else {
        CommonCache.TimerManager.clearInterval('autoRefresh');
        const newAnalysis = {
          ...StateManager._state.analysis,
          autoRefreshTimer: null
        };
        StateManager.setState({ analysis: newAnalysis }, false);
      }
    }, 20000);

    const newAnalysis = {
      ...state.analysis,
      autoRefreshTimer: newTimer
    };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  /**
   * 检查开奖时间循环（使用统一定时器管理器）
   */
  checkDrawTimeLoop: () => {
    const state = StateManager._state;
    if(state.analysis.drawTimeLoopTimer) {
      clearInterval(state.analysis.drawTimeLoopTimer);
      CommonCache.TimerManager.clearInterval('drawTimeLoop');
    }

    const timer = CommonCache.TimerManager.setInterval('drawTimeLoop', () => {
      if(Business.isInDrawTime() && !StateManager._state.analysis.autoRefreshTimer) {
        Business.startAutoRefresh();
      }
    }, 60000);

    const newAnalysis = { ...state.analysis, drawTimeLoopTimer: timer };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  /**
   * 滚动到指定模块
   * @param {string} targetId - 模块ID
   */
  scrollToModule: (targetId) => {
    ViewFilter.scrollToModule(targetId);
    Business.toggleQuickNav(false);
  },

  /** @param {boolean|null} [isOpen] - true 展开，false 收起，null 反转 */
  toggleQuickNav: (isOpen = null) => BusinessQuickNav.toggle(isOpen),

  /** @returns {boolean} 快捷导航栏是否展开 */
  isQuickNavExpanded: () => BusinessQuickNav.isExpanded(),

  /**
   * 返回顶部
   */
  backToTop: () => {
    ViewFilter.backToTop();
  },

  /**
   * 滚动事件处理（已节流优化）
   */
  handleScroll: CommonCache.throttle(() => {
    const state = StateManager._state;
    const scrollTop = ViewFilter.getScrollTop();
    clearTimeout(state.scrollTimer);

    if(scrollTop > CONFIG.BACK_TOP_THRESHOLD){
      ViewFilter.toggleBackTopBtn(true);
      state.scrollTimer = setTimeout(() => {
        ViewFilter.toggleBackTopBtn(false);
      }, CONFIG.SCROLL_HIDE_DELAY);
    } else {
      ViewFilter.toggleBackTopBtn(false);
    }
  }, CONFIG.SCROLL_THROTTLE_DELAY),

  /**
   * 页面卸载清理，避免内存泄漏（使用统一定时器管理器）
   */
  handlePageUnload: () => {
    StateManager.clearAllTimers();
    CommonCache.TimerManager.clearAll(); // 清理所有通过TimerManager管理的定时器
    ViewFilter.cleanupPageEvents(Business.handleScroll, Business.handlePageUnload);
  },

  // ====================== 生肖预测相关 ======================
  initZodiacPrediction: () => {
    // 2026-06-24 完整迁移：使用 BusinessCommonData.ensureHistoryData
    var historyData = BusinessCommonData.ensureHistoryData();
    Business.renderZodiacPrediction();
    Business.initZodiacBacktest();
  },

  renderZodiacPrediction: () => {
    var state = StateManager._state;
    var historyData = BusinessCommonData.getHistoryData(state);
    if (!historyData || !historyData.length) {
      ViewZodiacPredict.renderEmpty();
      return;
    }
    var result = ZodiacPrediction.calcContinuousScores(historyData);
    // 保存 v1 推荐结果到状态（仅前 6 名，与卡片展示一致）
    if (result && result.cards && result.cards.length) {
      StateManager._state.analysis.v1Recommend = result.cards.slice(0, 6);
    }
    ViewZodiacPredict.renderPrediction(result);
  },

  initZodiacBacktest: () => {
    var state = StateManager._state;
    var historyData = BusinessCommonData.getHistoryData(state);
    if (!historyData || !historyData.length) {
      ViewZodiacPredict.renderBacktest(null);
      return;
    }
    ViewZodiacPredict.renderBacktestEmpty();
    // v2.0.9：改用 requestIdleCallback 替代 setTimeout，浏览器空闲时执行，不打断滚动
    _scheduleIdle(function() {
      var result = ZodiacPrediction.runBacktest(historyData);
      ViewZodiacPredict.renderBacktest(result);
    });
  },

  switchZodiacTab: (tab) => {
    ViewCommon.switchZodiacPanel(tab);
    if (tab === 'main') Business.initMainTab();
    if (tab === 'predict') Business.renderZodiacPrediction();
    if (tab === 'giong') Business.initGiongTab();
    if (tab === 'ultimate') Business.initUltimateAlgorithm();
    if (tab === 'tongji' && typeof ViewZodiacTongJi !== 'undefined' && ViewZodiacTongJi.render) {
      Business.initTongJiTab();
    }
    // 记录『资料』页面当前子 tab（用于再次进入『资料』时恢复）
    Storage.saveLastTab('random', tab);
  },

  /**
   * 初始化 TongJi 标签页（2026-06-20 新增）
   * 流程：加载历史数据 → 调业务层计算 → 交由视图层渲染
   */
  initTongJiTab: () => {
    var state = StateManager._state;
    var historyData = BusinessCommonData.ensureHistoryData(state);
    if (!historyData || !historyData.length) {
      ViewZodiacTongJi.render(null);
      return;
    }

    var zodiacStats = ZodiacPrediction.calcZodiacTongJiStats(historyData);
    var numLevelStats = ZodiacPrediction.calcNumLevelStats(historyData);
    // 2026-06-24 用户需求：每期"特码开出前"的等级分布
    var preDrawStats = ZodiacPrediction.calcPreDrawLevelHistory(historyData);
    // 缓存 stats，供排序切换时重渲染（2026-06-20 用户需求：表头点击升序降序）
    var stats = {
      zodiac: zodiacStats,
      numLevel: numLevelStats,
      preDraw: preDrawStats
    };
    if (typeof ZodiacPrediction.setStats === 'function') {
      ZodiacPrediction.setStats(stats);
    }
    ViewZodiacTongJi.render(stats, ZodiacPrediction.getSort());
  },

  /**
   * 切换 TongJi 生肖表头排序（2026-06-20 用户需求）
   *  流程：计算下一排序方向 → 更新 _sort → 用 _stats 重渲染
   *  兜底：若 _stats 未初始化（极少见），主动 initTongJiTab 后再排序
   */
  toggleZodiacTongjiSort: (key) => {
    if (!key) return;
    // 兜底：_stats 缺失时主动初始化一次
    if (!ZodiacPrediction._stats && typeof Business.initTongJiTab === 'function') {
      Business.initTongJiTab();
      if (!ZodiacPrediction._stats) return;
    }
    var next = ZodiacPrediction.computeNextSort(key);
    ZodiacPrediction._sort = next;
    try {
      ViewZodiacTongJi.render(ZodiacPrediction._stats, next);
    } catch (err) {
      // 2026-06-20 增强调试：打印完整堆栈 + 关键变量，便于定位 render 失败根因
      if (typeof console !== 'undefined' && console.error) {
        console.error(
          '[toggleZodiacTongjiSort] render error',
          '\n  key:', key,
          '\n  next:', JSON.stringify(next),
          '\n  hasStats:', !!ZodiacPrediction._stats,
          '\n  statsKeys:', ZodiacPrediction._stats ? Object.keys(ZodiacPrediction._stats) : null,
          '\n  hasView:', typeof ViewZodiacTongJi,
          '\n  hasViewRender:', typeof (ViewZodiacTongJi && ViewZodiacTongJi.render),
          '\n  err:', err && err.message,
          '\n  stack:', err && err.stack
        );
      }
      // render 抛错时回退到完整重新初始化（避免 UI 卡死）
      try { Business.initTongJiTab(); } catch (e2) { /* 静默兜底 */ }
    }
  },

  /**
   * 初始化主推标签页（滑动窗口预测算法）
   */
  initMainTab: () => {
    // 2026-06-24 完整迁移：使用 BusinessCommonData.getDataWithTimestamp / ensureHistoryData
    var state = StateManager._state;
    var data = BusinessCommonData.getDataWithTimestamp(state);
    var historyData = data.historyData;
    var cacheTimestamp = data.timestamp;

    // 尝试加载缓存
    if (!historyData || !historyData.length) {
      Business.loadHistoryCache();
      var retry = BusinessCommonData.getDataWithTimestamp();
      historyData = retry.historyData;
      cacheTimestamp = retry.timestamp;
    }

    if (!historyData || !historyData.length) {
      ViewZodiacMain.renderSlidingWindowPrediction(null, null, null);
      ViewSlidingWindowHistory.renderEmpty();
      return;
    }

    // 数据陈旧检测：超过24小时未更新则提示用户
    var now = Date.now();
    var ageMs = cacheTimestamp > 0 ? (now - cacheTimestamp) : 0;
    var ageHours = ageMs > 0 ? Math.floor(ageMs / (60 * 60 * 1000)) : null;

    // [V1.4.2 优化] 一次性获取交叉排除完整结果，避免 predict 内部重复调用 collectAllRecommend
    var crossResult = BusinessCrossExclusion.collectAllRecommend(historyData);

    // 调用滑动窗口预测算法（传入完整 crossResult）
    var result = BusinessSlidingWindow._predictWithLRU(historyData, { crossResult: crossResult });
    ViewZodiacMain.renderSlidingWindowPrediction(result, cacheTimestamp, ageHours);

    // 回测追踪：基于历史 N 期模拟预测，与实际开奖比对
    // 2026-06-25 适配：runBacktestEnrichedWithCache 在 bcdd524 精简时被移除，
    //                   暂退回 runBacktest（仅 records）。signalStats 功能后续按需恢复。
    var backtestRecords = BusinessSlidingWindowHistory.runBacktest(historyData, 30);
    var pendingPrediction = {
      nextExpect: result.nextExpect,
      candidates: result.candidates
    };
    ViewSlidingWindowHistory.render(backtestRecords, pendingPrediction);
  },

  initGiongTab: () => {
    // 2026-06-24 完整迁移：使用 BusinessCommonData.ensureHistoryData
    var historyData = BusinessCommonData.ensureHistoryData();
    if (!historyData || !historyData.length) return;

    var freqResult = ZodiacPrediction.calcFrequencyRating(historyData);
    ViewZodiacGiong.renderFrequencyRating(freqResult);

    // 2026-06-21 性能优化：一次性预计算 recentSpecials（前 12 期），后续 4 个 stats 函数复用
    // 节省 ~48 次 Utils.SpecialCalculator.getSpecial 调用（4 函数 × 12 期）
    var recentSpecials = BusinessCommonSpecials.precompute(historyData.slice(0, 12));

    var latestFollowStats = ZodiacPrediction.getLatestFollowStats(historyData, 4, 20);
    ViewZodiacGiong.renderLatestFollowStats(latestFollowStats);

    var latestSizeStats = ZodiacPrediction.getLatestSizeStats(historyData, 12, recentSpecials);
    var latestOddEvenStats = ZodiacPrediction.getLatestOddEvenStats(historyData, 12, recentSpecials);
    var latestWuxingStats = ZodiacPrediction.getLatestWuxingStats(historyData, 12, recentSpecials);
    var latestColorStats = ZodiacPrediction.getLatestColorStats(historyData, 12, recentSpecials);

    ViewZodiacGiong.renderCombinedAnalysis(latestSizeStats, latestOddEvenStats, latestWuxingStats, latestColorStats);

    var patternResult = ZodiacPrediction.analyzeZonePatterns(historyData);

    if (freqResult && patternResult) {
      var recommend = ZodiacPrediction.getZoneRecommend(historyData, freqResult, patternResult);
      var nextExpect = (Number(historyData[0].expect || 0) + 1) || '';
      ViewZodiacGiong.renderZoneRecommend(recommend, nextExpect);
    }

    ViewZodiacGiong.renderZoneBacktestEmpty();
    // v2.0.9：改用 requestIdleCallback 替代 setTimeout，浏览器空闲时执行，不打断滚动
    _scheduleIdle(function() {
      var zoneBt = ZodiacPrediction.runZoneBacktest(historyData);
      if (zoneBt) ViewZodiacGiong.renderZoneBacktest(zoneBt);
    });

    // 区域变动追踪
    var zoneChangeData = ZodiacPrediction.calcZoneChangeTracking(historyData, 12);
    ViewZodiacGiong.renderZoneChangeTracking(zoneChangeData);

    // 多窗口区域变动追踪（12/24/36 期三列并排）
    var zoneChangeP12 = ZodiacPrediction.calcZoneChangeTracking(historyData, 12);
    var zoneChangeP24 = ZodiacPrediction.calcZoneChangeTracking(historyData, 24);
    var zoneChangeP36 = ZodiacPrediction.calcZoneChangeTracking(historyData, 36);
    ViewZodiacGiong.renderZoneChangeTrackingMulti(zoneChangeP12, zoneChangeP24, zoneChangeP36);

    // 2026-06-21 架构修复：用业务层标志代替 DOM 查询，避免业务层违规使用 document
    Business._giongCardsRendered = true;
  },

  initUltimateAlgorithm: () => {
    var state = StateManager._state;
    var historyData = BusinessCommonData.getHistoryData(state);
    // 缓存优化：若终极算法标签页已经渲染过且历史数据未变化，则跳过重复渲染
    // 避免重复点击底部导航按钮时整页闪烁
    if (Business._ultimateInitialized && historyData.length) {
      var cachedExpect = Business._ultimateCachedExpect;
      var currentExpect = historyData[0] ? historyData[0].expect : null;
      if (cachedExpect === currentExpect) {
        return;
      }
    }
    Business._ultimateInitialized = true;
    historyData = BusinessCommonData.ensureHistoryData(state);
    if (!historyData || !historyData.length) {
      ViewZodiacUltimate.renderUltimateAlgorithm(null);
      ViewZodiacUltimate.renderUltimateBacktestEmpty();
      return;
    }

    var ultimateHistory = BusinessUltimate.historyDataToUltimateFormat(historyData);
    if (!ultimateHistory || !ultimateHistory.length) {
      ViewZodiacUltimate.renderUltimateAlgorithm(null);
      ViewZodiacUltimate.renderUltimateBacktestEmpty();
      return;
    }

    var report = BusinessUltimate.generateFullReport(ultimateHistory);
    var nextExpect = Number(historyData[0].expect || 0) + 1;
    var numbers = report.numbers ? (report.numbers.mainNumbers || report.numbers.transitionNumbers || []) : [];

    if (numbers.length > 0) {
      BusinessUltimate.saveRecommendHistory(nextExpect, numbers);
    }

    ViewZodiacUltimate.renderUltimateAlgorithm({
      report: report,
      nextExpect: nextExpect,
      numbers: BusinessUltimate.formatNumbersToDisplay(numbers),
      alternative: report.numbers ? BusinessUltimate.formatNumbersToDisplay(report.numbers.alternativeNumbers || []) : [],
      adaptiveInfo: BusinessUltimate.getAdaptiveState()
    });
    // 记录当前已渲染的期号，用于缓存判断
    Business._ultimateCachedExpect = historyData[0].expect;

    // 渲染未推荐生肖卡片（直接从三个推荐源 DOM 中读取，不依赖业务层）
    // 兜底：若 v2 卡片尚未渲染（如用户直接进入终极 tab），先触发一次
    // 2026-06-21 架构修复：用业务层 _giongCardsRendered 标志代替 DOM 查询
    if (!Business._giongCardsRendered) {
      Business.initGiongTab();
    }
    ViewZodiacUltimate.renderUnrecommendedZodiacs(null);

    if (ultimateHistory.length >= 25) {
      ViewZodiacUltimate.renderUltimateBacktestEmpty();
      var currentBackupCount = (report.numbers && report.numbers.alternativeNumbers) ? report.numbers.alternativeNumbers.length : (BusinessUltimate.getAdaptiveState().currentBackupCount || 3);
      // v2.0.9：改用 requestIdleCallback 替代 setTimeout，浏览器空闲时执行，不打断滚动
      _scheduleIdle(function() {
        var btSummary = BusinessUltimate.runBacktest(ultimateHistory);
        if (btSummary) ViewZodiacUltimate.renderUltimateBacktest(btSummary, currentBackupCount);
      });
    } else {
      ViewZodiacUltimate.renderUltimateBacktestEmpty();
    }
  },

  _deduplicateByExpect: (records) => {
    if (!records || !Array.isArray(records) || records.length <= 1) return records || [];

    var seen = {};
    var unique = [];

    for (var i = records.length - 1; i >= 0; i--) {
      var record = records[i];
      var key = record.expect || ('time_' + record.predictTime);
      if (!seen[key]) {
        seen[key] = true;
        unique.unshift(record);
      }
    }

    return unique;
  },

  _cleanInvalidRecords: (records, latestExpect) => {
    if (!records || !records.length || !latestExpect) return records;

    var latestNum = Number(latestExpect);

    records.forEach(function(record) {
      if (!record.expect) return;

      var recordExpect = Number(record.expect);
      if (isNaN(recordExpect)) return;

      if (recordExpect > latestNum && record.actualResult !== null) {
        record.actualResult = null;
        record.isHit = null;
        record.hitType = null;
      }
    });

    return records;
  },

  saveGiongBacktestRecord: (giongData, currentNum, expect) => {
    if (!giongData || giongData.insufficient) return;

    var mainPredictions = giongData.mergedResult ? giongData.mergedResult.main.map(function(item) { return item.zodiac; }) : [];
    var backupPredictions = giongData.mergedResult ? giongData.mergedResult.backup.map(function(item) { return item.zodiac; }) : [];

    if (mainPredictions.length === 0) {
      var newMain = giongData.newResult.main.map(function(item) { return item.zodiac; });
      var newBackup = giongData.newResult.backup.map(function(item) { return item.zodiac; });
      mainPredictions = newMain;
      backupPredictions = newBackup;
    }

    var records = Storage.getGiongBacktestRecords();
    records = Business._deduplicateByExpect(records);
    records = Business._cleanInvalidRecords(records, expect);

    if (expect && currentNum >= 1 && currentNum <= 12) {
      var prevExpect = String(Number(expect) - 1);
      var prevIndex = records.findIndex(function(r) {
        return r.expect === prevExpect && r.actualResult === null;
      });
      if (prevIndex !== -1) {
        var prevRecord = records[prevIndex];
        prevRecord.actualResult = currentNum;
        var mainHit = prevRecord.mainPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
        var backupHit = prevRecord.backupPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
        if (mainHit) {
          prevRecord.isHit = true;
          prevRecord.hitType = 'main';
        } else if (backupHit) {
          prevRecord.isHit = true;
          prevRecord.hitType = 'backup';
        } else {
          prevRecord.isHit = false;
          prevRecord.hitType = null;
        }
      }
    }

    if (expect) {
      var existingIndex = records.findIndex(function(r) { return r.expect === expect; });
      if (existingIndex !== -1) {
        var exist = records[existingIndex];
        var sameMain = JSON.stringify(exist.mainPredictions) === JSON.stringify(mainPredictions);
        var sameBackup = JSON.stringify(exist.backupPredictions) === JSON.stringify(backupPredictions);
        if (!sameMain || !sameBackup) {
          exist.mainPredictions = mainPredictions.slice();
          exist.backupPredictions = backupPredictions.slice();
          exist.currentNum = currentNum;
        }
        Storage.saveGiongBacktestRecords(records);
        return;
      }
    } else {
      if (records.length > 0 && currentNum >= 1 && currentNum <= 12) {
        var last = records[0];
        if (last.actualResult === null) {
          last.actualResult = currentNum;
          var mh = last.mainPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
          var bh = last.backupPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
          if (mh) { last.isHit = true; last.hitType = 'main'; }
          else if (bh) { last.isHit = true; last.hitType = 'backup'; }
          else { last.isHit = false; last.hitType = null; }
        }
        Storage.saveGiongBacktestRecords(records);
        return;
      }
    }

    var now = new Date();
    var newRecord = {
      id: now.getTime(),
      predictTime: now.toISOString(),
      expect: expect || '',
      mainPredictions: mainPredictions.slice(),
      backupPredictions: backupPredictions.slice(),
      currentNum: currentNum,
      actualResult: null,
      isHit: null,
      hitType: null
    };

    records.unshift(newRecord);
    if (records.length > 50) records = records.slice(0, 50);
    Storage.saveGiongBacktestRecords(records);
  },

  calculateGiongBacktestStats: (latestExpect) => {
    var records = Storage.getGiongBacktestRecords();
    records = Business._deduplicateByExpect(records);
    records = Business._cleanInvalidRecords(records, latestExpect);
    if (latestExpect) Storage.saveGiongBacktestRecords(records);

    var stats = {
      totalRecords: records.length,
      hitCount: 0,
      mainHitCount: 0,
      backupHitCount: 0,
      missCount: 0,
      pendingCount: 0,
      recentRecords: [],
      consecutiveHits: 0,
      maxConsecutiveHits: 0,
      hitRate: '0.0'
    };

    var validRecords = records.filter(function(r) { return r.isHit !== null; });
    stats.pendingCount = records.length - validRecords.length;

    validRecords.forEach(function(record) {
      if (record.isHit) {
        stats.hitCount++;
        if (record.hitType === 'main') stats.mainHitCount++;
        else if (record.hitType === 'backup') stats.backupHitCount++;
      } else {
        stats.missCount++;
      }
    });

    var tempConsecutive = 0;
    for (var i = validRecords.length - 1; i >= 0; i--) {
      if (validRecords[i].isHit) {
        tempConsecutive++;
        if (tempConsecutive > stats.maxConsecutiveHits) stats.maxConsecutiveHits = tempConsecutive;
      } else {
        tempConsecutive = 0;
      }
    }

    for (var j = 0; j < validRecords.length; j++) {
      if (validRecords[j].isHit) stats.consecutiveHits++;
      else break;
    }

    if (validRecords.length > 0) {
      stats.hitRate = ((stats.hitCount / validRecords.length) * 100).toFixed(1);
    }

    stats.recentRecords = records.slice(0, 8).map(function(r) {
      return {
        id: r.id,
        predictTime: r.predictTime,
        expect: r.expect || '',
        mainPredictions: r.mainPredictions,
        backupPredictions: r.backupPredictions,
        actualResult: r.actualResult ? BusinessGiong._toZodiac(r.actualResult) : null,
        isHit: r.isHit,
        hitType: r.hitType
      };
    });

    return stats;
  }
};
