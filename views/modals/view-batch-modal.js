/**
 * 视图层：批量选择弹窗（拆分自 view-filter.js，2026-06-05）
 * @namespace ViewBatchModal
 * 包含：adjustModalPosition / showBatchModal / closeBatchModal / confirmBatchSelect
 * 依赖：Toast / StateManager / CONFIG / Utils
 *
 * 拆分原则（只新增不破坏）：
 * - 原 ViewFilter.xxx() 调用方式完全保留（通过文件末尾的 Object.assign 挂载）
 * - _batchTargetGroups 状态从 view-filter.js 搬入此处（仅 batch-modal 相关）
 * - 内部实现保持与拆分前等价（含之前接入的 SPLIT_TOKEN_REGEX / isValidLotteryNum /
 *   mergeUnique / getTagValues / StateManager._setSelected 等兼容路径）
 */
const ViewBatchModal = {
  /**
   * 批量选择弹窗相关状态
   */
  _batchTargetGroups: [],

  /**
   * 调整弹窗位置（避开键盘）
   */
  adjustModalPosition: () => {
    const modal = document.getElementById('batchModal');
    const container = modal?.querySelector('.batch-modal-content');
    const input = document.getElementById('batchModalInput');
    if (!modal?.classList.contains('show')) return;
    if (!container || !input) return;

    const viewportHeight = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    const inputRect = input.getBoundingClientRect();
    const inputBottom = inputRect.bottom;

    if (inputBottom > viewportHeight - 20) {
      const offset = inputBottom - (viewportHeight - 20);
      const maxOffset = container.offsetHeight * 0.6;
      const translateY = -Math.min(offset, maxOffset);
      container.style.transform = `translateY(${translateY}px)`;
    } else {
      container.style.transform = 'translateY(0)';
    }
  },

  /**
   * 显示批量选择弹窗
   * @param {string} groups - 逗号分隔的组名
   */
  showBatchModal: (groups) => {
    const modal = document.getElementById('batchModal');
    const input = document.getElementById('batchModalInput');
    const title = document.getElementById('batchModalTitle');
    const hint = modal?.querySelector('.batch-modal-hint');
    const container = modal?.querySelector('.batch-modal-content');
    if (!modal || !input) return;
    ViewFilter._batchTargetGroups = groups ? groups.split(',') : [];
    // 根据分组设置不同的提示
    const group = ViewFilter._batchTargetGroups[0];
    const groupNames = {
      'num': '号码选择',
      'zodiac': '生肖',
      'color,colorsx': '波色',
      'type': '属性',
      'element': '五行',
      'head': '头数',
      'tail': '尾数',
      'sum': '尾合',
      'bs,sumOdd,sumSize,tailSize': '大小',
      'hot': '热号',
      'exclude': '号码排除'
    };
    const groupPlaceholders = {
      'num': '例如：01 02 03 或 1-5',
      'zodiac': '例如：马 牛 虎 或 龙 蛇',
      'color,colorsx': '例如：红 蓝 绿 或 红单 蓝双',
      'type': '例如：家禽 野兽',
      'element': '例如：金 木 水 火 土',
      'head': '例如：0 1 2 3 4',
      'tail': '例如：0 1 2 3 4 5 6 7 8 9',
      'sum': '例如：01 02 03 04 05',
      'bs,sumOdd,sumSize,tailSize': '例如：大单 小双 合单 合大',
      'hot': '例如：热号 温号 冷号',
      'exclude': '例如：1 2 3 或 01-10'
    };
    // 排除组特殊处理
    const groupName = groupNames[group] || '选择';
    if (group === 'exclude') {
      if (title) title.textContent = `批量${groupName}`;
      if (hint) hint.textContent = '输入要排除的号码，支持多种分隔符';
      input.placeholder = groupPlaceholders['exclude'];
    } else {
      const placeholder = groupPlaceholders[group] || '例如：马 牛 虎';
      if (title) title.textContent = `批量选择${groupName}`;
      if (hint) hint.textContent = '输入要选择的名称，支持多种分隔符';
      input.placeholder = placeholder;
    }
    modal.classList.add('show');
    if (container) container.style.transform = 'translateY(0)';
    input.value = '';
    setTimeout(() => {
      input.focus();
      setTimeout(() => ViewFilter.adjustModalPosition(), 150);
    }, 100);
  },

  /**
   * 关闭批量选择弹窗
   */
  closeBatchModal: () => {
    const modal = document.getElementById('batchModal');
    const input = document.getElementById('batchModalInput');
    const container = modal?.querySelector('.batch-modal-content');
    if (input) input.blur();
    if (modal) modal.classList.remove('show');
    if (container) container.style.transform = 'translateY(0)';
  },

  /**
   * 确认批量选择
   */
  confirmBatchSelect: () => {
    const input = document.getElementById('batchModalInput');
    if (!input) return;
    const raw = input.value.trim();
    if (!raw) {
      Toast.show('请输入要选择的名称');
      return;
    }
    // 号码排除组特殊处理
    const groups = ViewFilter._batchTargetGroups;
    if (groups.length === 1 && groups[0] === 'exclude') {
      // 提取号码，支持多种分隔符（兼容路径：使用 Utils.SPLIT_TOKEN_REGEX 常量）
      const nums = raw.split(Utils.SPLIT_TOKEN_REGEX).map(Number).filter(Utils.isValidLotteryNum);
      // 兼容路径：从原始文本兜底提取所有数字（不破坏原有 split 逻辑）
      // 支持"蛇02.14.26"等汉字+数字混合格式
      const _rawNums = (raw.match(/\d+/g) || []).map(Number).filter(Utils.isValidLotteryNum);
      // 兼容路径：使用 Utils.mergeUnique 消除去重合并模板
      Utils.mergeUnique(nums, _rawNums).forEach(n => {
        if (!nums.includes(n)) nums.push(n);
      });
      if (nums.length === 0) {
        Toast.show('请输入有效的号码(1-49)');
        return;
      }
      const state = StateManager._state;
      if (state.lockExclude) {
        ViewFilter.closeBatchModal();
        Toast.show('已锁定排除号码');
        return;
      }
      const newExcluded = [...state.excluded];
      const newHistory = [...state.excludeHistory];
      let count = 0;
      nums.forEach(num => {
        if (!newExcluded.includes(num)) { newExcluded.push(num); newHistory.push([num, 'in']); count++; }
      });
      StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
      ViewFilter.closeBatchModal();
      Toast.show(`已排除 ${count} 个号码`);
      return;
    }
    // 普通标签组处理
    let names = raw.split(Utils.SPLIT_TOKEN_REGEX).filter(Boolean);
    if (names.length === 0) {
      Toast.show('未识别到有效名称');
      return;
    }
    // 兼容路径：从原始文本中兜底提取所有数字
    // 支持"蛇02.14.26〕〔鼠07.31.43"等汉字+数字混合格式（不破坏原有 split 逻辑）
    const _isFirstGroupNum = CONFIG.NUMBER_GROUPS.includes(ViewFilter._batchTargetGroups[0]);
    if (_isFirstGroupNum) {
      const _extraNumStrs = (raw.match(/\d+/g) || [])
        .map(n => String(Number(n)))  // 归一化：02 -> 2
        .filter(n => { const _num = Number(n); return _num >= 1 && _num <= 49; });
      // 兼容路径：使用 Utils.mergeUnique 消除去重合并模板
      Utils.mergeUnique(names, _extraNumStrs).forEach(n => {
        if (!names.includes(n)) names.push(n);
      });
    }
    // 对每个目标组执行批量选择
    let totalMatched = 0;
    const unmatchedNames = [];
    ViewFilter._batchTargetGroups.forEach(group => {
      // 兼容路径：使用 Utils.getTagValues 消除 querySelectorAll + formatTagValue 重复
      const allTagValues = Utils.getTagValues(group);
      const lockedSet = new Set(StateManager._state.locked[group] || []);
      const isNumGroup = CONFIG.NUMBER_GROUPS.includes(group);
      const matched = allTagValues
        .filter(v => {
          if (lockedSet.has(v)) return false;
          if (isNumGroup) {
            const numVal = Number(v);
            return names.some(n => {
              const targetNum = Number(n);
              return !isNaN(targetNum) && targetNum === numVal;
            });
          }
          return names.some(n => v.includes(n) || n.includes(v));
        });
      totalMatched = matched.length;
      // 兼容路径：使用 StateManager._setSelected 消除 setState 模板
      StateManager._setSelected(group, matched);
    });
    // 检查未匹配的名称
    const allTagValues = [];
    ViewFilter._batchTargetGroups.forEach(group => {
      // 兼容路径：使用 Utils.getTagValues 消除 querySelectorAll + formatTagValue 重复
      Utils.getTagValues(group).forEach(val => {
        allTagValues.push(String(val));
      });
    });
    names.forEach(name => {
      const nameStr = String(name).trim();
      const isMatched = allTagValues.some(tagVal =>
        tagVal.includes(nameStr) || nameStr.includes(tagVal) ||
        (CONFIG.NUMBER_GROUPS.includes(ViewFilter._batchTargetGroups[0]) && Number(nameStr) === Number(tagVal))
      );
      if (!isMatched && nameStr) {
        unmatchedNames.push(nameStr);
      }
    });
    // 兼容路径：清理 unmatchedNames 中的纯数字 token
    // non-num 组（如生肖、波色）中的纯数字 token 不是标签名，不应被报为"未识别"
    if (!CONFIG.NUMBER_GROUPS.includes(ViewFilter._batchTargetGroups[0])) {
      for (let i = unmatchedNames.length - 1; i >= 0; i--) {
        if (/^\d+$/.test(unmatchedNames[i])) {
          unmatchedNames.splice(i, 1);
        }
      }
    }
    // 关闭弹窗并提示
    ViewFilter.closeBatchModal();
    if (unmatchedNames.length > 0) {
      Toast.show(`已选择 ${totalMatched} 个，无法识别：${unmatchedNames.join(', ')}`);
    } else {
      Toast.show(`已选择 ${names.length} 个名称`);
    }
  }
};

// 兼容路径：挂载到 ViewFilter，使 event.js 中 ViewFilter.xxx() 调用不变
if (typeof ViewFilter !== 'undefined' && ViewFilter) {
  Object.assign(ViewFilter, ViewBatchModal);
}
