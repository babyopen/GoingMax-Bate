const Filter = {
  /**
   * 通用筛选函数
   * @param {Object|null} selected - 选中的筛选条件
   * @param {Array|null} excluded - 排除的号码
   * @returns {Array} 筛选后的号码列表
   */
  getFilteredList: (selected = null, excluded = null) => {
    try {
      const state = StateManager._state;
      const targetSelected = selected || state.selected;
      const targetExcluded = excluded || state.excluded;
      const numList = state.numList;

      return numList.filter(item => {
        // 排除号码
        if(targetExcluded.includes(item.num)) return false;
        // 锁定标签对应的号码也排除
        for(const group in state.locked){
          if(state.locked[group].length && state.locked[group].includes(item[group])) return false;
        }
        // 遍历所有筛选条件
        for(const group in targetSelected){
          if(targetSelected[group].length && !targetSelected[group].includes(item[group])) return false;
        }
        return true;
      });
    } catch(e) {
      console.error('筛选失败', e);
      return [];
    }
  },

  /**
   * 全选所有筛选条件（防抖优化）
   */
  selectAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    Object.keys(state.selected).forEach(group => StateManager.selectGroup(group));
    Toast.show('已全选所有筛选条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY),

  /**
   * 清除所有筛选条件（防抖优化）
   */
  clearAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    Object.keys(state.selected).forEach(group => StateManager.resetGroup(group));
    StateManager.setState({
      excluded: [],
      excludeHistory: [],
      lockExclude: false,
      marked: {},
      locked: {},
      markCount: {}
    });
    // 更新复选框
    DOM.lockExclude.checked = false;
    Toast.show('已清除所有筛选与排除条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY)
};
