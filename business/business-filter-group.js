/**
 * 业务层：方案分组管理
 * @namespace FilterGroup
 * 职责：管理筛选方案分组（新建/切换/重命名/删除）+ 完整快照恢复
 * 依赖：StateManager、Storage、Render、Toast、GIONGBETA_INPUT_MODAL、GIONGBETA_CONFIRM_MODAL
 *
 * 数据模型（2026-06-20 用户需求）：
 * - 每分组独立方案列表：每个分组拥有自己的 savedFilters
 * - 完整快照恢复：切换分组时同步恢复 selected/excluded/locked/marked/markCount/excludeHistory/lockExclude/showAllFilters
 *
 * 状态字段（core/state.js 新增）：
 * - filterGroups: Array<{ id, name, createdAt, savedFilters, selected, excluded, excludeHistory, lockExclude, locked, marked, markCount, showAllFilters }>
 * - currentGroupId: 当前激活分组 ID（null 表示未启用分组）
 */
const FilterGroup = {
  /**
   * 生成默认分组名（"分组一"、"分组二"、...）
   * @returns {string}
   */
  _genDefaultName: () => {
    const list = StateManager._state.filterGroups || [];
    // 已有分组中提取最大编号（兼容"分组一"~"分组二十"）
    const cnMap = { '零':0,'一':1,'二':2,'三':3,'四':4,'五':5,'六':6,'七':7,'八':8,'九':9 };
    let maxN = 0;
    list.forEach(g => {
      if (!g || typeof g.name !== 'string') return;
      const m = g.name.match(/^分组(.+)$/);
      if (!m) return;
      const cn = m[1];
      let n = 0;
      if (cn === '十') n = 10;
      else if (cn.length === 2 && cn[1] === '十') n = (cnMap[cn[0]] || 0) * 10;
      else if (cn.length === 2 && cn[0] === '十') n = 10 + (cnMap[cn[1]] || 0);
      else if (cn.length === 1) n = cnMap[cn] || 0;
      else if (cn.length === 3 && cn[1] === '十') n = (cnMap[cn[0]] || 0) * 10 + (cnMap[cn[2]] || 0);
      if (n > maxN) maxN = n;
    });
    const next = maxN + 1;
    // 阿拉伯数字转中文（支持 1-99）
    const numToCn = (n) => {
      if (n < 11) return ['','一','二','三','四','五','六','七','八','九','十'][n];
      if (n < 20) return '十' + (n === 10 ? '' : numToCn(n - 10));
      const tens = Math.floor(n / 10);
      const ones = n % 10;
      return numToCn(tens) + '十' + (ones ? numToCn(ones) : '');
    };
    return '分组' + numToCn(next);
  },

  /**
   * 提取当前主页完整状态快照（不含方案列表，清空 savedFilters 以满足"新建分组清空方案"）
   * @returns {Object} 快照对象
   */
  _captureSnapshot: (emptySavedFilters) => {
    const s = StateManager._state;
    return {
      savedFilters: emptySavedFilters ? [] : (Array.isArray(s.savedFilters) ? Utils.deepClone(s.savedFilters) : []),
      selected: Utils.deepClone(s.selected || {}),
      excluded: Array.isArray(s.excluded) ? Utils.deepClone(s.excluded) : [],
      excludeHistory: Array.isArray(s.excludeHistory) ? Utils.deepClone(s.excludeHistory) : [],
      lockExclude: !!s.lockExclude,
      locked: Utils.deepClone(s.locked || {}),
      marked: Utils.deepClone(s.marked || {}),
      markCount: Utils.deepClone(s.markCount || {}),
      showAllFilters: !!s.showAllFilters
    };
  },

  /**
   * 应用快照到 state（覆盖 selected/excluded 等；触发一次 setState 走持久化）
   * @param {Object} snap - 快照对象
   */
  _applySnapshot: (snap) => {
    if (!snap || typeof snap !== 'object') return;
    // 安全兜底：selected 必须保留所有 group 字段
    const expectedGroups = ['zodiac','color','colorsx','type','element','head','tail','sum','sumOdd','sumSize','tailSize','bs','hot','num'];
    const safeSelected = (snap.selected && typeof snap.selected === 'object') ? Utils.deepClone(snap.selected) : {};
    expectedGroups.forEach(g => {
      if (!Array.isArray(safeSelected[g])) safeSelected[g] = [];
    });
    StateManager.setState({
      savedFilters: Array.isArray(snap.savedFilters) ? snap.savedFilters : [],
      selected: safeSelected,
      excluded: Array.isArray(snap.excluded) ? snap.excluded : [],
      excludeHistory: Array.isArray(snap.excludeHistory) ? snap.excludeHistory : [],
      lockExclude: !!snap.lockExclude,
      locked: (snap.locked && typeof snap.locked === 'object') ? snap.locked : {},
      marked: (snap.marked && typeof snap.marked === 'object') ? snap.marked : {},
      markCount: (snap.markCount && typeof snap.markCount === 'object') ? snap.markCount : {},
      showAllFilters: !!snap.showAllFilters
    }, false);
    // 触发完整重渲染（renderAll 不含 renderFilterList，需手动补一次）
    Render.renderAll();
    Render.renderFilterList();
    // 委托视图层同步 DOM 控件（业务层不直接操作 DOM）
    if (typeof ViewFilterGroup !== 'undefined' && typeof ViewFilterGroup.syncLockExcludeUI === 'function') {
      ViewFilterGroup.syncLockExcludeUI(!!snap.lockExclude);
    }
  },

  /**
   * 公共入口：应用分组快照到 state（供 app.js 等外部调用）
   * @param {Object} group - 分组对象（含完整快照字段）
   */
  applyGroupSnapshot: (group) => {
    FilterGroup._applySnapshot(group);
  },

  /**
   * 持久化分组列表与当前激活 ID
   * @returns {boolean}
   */
  _persistGroups: () => {
    const s = StateManager._state;
    const ok1 = Storage.set(Storage.KEYS.FILTER_GROUPS, s.filterGroups || []);
    const ok2 = Storage.set(Storage.KEYS.CURRENT_GROUP_ID, s.currentGroupId || null);
    return ok1 && ok2;
  },

  /**
   * 把当前完整状态写回当前分组快照（用于切换前保存）
   * @param {boolean} emptySavedFilters - true 时清空当前 savedFilters（用于新建分组场景）
   */
  _saveCurrentIntoActiveGroup: (emptySavedFilters) => {
    const s = StateManager._state;
    if (!s.currentGroupId) return;
    const list = s.filterGroups || [];
    const idx = list.findIndex(g => g && g.id === s.currentGroupId);
    if (idx < 0) return;
    list[idx] = Object.assign({}, list[idx], FilterGroup._captureSnapshot(emptySavedFilters));
  },

  /**
   * 加载分组（从 storage 还原到 state），幂等
   */
  loadGroupsFromStorage: () => {
    const rawList = Storage.get(Storage.KEYS.FILTER_GROUPS, []);
    const validList = Array.isArray(rawList) ? rawList.filter(g => g && g.id && g.name) : [];
    const rawId = Storage.get(Storage.KEYS.CURRENT_GROUP_ID, null);
    const validId = rawId && validList.some(g => g.id === rawId) ? rawId : null;
    StateManager.setState({ filterGroups: validList, currentGroupId: validId }, false);
  },

  /**
   * 创建新分组
   * 行为：
   *   1) 把当前完整状态写回当前激活分组（保留原分组数据）
   *   2) 新建分组，savedFilters 为空（满足"清空当前的保存方案"）
   *   3) currentGroupId 指向新分组
   *   4) 首次创建分组时（之前无 currentGroupId），同步清空 SAVED_FILTERS 避免孤儿数据
   * @param {string} [name] - 用户输入名称；空则使用默认"分组一"
   */
  createGroup: (name) => {
    const s = StateManager._state;
    const finalName = (typeof name === 'string' && name.trim()) ? name.trim() : FilterGroup._genDefaultName();
    const list = (s.filterGroups || []).slice();
    const isFirstGroup = !s.currentGroupId;

    // 步骤 1：保存当前状态到原激活分组
    FilterGroup._saveCurrentIntoActiveGroup(false);

    // 步骤 2：创建新分组（savedFilters 强制为空）
    const newGroup = {
      id: 'g_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
      name: finalName,
      createdAt: Date.now(),
      // 其余快照字段保持当前状态（用户已选/排除/锁定等延续到新分组）
      ...FilterGroup._captureSnapshot(true)
    };
    // savedFilters 必须为空（强制覆盖 captureSnapshot 中的 savedFilters）
    newGroup.savedFilters = [];
    list.push(newGroup);

    StateManager.setState({ filterGroups: list, currentGroupId: newGroup.id }, false);

    // 首次创建分组时清空 SAVED_FILTERS（避免原方案成为孤儿数据）
    if (isFirstGroup) {
      Storage.remove(Storage.KEYS.SAVED_FILTERS);
    }

    FilterGroup._persistGroups();
    Render.renderFilterList();
    if (typeof ViewFilterGroup !== 'undefined') ViewFilterGroup.render();
    Toast.show('已新建分组：' + finalName);
  },

  /**
   * 切换到指定分组（先保存当前状态，再加载目标分组）
   * @param {string} groupId
   */
  switchGroup: (groupId) => {
    const s = StateManager._state;
    const list = s.filterGroups || [];
    if (!groupId || groupId === s.currentGroupId) return;
    const target = list.find(g => g && g.id === groupId);
    if (!target) {
      Toast.show('分组不存在');
      return;
    }

    // 步骤 1：把当前完整状态写回原激活分组
    FilterGroup._saveCurrentIntoActiveGroup(false);

    // 步骤 2：加载目标分组到 state
    StateManager.setState({ currentGroupId: groupId }, false);
    FilterGroup._applySnapshot(target);

    FilterGroup._persistGroups();
    if (typeof ViewFilterGroup !== 'undefined') ViewFilterGroup.render();
    Toast.show('已切换到：' + target.name);
  },

  /**
   * 重命名分组（弹窗输入新名称）
   * @param {string} groupId
   */
  renameGroup: (groupId) => {
    const list = StateManager._state.filterGroups || [];
    const idx = list.findIndex(g => g && g.id === groupId);
    if (idx < 0) return;
    const oldName = list[idx].name;
    GIONGBETA_INPUT_MODAL.show('重命名分组', '请输入新分组名', oldName, (val) => {
      if (!val || !val.trim()) return;
      const newName = val.trim();
      if (newName === oldName) return;
      list[idx] = Object.assign({}, list[idx], { name: newName });
      StateManager.setState({ filterGroups: list.slice() }, false);
      FilterGroup._persistGroups();
      if (typeof ViewFilterGroup !== 'undefined') ViewFilterGroup.render();
      Toast.show('已重命名为：' + newName);
    });
  },

  /**
   * 删除分组（弹窗确认）
   * @param {string} groupId
   */
  deleteGroup: (groupId) => {
    const s = StateManager._state;
    const list = s.filterGroups || [];
    const idx = list.findIndex(g => g && g.id === groupId);
    if (idx < 0) return;
    if (list.length <= 1) {
      Toast.show('至少保留 1 个分组');
      return;
    }
    const target = list[idx];
    // 是否为当前激活分组（决定文案是否提示"未保存修改将丢失"）
    const isCurrent = s.currentGroupId === groupId;
    const confirmText = isCurrent
      ? '确定删除当前分组"' + target.name + '"？\n该分组下的所有方案 + 当前未保存的修改将一并丢失'
      : '确定删除分组"' + target.name + '"？该分组下的所有方案将一并删除';
    GIONGBETA_CONFIRM_MODAL.show(confirmText, (ok) => {
      if (!ok) return;
      const newList = list.filter(g => g.id !== groupId);
      // 如果删除的是当前分组，切换到第一个剩余分组（直接切换，不再保存即将被删除的分组）
      if (isCurrent) {
        const next = newList[0];
        StateManager.setState({ filterGroups: newList, currentGroupId: next.id }, false);
        FilterGroup._applySnapshot(next);
      } else {
        // 删除非当前分组：无需特殊处理
        StateManager.setState({ filterGroups: newList }, false);
      }
      FilterGroup._persistGroups();
      Render.renderFilterList();
      if (typeof ViewFilterGroup !== 'undefined') ViewFilterGroup.render();
      Toast.show('已删除分组：' + target.name);
    });
  }
};

// 挂载到 Business 命名空间下（保持与其他业务模块一致）
Object.assign(Business, { FilterGroup });