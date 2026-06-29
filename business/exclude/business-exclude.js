/**
 * 【业务层】排除号码相关逻辑
 * 从 business-main.js 拆分出来（v2.0.9）
 * 
 * 职责：
 * - 号码排除/恢复
 * - 反选排除
 * - 撤销操作
 * - 清空排除
 * - 锁定排除状态
 */
const BusinessExclude = {
  /**
   * 切换号码排除状态
   * @param {number} num - 号码 (1-49)
   */
  toggleExclude: (num) => {
    const state = StateManager._state;
    if (state.lockExclude) return;
    
    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];
    
    if (newExcluded.includes(num)) {
      // 恢复已排除的号码
      newHistory.push([num, 'out']);
      const index = newExcluded.indexOf(num);
      newExcluded.splice(index, 1);
    } else {
      // 排除新号码
      newHistory.push([num, 'in']);
      newExcluded.push(num);
    }
    
    StateManager.setState({ 
      excluded: newExcluded, 
      excludeHistory: newHistory 
    });
  },
  
  /**
   * 反选排除号码（已排除的恢复，未排除的排除）
   */
  invertExclude: () => {
    const state = StateManager._state;
    if (state.lockExclude) return;
    
    const allNums = Array.from({ length: 49 }, (_, i) => i + 1);
    const newExcluded = [];
    const newHistory = [...state.excludeHistory];
    
    allNums.forEach(num => {
      const isCurrentlyExcluded = state.excluded.includes(num);
      if (!isCurrentlyExcluded) {
        // 当前未排除的，现在排除
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      } else {
        // 当前已排除的，现在恢复
        newHistory.push([num, 'out']);
      }
    });
    
    StateManager.setState({ 
      excluded: newExcluded, 
      excludeHistory: newHistory 
    });
    Toast.show(`已反选，当前排除 ${newExcluded.length} 个号码`);
  },
  
  /**
   * 撤销上一次排除操作
   */
  undoExclude: () => {
    const state = StateManager._state;
    if (state.lockExclude || !state.excludeHistory.length) return;
    
    const newHistory = [...state.excludeHistory];
    const [num, act] = newHistory.pop();
    const newExcluded = [...state.excluded];
    
    // 反向操作
    act === 'in'
      ? newExcluded.splice(newExcluded.indexOf(num), 1)  // 恢复
      : newExcluded.push(num);                            // 重新排除
    
    StateManager.setState({ 
      excluded: newExcluded, 
      excludeHistory: newHistory 
    });
  },
  
  /**
   * 清空所有排除号码
   */
  clearExclude: () => {
    const state = StateManager._state;
    if (state.lockExclude) return;
    StateManager.setState({ excluded: [], excludeHistory: [] });
  },
  
  /**
   * 切换排除锁定状态
   */
  toggleExcludeLock: () => {
    const state = StateManager._state;
    const newLockState = !state.lockExclude;
    StateManager.setState({ lockExclude: newLockState });
    Toast.show(newLockState ? '已锁定排除' : '已解锁排除');
  }
};
