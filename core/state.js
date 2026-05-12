const StateManager = {
  /**
   * 私有状态对象
   * @private
   */
  _state: {
    selected: {
      zodiac:[], color:[], colorsx:[], type:[], element:[],
      head:[], tail:[], sum:[], sumOdd:[], sumSize:[], tailSize:[], bs:[], hot:[]
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
      analyzeLimit: 30,
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
   * 统一更新状态入口
   * @param {Object} partialState - 要更新的部分状态
   * @param {boolean} needRender - 是否自动触发渲染
   */
  setState: (partialState, needRender = true) => {
    try {
      StateManager._state = {
        ...StateManager._state,
        ...partialState
      };
      if(needRender) Render.renderAll();
    } catch(e) {
      console.error('状态更新失败', e);
      Toast.show('操作失败，请刷新重试');
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
   * 清除分组：清除选中 + 清除标记
   * @param {string} group - 分组名
   */
  clearGroup: (group) => {
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = [];
    const newMarked = { ...StateManager._state.marked };
    delete newMarked[group];
    StateManager.setState({ selected: newSelected, marked: newMarked });
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
   * 全选分组
   * @param {string} group - 分组名
   */
  selectGroup: (group) => {
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    const lockedSet = new Set(StateManager._state.locked[group] || []);
    const allValues = allTags
      .map(tag => Utils.formatTagValue(tag.dataset.value, group))
      .filter(v => !lockedSet.has(v));
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = allValues;
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 反选分组
   * @param {string} group - 分组名
   */
  invertGroup: (group) => {
    const state = StateManager._state;
    const lockedSet = new Set(state.locked[group] || []);
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    const allValues = allTags
      .map(tag => Utils.formatTagValue(tag.dataset.value, group))
      .filter(v => !lockedSet.has(v));
    const newSelected = { ...state.selected };
    newSelected[group] = allValues.filter(v => !state.selected[group].includes(v));
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 清理所有定时器，避免内存泄漏
   */
  clearAllTimers: () => {
    const state = StateManager._state;
    if(state.scrollTimer) clearTimeout(state.scrollTimer);
    Toast.clearTimer();
  }
};
