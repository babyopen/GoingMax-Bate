const StateManager = {
  /**
   * 私有状态对象
   * @private
   */
  _state: {
    selected: {
      zodiac:[], color:[], colorsx:[], type:[], element:[],
      head:[], tail:[], sum:[], sumOdd:[], sumSize:[], tailSize:[], bs:[], hot:[],
      num:[]
    },
    excluded: [],
    excludeHistory: [],
    lockExclude: false,
    savedFilters: [],
    showAllFilters: false,
    marked: {},
    locked: {},
    markCount: {},
    numList: [],
    currentZodiac: '',
    zodiacCycle: [],
    scrollTimer: null,
    // 分析模块状态
    analysis: {
      historyData: [],
      historyTimestamp: 0,
      analyzeLimit: 12,
      selectedNumCount: 5,
      showCount: 20,
      currentTab: 'history',
      autoRefreshTimer: null
    }
  },

  /**
   * 获取只读状态快照
   * @returns {Object} 状态快照
   */
  getState: () => Utils.deepClone(StateManager._state),

  /**
   * 渲染队列：批量处理连续更新，避免频繁重渲染
   * @private
   */
  _renderQueue: null,
  _renderTimer: null,

  /**
   * 统一更新状态入口（性能优化版）
   * @param {Object} partialState - 要更新的部分状态
   * @param {boolean} needRender - 是否自动触发渲染（默认true）
   * @param {boolean} immediate - 是否立即渲染（默认false，使用防抖优化）
   */
  setState: (partialState, needRender = true, immediate = false) => {
    try {
      StateManager._state = {
        ...StateManager._state,
        ...partialState
      };

      if(needRender) {
        if(immediate) {
          Render.renderAll();
        } else {
          if(!StateManager._renderQueue) StateManager._renderQueue = [];
          StateManager._renderQueue.push(Date.now());

          if(StateManager._renderTimer) clearTimeout(StateManager._renderTimer);
          StateManager._renderTimer = setTimeout(() => {
            Render.renderAll();
            StateManager._renderQueue = null;
          }, 16); // 约60fps，合并同一帧内的多次更新
        }
      }
    } catch(e) {
      console.error('状态更新失败', e);
      Toast.show('操作失败，请刷新重试');
    }
  },

  /**
   * 强制立即渲染（清空渲染队列）
   */
  flushRender: () => {
    if(StateManager._renderTimer) {
      clearTimeout(StateManager._renderTimer);
      StateManager._renderTimer = null;
    }
    if(StateManager._renderQueue && StateManager._renderQueue.length > 0) {
      Render.renderAll();
      StateManager._renderQueue = null;
    }
  },

  /**
   * 更新选中的筛选条件
   * @param {string} group - 分组名
   * @param {string|number} value - 选中的值
   */
  updateSelected: (group, value) => {
    const state = StateManager._state;
    const lockedList = state.locked[group] || [];
    if (lockedList.includes(value)) return;
    const index = state.selected[group].indexOf(value);
    const newSelected = { ...state.selected };
    
    index > -1 
      ? newSelected[group] = newSelected[group].filter(item => item !== value)
      : newSelected[group] = [...newSelected[group], value];

    StateManager.setState({ selected: newSelected });
  },

  /**
   * 重置分组选中状态
   * @param {string} group - 分组名
   */
  resetGroup: (group) => {
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = [];
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 标记槽位：6次标记，每次固定颜色+固定位置
   * 第1次: 红-左上, 第2次: 橙-左中, 第3次: 绿-左下
   * 第4次: 紫-右上, 第5次: 翠蓝-右中, 第6次: 紫罗兰-右下
   */
  MARK_SLOTS: [
    { color: '#FF3B30', left: '5px', top: '3px' },
    { color: '#FF9500', left: '5px', top: '50%', marginTop: '-2px' },
    { color: '#34C759', left: '5px', bottom: '3px' },
    { color: '#AF52DE', right: '5px', top: '3px' },
    { color: '#5AC8FA', right: '5px', top: '50%', marginTop: '-2px' },
    { color: '#7B2D8E', right: '5px', bottom: '3px' },
    // 新增槽位（兼容路径：在原 6 个槽位之后追加，扩展为 9 次标记）
    { color: '#FF2D55', left: '50%', top: '3px', marginLeft: '-3px' },
    { color: '#FFCC00', left: '50%', top: '50%', marginLeft: '-3px', marginTop: '-3px' },
    { color: '#007AFF', left: '50%', bottom: '3px', marginLeft: '-3px' },
  ],

  /**
   * 标记选中项：给当前选中的标签添加标记圆点，同时清除选中
   * @param {string} group - 分组名
   */
  markGroup: (group) => {
    const state = StateManager._state;
    const selected = state.selected[group];
    if (!selected.length) return;

    const currentCount = state.markCount[group] || 0;
    if (currentCount >= StateManager.MARK_SLOTS.length) return;

    const slotIndex = currentCount;
    const newMarked = { ...state.marked };
    if (!newMarked[group]) newMarked[group] = {};

    selected.forEach(value => {
      const key = String(value);
      if (!newMarked[group][key]) newMarked[group][key] = [];
      newMarked[group][key].push(slotIndex);
    });

    const newSelected = { ...state.selected };
    newSelected[group] = [];

    const newMarkCount = { ...state.markCount };
    newMarkCount[group] = currentCount + 1;

    StateManager.setState({
      selected: newSelected,
      marked: newMarked,
      markCount: newMarkCount
    });
  },

  /**
   * 清除分组：仅清除选中项，保留标记
   * @param {string} group - 分组名
   */
  clearGroup: (group) => {
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = [];
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 清除分组的所有标记（仅清除标记，保留选中项）
   * @param {string} group - 分组名（支持多分组用逗号分隔）
   */
  clearGroupMarks: (group) => {
    const groups = group.split(',');
    const newMarked = { ...StateManager._state.marked };
    const newMarkCount = { ...StateManager._state.markCount };
    groups.forEach(g => {
      delete newMarked[g];
      delete newMarkCount[g];
    });
    StateManager.setState({ marked: newMarked, markCount: newMarkCount });
  },

  /**
   * 锁定/解锁分组：选中项→锁定(变红，不参与筛选)；已锁定时→解锁
   * @param {string} group - 分组名
   */
  lockGroup: (group) => {
    const state = StateManager._state;
    const selected = state.selected[group] || [];
    const newLocked = { ...state.locked };
    const currentLocked = newLocked[group] || [];

    if (selected.length > 0) {
      newLocked[group] = [...currentLocked, ...selected];
      const newSelected = { ...state.selected };
      newSelected[group] = [];
      StateManager.setState({ selected: newSelected, locked: newLocked });
    } else if (currentLocked.length > 0) {
      delete newLocked[group];
      StateManager.setState({ locked: newLocked });
    }
  },

  /**
   * 切换单个标签的锁定状态
   * @param {string} group - 分组名
   * @param {string} value - 标签值
   */
  toggleTagLock: (group, value) => {
    const state = StateManager._state;
    const newLocked = { ...state.locked };
    const currentLocked = newLocked[group] || [];
    const index = currentLocked.indexOf(value);

    if (index > -1) {
      currentLocked.splice(index, 1);
      if (currentLocked.length === 0) {
        delete newLocked[group];
      } else {
        newLocked[group] = currentLocked;
      }
    } else {
      newLocked[group] = [...currentLocked, value];
      const newSelected = { ...state.selected };
      const selectedList = newSelected[group] || [];
      const selectedIndex = selectedList.indexOf(value);
      if (selectedIndex > -1) {
        selectedList.splice(selectedIndex, 1);
        newSelected[group] = selectedList;
        StateManager.setState({ selected: newSelected, locked: newLocked });
        return;
      }
    }

    StateManager.setState({ locked: newLocked });
  },

  /**
   * 全选分组
   * @param {string} group - 分组名
   * @param {Array} [allValues] - 可选：从视图层传入的所有标签值数组（符合分层规范）
   */
  selectGroup: (group, allValues) => {
    // 兼容路径：使用内部辅助 _getAvailableValues + _setSelected 消除重复代码（行为等价）
    const values = StateManager._getAvailableValues(group, allValues);
    StateManager._setSelected(group, values);
  },

  /**
   * 反选分组
   * @param {string} group - 分组名
   * @param {Array} [allValues] - 可选：从视图层传入的所有标签值数组（符合分层规范）
   */
  invertGroup: (group, allValues) => {
    // 兼容路径：使用内部辅助 _getAvailableValues + _setSelected 消除重复代码（行为等价）
    const values = StateManager._getAvailableValues(group, allValues);
    const currentSelected = StateManager._state.selected[group] || [];
    StateManager._setSelected(group, values.filter(v => !currentSelected.includes(v)));
  },

  /**
   * 清理所有定时器，避免内存泄漏（包含渲染队列清理）
   */
  clearAllTimers: () => {
    const state = StateManager._state;
    if(state.scrollTimer) clearTimeout(state.scrollTimer);
    if(StateManager._renderTimer) {
      clearTimeout(StateManager._renderTimer);
      StateManager._renderTimer = null;
      StateManager._renderQueue = null;
    }
    Toast.clearTimer();
  },

  // ============================================================
  // 兼容路径：内部辅助方法（消除 selectGroup / invertGroup 等的重复模板）
  // ============================================================

  /**
   * 内部辅助：把 values 写入到 selected[group] 并 setState
   * 用于消除 6+ 处"const newSelected = { ...state.selected }; newSelected[group] = ...; setState(...)"模板
   * @param {string} group
   * @param {Array} values
   */
  _setSelected: (group, values) => {
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = values;
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 内部辅助：从 allValues 或 DOM 中提取"非锁定"的所有标签值
   * 兼容路径：selectGroup / invertGroup 等的公共查询逻辑
   * @param {string} group
   * @param {Array} [allValues] - 可选：调用方已准备好的标签值数组
   * @returns {Array}
   */
  _getAvailableValues: (group, allValues) => {
    const lockedSet = new Set(StateManager._state.locked[group] || []);
    if (allValues && Array.isArray(allValues)) {
      return allValues.filter(v => !lockedSet.has(v));
    }
    // 兼容路径：使用 Utils.getTagValues 消除重复 querySelectorAll
    if (typeof Utils !== 'undefined' && typeof Utils.getTagValues === 'function') {
      return Utils.getTagValues(group).filter(v => !lockedSet.has(v));
    }
    // 兜底：原 inline 实现（保证 Utils 未加载时也能工作）
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    return allTags
      .map(tag => Utils.formatTagValue(tag.dataset.value, group))
      .filter(v => !lockedSet.has(v));
  }
};
