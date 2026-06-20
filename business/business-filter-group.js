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
   * 返回默认 selected 状态对象（14 个 group 全为空数组）
   * @returns {Object}
   */
  _defaultSelected: () => {
    return {
      zodiac:[], color:[], colorsx:[], type:[], element:[],
      head:[], tail:[], sum:[], sumOdd:[], sumSize:[], tailSize:[], bs:[], hot:[],
      num:[]
    };
  },

  /**
   * 返回完整默认快照（用于新建分组场景，避免在 createGroup 中重复定义 9 个字段）
   * @returns {Object} 含 savedFilters/selected/excluded/excludeHistory/lockExclude/locked/marked/markCount/showAllFilters
   */
  _defaultSnapshot: () => {
    return {
      savedFilters: [],
      selected: FilterGroup._defaultSelected(),
      excluded: [],
      excludeHistory: [],
      lockExclude: false,
      locked: {},
      marked: {},
      markCount: {},
      showAllFilters: false
    };
  },

  /**
   * 提取当前主页完整状态快照
   * @returns {Object} 快照对象
   */
  _captureSnapshot: () => {
    const s = StateManager._state;
    return {
      savedFilters: Array.isArray(s.savedFilters) ? Utils.deepClone(s.savedFilters) : [],
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
   * 纯函数：不修改全局 s.filterGroups，返回包含本次更新的副本，避免被调用方的 setState 覆盖
   * 修复用户反馈"点击 + 添加，旧的分组内容没有了"的根因：
   *   此前实现直接修改 s.filterGroups[idx]，但 createGroup 又以副本 list 重新 setState，
   *   导致步骤 1 的保存被步骤 3 的 setState({filterGroups: list}) 覆盖
   * @returns {Array} 更新后的 filterGroups 副本
   */
  _saveCurrentIntoActiveGroup: () => {
    const s = StateManager._state;
    const list = (s.filterGroups || []).slice();
    if (!s.currentGroupId) return list;
    const idx = list.findIndex(g => g && g.id === s.currentGroupId);
    if (idx < 0) return list;
    list[idx] = Object.assign({}, list[idx], FilterGroup._captureSnapshot());
    return list;
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
   * 行为（按用户需求 2026-06-20 演进 v3）：
   *   a) 保存当前 div 的筛选方案配置（含所有筛选条件、参数、选项）→ 写回当前激活分组（现有分组保留）
   *   b) 创建并应用一个新的筛选方案（仅新创建的分组初始化为空状态）→ 不包含任何筛选方案
   *   c) 切换激活到新分组，UI 显示空状态（filterList 显示"暂无保存的方案"）
   *   + 修复：_saveCurrentIntoActiveGroup 改为返回副本，避免步骤 3 的 setState 覆盖步骤 1 的保存
   *   + 首次创建分组时（之前无 currentGroupId），同步清空 SAVED_FILTERS 避免孤儿数据
   * @param {string} [name] - 用户输入名称；空则使用默认"分组一"
   */
  createGroup: (name) => {
    const s = StateManager._state;
    const finalName = (typeof name === 'string' && name.trim()) ? name.trim() : FilterGroup._genDefaultName();
    const isFirstGroup = !s.currentGroupId;
    const newId = 'g_' + Date.now() + '_' + Math.floor(Math.random() * 1000);

    // 步骤 1 (a)：保存当前完整状态到原激活分组（现有分组保留其包含的筛选方案）
    //   返回包含步骤 1 更新的 filterGroups 副本，后续 push 新分组后再 setState
    const newList = FilterGroup._saveCurrentIntoActiveGroup();

    // 步骤 2 (c)：创建新分组 - 严格遵循"仅新创建的分组才初始化为空状态"
    //   新分组的快照为默认初始（savedFilters=[], selected=14个[], excluded=[], locked={} 等）
    const newGroup = {
      id: newId,
      name: finalName,
      createdAt: Date.now(),
      ...FilterGroup._defaultSnapshot()
    };
    newList.push(newGroup);

    // 步骤 3：切换激活 + 重置 state 为新分组的默认初始（让 UI 显示空状态）
    StateManager.setState({
      filterGroups: newList,
      currentGroupId: newId,
      ...FilterGroup._defaultSnapshot()
    }, false);

    // 首次创建分组时清空 SAVED_FILTERS（避免原方案成为孤儿数据）
    if (isFirstGroup) {
      Storage.remove(Storage.KEYS.SAVED_FILTERS);
    }

    FilterGroup._persistGroups();
    Render.renderFilterList();
    Render.renderAll(); // 重新渲染结果区、标签状态、排除号码网格等
    // 委托视图层同步 DOM 控件（业务层不直接操作 DOM）
    if (typeof ViewFilterGroup !== 'undefined') {
      ViewFilterGroup.render();
      ViewFilterGroup.syncLockExcludeUI(false);
    }
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

    // 步骤 1：把当前完整状态写回原激活分组（接收返回的副本，保证步骤 2 setState 不丢失步骤 1 的保存）
    const newList = FilterGroup._saveCurrentIntoActiveGroup();

    // 步骤 2：加载目标分组到 state（用 newList 保持一致引用）
    StateManager.setState({ filterGroups: newList, currentGroupId: groupId }, false);
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
      let switchToName = null;
      if (isCurrent) {
        const next = newList[0];
        switchToName = next.name;
        StateManager.setState({ filterGroups: newList, currentGroupId: next.id }, false);
        FilterGroup._applySnapshot(next);
      } else {
        // 删除非当前分组：无需特殊处理
        StateManager.setState({ filterGroups: newList }, false);
      }
      FilterGroup._persistGroups();
      Render.renderFilterList();
      if (typeof ViewFilterGroup !== 'undefined') ViewFilterGroup.render();
      // 提示文案：当前激活分组被删除时告知用户已自动切换到哪个分组
      const msg = switchToName
        ? '已删除分组：' + target.name + '，已切换到：' + switchToName
        : '已删除分组：' + target.name;
      Toast.show(msg);
    });
  }
};

// 挂载到 Business 命名空间下（保持与其他业务模块一致）
Object.assign(Business, { FilterGroup });