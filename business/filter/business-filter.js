/**
 * 【业务层】方案管理相关逻辑
 * 从 business-main.js 拆分出来（v2.0.9）
 * 
 * 职责：
 * - 保存方案（普通/生肖）
 * - 加载方案
 * - 重命名/删除/置顶方案
 * - 锁定/解锁方案
 * - 复制方案号码
 */
const BusinessFilter = {
  /**
   * 提交保存方案（内部辅助函数）
   * @private
   */
  _commitSaveFilter: (filterItem, rawName, finalName, successMsg) => {
    const success = Storage.saveFilter(filterItem);
    if(success) {
      Toast.show(`${successMsg}：${finalName}`);
    } else {
      Toast.show('保存失败，请重试');
    }
  },
  
  /**
   * 保存方案弹窗
   */
  saveFilterPrompt: () => {
    const state = StateManager._state;
    if (state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT) {
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    // 默认名用"最大编号+1"避免与现存方案冲突
    const defaultName = Utils.nextDefaultName(state.savedFilters);
    
    if (typeof GIONGBETA_INPUT_MODAL === 'undefined') {
      console.error('输入模态框未加载');
      return;
    }
    
    GIONGBETA_INPUT_MODAL.show('请输入方案名称', '请输入方案名称', defaultName, (name) => {
      if (name === null) return;
      const rawName = (name.trim() || defaultName).slice(0, 20);
      // 智能去重（已存在同名则自动追加 " (2)" 后缀）
      const filterName = Utils.ensureUniqueName(rawName, state.savedFilters);
      
      const filterItem = {
        name: filterName,
        selected: Utils.deepClone(state.selected),
        excluded: Utils.deepClone(state.excluded),
        locked: Utils.deepClone(state.locked),
        lockedScheme: false
      };
      
      BusinessFilter._commitSaveFilter(filterItem, rawName, filterName, '保存成功');
    });
  },
  
  /**
   * 保存生肖方案弹窗
   */
  saveZodiacFilterPrompt: () => {
    const state = StateManager._state;
    if (state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT) {
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    const selectedZodiacs = (state.selected && state.selected.zodiac) ? state.selected.zodiac : [];
    const lockedZodiacs = (state.locked && state.locked.zodiac) ? state.locked.zodiac : [];
    const markedMap = (state.marked && state.marked.zodiac) ? state.marked.zodiac : {};
    
    if (selectedZodiacs.length === 0 && lockedZodiacs.length === 0 && Object.keys(markedMap).length === 0) {
      Toast.show('请先选择、标记或锁定生肖');
      return;
    }

    const count = selectedZodiacs.length + lockedZodiacs.length + Object.keys(markedMap).length;
    const defaultName = Utils.nextDefaultName(state.savedFilters, '生肖方案');
    
    if (typeof GIONGBETA_INPUT_MODAL === 'undefined') {
      console.error('输入模态框未加载');
      return;
    }
    
    GIONGBETA_INPUT_MODAL.show('请输入生肖方案名称', '请输入生肖方案名称', defaultName, (name) => {
      if (name === null) return;
      const rawName = (name.trim() || defaultName).slice(0, 20);
      const filterName = Utils.ensureUniqueName(rawName, state.savedFilters);
      
      // 仅保存 zodiac 维度的选择 / 锁定 / 标记
      const filterItem = {
        name: filterName,
        selected: { zodiac: Utils.deepClone(selectedZodiacs) },
        excluded: [],
        locked: lockedZodiacs.length > 0 ? { zodiac: Utils.deepClone(lockedZodiacs) } : {},
        marked: Object.keys(markedMap).length > 0 ? { zodiac: Utils.deepClone(markedMap) } : {},
        scope: 'zodiac',
        lockedScheme: false
      };
      
      BusinessFilter._commitSaveFilter(filterItem, rawName, filterName, `已保存生肖方案（${count}肖）`);
    });
  },
  
  /**
   * 加载保存的方案
   * @param {number} index - 方案索引
   */
  loadFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if (!item) return;

    if (item.scope === 'zodiac') {
      // 生肖方案：仅合并 zodiac 维度
      const newSelected = { ...state.selected };
      const newLocked = { ...state.locked };
      const newMarked = { ...state.marked };
      
      if (item.selected && item.selected.zodiac) {
        newSelected.zodiac = Utils.deepClone(item.selected.zodiac);
      }
      if (item.locked && item.locked.zodiac) {
        newLocked.zodiac = Utils.deepClone(item.locked.zodiac);
      }
      if (item.marked && item.marked.zodiac) {
        newMarked.zodiac = Utils.deepClone(item.marked.zodiac);
      }
      
      StateManager.setState({
        selected: newSelected,
        locked: newLocked,
        marked: newMarked
      });
      
      Toast.show(`已加载生肖方案：${item.name}`);
    } else {
      // 普通方案：完整覆盖
      const newState = {
        selected: Utils.deepClone(item.selected || {}),
        excluded: Utils.deepClone(item.excluded || []),
        locked: Utils.deepClone(item.locked || {}),
        marked: Utils.deepClone(item.marked || {}),
        markCount: Utils.deepClone(item.markCount || {})
      };
      
      StateManager.setState(newState);
      Toast.show(`已加载方案：${item.name}`);
    }
  },
  
  /**
   * 重命名方案
   * @param {number} index - 方案索引
   */
  renameFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if (!item) return;

    if (typeof GIONGBETA_INPUT_MODAL === 'undefined') {
      console.error('输入模态框未加载');
      return;
    }
    
    GIONGBETA_INPUT_MODAL.show('重命名方案', '请输入新名称', item.name, (newName) => {
      if (newName === null) return;
      const trimmedName = newName.trim();
      if (!trimmedName) {
        Toast.show('名称不能为空');
        return;
      }

      const uniqueName = Utils.ensureUniqueName(trimmedName.slice(0, 20), state.savedFilters, index);
      const newList = [...state.savedFilters];
      newList[index] = { ...newList[index], name: uniqueName };
      
      Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      StateManager.setState({ savedFilters: newList });
      Toast.show(`已重命名为：${uniqueName}`);
    });
  },
  
  /**
   * 删除方案
   * @param {number} index - 方案索引
   */
  deleteFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if (!item) return;

    if (typeof GIONGBETA_CONFIRM_MODAL === 'undefined') {
      console.error('确认模态框未加载');
      return;
    }
    
    GIONGBETA_CONFIRM_MODAL.show('确认删除', `确定要删除方案"${item.name}"吗？`, () => {
      const newList = state.savedFilters.filter((_, i) => i !== index);
      Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      StateManager.setState({ savedFilters: newList });
      Toast.show('已删除方案');
    });
  },
  
  /**
   * 置顶方案
   * @param {number} index - 方案索引
   */
  topFilter: (index) => {
    const state = StateManager._state;
    if (index === 0) {
      Toast.show('已在顶部');
      return;
    }

    const newList = [...state.savedFilters];
    const [item] = newList.splice(index, 1);
    newList.unshift(item);
    
    Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    StateManager.setState({ savedFilters: newList });
    Toast.show('已置顶方案');
  },
  
  /**
   * 切换方案锁定状态
   * @param {number} index - 方案索引
   */
  toggleLockFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if (!item) return;

    const newList = [...state.savedFilters];
    newList[index] = {
      ...newList[index],
      lockedScheme: !newList[index].lockedScheme
    };
    
    Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    StateManager.setState({ savedFilters: newList });
    Toast.show(newList[index].lockedScheme ? '已锁定方案' : '已解锁方案');
  },
  
  /**
   * 复制方案号码到剪贴板
   * @param {number} index - 方案索引
   */
  copyFilterNums: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if (!item) return;

    // 计算该方案筛选后的号码
    const tempState = {
      selected: item.selected || {},
      excluded: item.excluded || [],
      locked: item.locked || {}
    };
    
    const filteredList = Filter.getFilteredListWithState(tempState);
    const nums = filteredList.map(item => item.num).join(', ');
    
    if (typeof Platform !== 'undefined' && Platform.copyToClipboard) {
      Platform.copyToClipboard(nums);
    } else {
      // 降级方案
      const textarea = document.createElement('textarea');
      textarea.value = nums;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }
    
    Toast.show(`已复制 ${filteredList.length} 个号码`);
  },
  
  /**
   * 清空所有保存的方案
   */
  clearAllSavedFilters: () => {
    const state = StateManager._state;
    if (state.savedFilters.length === 0) {
      Toast.show('暂无保存的方案');
      return;
    }

    if (typeof GIONGBETA_CONFIRM_MODAL === 'undefined') {
      console.error('确认模态框未加载');
      return;
    }
    
    GIONGBETA_CONFIRM_MODAL.show('确认清空', '确定要清空所有保存的方案吗？此操作不可恢复！', () => {
      Storage.set(Storage.KEYS.SAVED_FILTERS, []);
      StateManager.setState({ savedFilters: [] });
      Toast.show('已清空所有方案');
    });
  }
};
