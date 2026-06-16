const Render = {
  /**
   * 渲染所有视图（状态变化时调用）
   */
  renderAll: () => {
    Render.renderResult();
    Render.renderTagStatus();
    Render.renderExcludeGrid();
  },

  /**
   * 渲染筛选结果（增量优化，用DocumentFragment减少重排）
   */
  renderResult: () => {
    try {
      const state = StateManager._state;
      const filteredList = Filter.getFilteredList();
      
      // 用DocumentFragment优化DOM渲染，减少重排重绘
      const fragment = Utils.createFragment(filteredList, (item) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'num-item';
        wrapper.setAttribute('role', 'listitem');
        wrapper.innerHTML = `<div class="num-ball ${item.color}色">${item.s}</div><div class="tag-zodiac">${item.zodiac}</div>`;
        return wrapper;
      });

      // 一次性更新DOM
      DOM.resultNums.innerHTML = '';
      DOM.resultNums.appendChild(fragment);
      
      // 更新计数
      DOM.resultCount.innerText = filteredList.length;
      DOM.excludeCount.innerText = state.excluded.length;
    } catch(e) {
      console.error('[Render.renderResult] 渲染筛选结果失败:', e);
    }
  },

  /**
   * 增量更新标签选中状态（仅更新对应分组，不重渲染整个DOM）
   * @param {string|null} group - 要更新的分组，不传则更新所有
   */
  renderTagStatus: (group = null) => {
    try {
      const state = StateManager._state;
      const groups = group ? [group] : Object.keys(state.selected);

      const allGroups = new Set(groups);
      Object.keys(state.marked).forEach(g => allGroups.add(g));
      Object.keys(state.locked).forEach(g => allGroups.add(g));
      
      allGroups.forEach(g => {
        const selectedList = state.selected[g] || [];
        const markedMap = state.marked[g] || {};
        const lockedList = state.locked[g] || [];
        document.querySelectorAll(`.tag[data-group="${g}"]`).forEach(tag => {
          const tagValue = Utils.formatTagValue(tag.dataset.value, g);
          const isActive = selectedList.includes(tagValue);
          const isLocked = lockedList.includes(tagValue);
          tag.classList.toggle('active', isActive);
          tag.classList.toggle('locked', isLocked);
          tag.setAttribute('aria-checked', isActive);

          // 处理标记数字徽章（数字=重复标记次数，颜色按次数固定对应 6 色）
          const key = String(tagValue);
          const slotIndices = markedMap[key] || [];
          tag.querySelectorAll('.mark-dot, .mark-badge').forEach(d => d.remove());

          if (slotIndices.length > 0) {
            const slot = StateManager.MARK_SLOTS[slotIndices.length - 1];
            if (slot) {
              const badge = document.createElement('span');
              badge.className = 'mark-badge';
              badge.textContent = String(slotIndices.length);
              badge.style.backgroundColor = slot.color;
              tag.appendChild(badge);
            }
          }
        });

        // 更新锁定按钮样式
        let lockBtn = document.querySelector(`.btn-mini[data-action="lockGroup"][data-group="${g}"]`);
        if (!lockBtn) {
          lockBtn = Array.from(document.querySelectorAll('.btn-mini[data-action="lockGroup"]'))
            .find(btn => (btn.dataset.group || '').split(',').includes(g));
        }
        if (lockBtn) {
          const btnGroups = (lockBtn.dataset.group || '').split(',');
          const anyLocked = btnGroups.some(bg => (state.locked[bg] || []).length > 0);
          lockBtn.classList.toggle('red', anyLocked);
        }
      });
    } catch(e) {
      console.error('[Render.renderTagStatus] 渲染标签状态失败:', e);
    }
  },

  /**
   * 渲染排除号码网格
   */
  renderExcludeGrid: () => {
    try {
      const state = StateManager._state;
      const fragment = Utils.createFragment(Array.from({length:49}, (_,i)=>i+1), (num) => {
        const isExcluded = state.excluded.includes(num);
        const wrapper = document.createElement('div');
        wrapper.className = `exclude-tag ${isExcluded ? 'excluded' : ''}`;
        wrapper.dataset.num = num;
        wrapper.setAttribute('aria-checked', isExcluded);
        wrapper.setAttribute('tabindex', '0');
        wrapper.innerText = Utils.formatNum(num);
        return wrapper;
      });

      DOM.excludeGrid.innerHTML = '';
      DOM.excludeGrid.appendChild(fragment);
    } catch(e) {
      console.error('[Render.renderExcludeGrid] 渲染排除号码网格失败:', e);
    }
  },

  /**
   * 渲染生肖标签
   */
  renderZodiacTags: () => {
    try {
      const state = StateManager._state;
      const fragment = Utils.createFragment(state.zodiacCycle, (zodiac) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'tag';
        wrapper.dataset.value = zodiac;
        wrapper.dataset.group = 'zodiac';
        wrapper.setAttribute('role', 'checkbox');
        wrapper.setAttribute('tabindex', '0');
        wrapper.innerText = zodiac;
        return wrapper;
      });

      DOM.zodiacTags.innerHTML = '';
      DOM.zodiacTags.appendChild(fragment);
    } catch(e) {
      console.error('[Render.renderZodiacTags] 渲染生肖标签失败:', e);
    }
  },

  /**
   * 渲染号码选择标签（1-49）
   */
  renderNumTags: () => {
    try {
      const nums = [];
      for(let i = 1; i <= 49; i++) {
        nums.push(i);
      }
      const fragment = Utils.createFragment(nums, (num) => {
        const wrapper = document.createElement('div');
        wrapper.className = 'tag';
        wrapper.dataset.value = String(num);
        wrapper.dataset.group = 'num';
        wrapper.setAttribute('role', 'checkbox');
        wrapper.setAttribute('tabindex', '0');
        wrapper.innerText = Utils.formatNum(num);
        return wrapper;
      });

      DOM.numTags.innerHTML = '';
      DOM.numTags.appendChild(fragment);
    } catch(e) {
      console.error('[Render.renderNumTags] 渲染号码标签失败:', e);
    }
  },

  /**
   * 渲染方案列表
   */
  renderFilterList: () => {
    try {
      const state = StateManager._state;
      const savedList = state.savedFilters;

      if(!savedList.length){
        DOM.filterList.innerHTML = "<div style='text-align:center;color:var(--sub-text)'>暂无保存的方案</div>";
        return;
      }

      const showCount = 2;
      const displayList = state.showAllFilters ? savedList : savedList.slice(0, showCount);
      const fragment = document.createDocumentFragment();

      // 循环外缓存：避免每次迭代重复解析/访问（V8 局部变量优化）
      const escapeHtml = Utils.escapeHtml;
      const markSlots = StateManager.MARK_SLOTS || [];
      // 颜色白名单 Set（O(1) 查找替代三元判断）
      const SAFE_COLORS = new Set(['红', '蓝', '绿']);

      for (let i = 0, len = displayList.length; i < len; i++) {
        const item = displayList[i];
        const index = i;
        // 生肖方案（scope='zodiac'）：只展示生肖标签，不展示号码
        // 普通方案：按原逻辑展示号码 + 生肖
        const isZodiacScheme = item.scope === 'zodiac';
        let previewFragment;
        if (isZodiacScheme) {
          // 一次性提取并缓存字段，避免重复属性查找
          const lockedArr = (item.locked && item.locked.zodiac) || [];
          const markedMap = (item.marked && item.marked.zodiac) || {};
          const selectedZodiacs = (item.selected && item.selected.zodiac) || [];
          const markedKeys = Object.keys(markedMap);

          // 单次循环直接生成 DOM 节点（消除中间 renderItems 数组 + 减少两次遍历）
          // 分组渲染：已选 → 已锁 → 已标记，组间插入"分隔胶囊"增强视觉分组
          previewFragment = document.createDocumentFragment();
          const groupLists = [selectedZodiacs, lockedArr, markedKeys];
          const groupClasses = ['selected', 'locked', 'marked'];
          let isFirst = true;

          for (let gi = 0; gi < 3; gi++) {
            const list = groupLists[gi];
            if (list.length === 0) continue;
            if (!isFirst) {
              const sep = document.createElement('div');
              sep.className = 'zodiac-preview-divider';
              previewFragment.appendChild(sep);
            }
            isFirst = false;

            const cls = groupClasses[gi];
            const isMarked = (gi === 2);
            for (let li = 0, lLen = list.length; li < lLen; li++) {
              const zodiac = list[li];
              const wrapper = document.createElement('div');
              let badgeHTML = '';
              if (isMarked) {
                const slots = markedMap[zodiac] || [];
                const lastSlot = markSlots[slots.length - 1];
                if (lastSlot && lastSlot.color) {
                  badgeHTML = '<span class="zodiac-preview-badge" style="background:' + lastSlot.color + '">' + slots.length + '</span>';
                }
              }
              wrapper.className = 'zodiac-preview-tag ' + cls;
              wrapper.innerHTML = escapeHtml(zodiac) + badgeHTML;
              previewFragment.appendChild(wrapper);
            }
          }
        } else {
          // 修复预览一致性：使用方案自带的 locked，避免受当前 state.locked 影响
          const previewList = Filter.getFilteredList(item.selected, item.excluded, item.locked || {});
          previewFragment = Utils.createFragment(previewList, (num) => {
            const wrapper = document.createElement('div');
            wrapper.className = 'num-item';
            // P2-2 防御：num.color 白名单（来源 DataQuery 内部映射但仍加白名单保险）
            const safeColor = SAFE_COLORS.has(num.color) ? num.color : '红';
            wrapper.innerHTML = `<div class="num-ball ${escapeHtml(safeColor)}色">${escapeHtml(num.s)}</div><div class="tag-zodiac">${escapeHtml(num.zodiac)}</div>`;
            return wrapper;
          });
        }

        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'filter-item';
        itemWrapper.setAttribute('role', 'listitem');
        const isLocked = !!item.lockedScheme;
        // 生肖方案与号码方案共用 .filter-preview 容器，显示不下时横向滚动
        itemWrapper.innerHTML = `
          <div class="filter-row">
            <div class="filter-item-name">${escapeHtml(item.name)}</div>
            <button type="button" class="filter-lock-btn ${isLocked ? 'locked' : ''}" data-action="${CONFIG.ACTIONS.LOCK_FILTER}" data-index="${index}" aria-label="${isLocked ? '解锁方案' : '锁定方案'}" aria-pressed="${isLocked}"><i class="fa-solid ${isLocked ? 'fa-lock' : 'fa-unlock'}"></i></button>
            <div class="filter-preview"></div>
          </div>
          <div class="filter-item-btns">
            <button data-action="${CONFIG.ACTIONS.LOAD_FILTER}" data-index="${index}">加载</button>
            <button data-action="${CONFIG.ACTIONS.RENAME_FILTER}" data-index="${index}">重命名</button>
            <button data-action="${CONFIG.ACTIONS.COPY_FILTER}" data-index="${index}">复制</button>
            <button data-action="${CONFIG.ACTIONS.TOP_FILTER}" data-index="${index}">置顶</button>
            <button class="del" data-action="${CONFIG.ACTIONS.DELETE_FILTER}" data-index="${index}">删除</button>
          </div>
        `;
        // .filter-row 是 itemWrapper 的第一个子元素，.filter-preview 是 .filter-row 的最后一个子元素
        // 用 firstElementChild/lastElementChild 直接定位，避免 querySelector 字符串解析
        itemWrapper.firstElementChild.lastElementChild.appendChild(previewFragment);
        fragment.appendChild(itemWrapper);
      }

      if(savedList.length > showCount){
        // P1-4: 用 button 替代 div（原生 button 语义，键盘 / 屏幕阅读器友好）
        const expandBtn = document.createElement('button');
        expandBtn.type = 'button';
        expandBtn.className = 'filter-expand';
        expandBtn.dataset.action = CONFIG.ACTIONS.TOGGLE_SHOW_ALL;
        expandBtn.setAttribute('aria-expanded', state.showAllFilters ? 'true' : 'false');
        expandBtn.innerText = state.showAllFilters ? '收起' : `展开全部(${savedList.length}条)`;
        fragment.appendChild(expandBtn);
      }

      DOM.filterList.innerHTML = '';
      DOM.filterList.appendChild(fragment);
    } catch(e) {
      console.error('[Render.renderFilterList] 渲染方案列表失败:', e);
    }
  },

  /**
   * 生成号码基础数据（使用统一数据查询模块）
   * @returns {Array} 号码列表
   */
  buildNumList: () => {
    try {
      const list = [];
      for(let i=1; i<=49; i++){
        const attrs = DataQuery.getNumAttrs(i);
        list.push({
          num: attrs.num,
          s: attrs.s,
          color: attrs.color,
          zodiac: attrs.zodiac,
          element: attrs.element,
          type: attrs.type,
          bs: attrs.bs,
          colorsx: attrs.colorsx,
          head: attrs.head,
          tail: attrs.tail,
          sum: attrs.sum,
          sumOdd: attrs.sumOdd,
          sumSize: attrs.sumSize,
          tailSize: attrs.tailSize,
          hot: '温号'
        });
      }
      StateManager.setState({ numList: list }, false);
      return list;
    } catch(e) {
      Toast.show('数据初始化失败，请刷新重试');
      return [];
    }
  },

  /**
   * 生成生肖循环
   * @returns {Object} 生肖信息
   */
  buildZodiacCycle: () => {
    try {
      // 获取当前农历生肖
      const now = new Date();
      const year = now.getFullYear();
      const thisYearSpring = new Date(CONFIG.SPRING_FESTIVAL[year]);
      const zodiacYear = now < thisYearSpring ? year - 1 : year;
      const branchIndex = (zodiacYear - 4) % 12;
      const currentBranch = CONFIG.EARTHLY_BRANCHES[branchIndex];
      const currentZodiac = CONFIG.ZODIAC_BASE[currentBranch];
      
      // 生成生肖循环数组
      const currentIndex = CONFIG.EARTHLY_BRANCHES.indexOf(currentBranch);
      const cycleBranches = [];
      for(let i=0; i<12; i++){
        const index = (currentIndex - i + 12) % 12;
        cycleBranches.push(CONFIG.EARTHLY_BRANCHES[index]);
      }
      const zodiacCycle = cycleBranches.map(branch => CONFIG.ZODIAC_BASE[branch]);

      StateManager.setState({ currentZodiac, zodiacCycle }, false);
      
      // 生肖循环变化，重新初始化数据查询模块
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac, zodiacCycle };
    } catch(e) {
      console.error('生成生肖循环失败', e);
      Toast.show('生肖数据初始化失败');
      const fallbackCycle = ['马','蛇','龙','兔','虎','牛','鼠','猪','狗','鸡','猴','羊'];
      StateManager.setState({ currentZodiac: '马', zodiacCycle: fallbackCycle }, false);
      
      // 生肖循环变化，重新初始化数据查询模块
      DataQuery._numToAttrMap = null;
      DataQuery._attrToNumMap = null;
      DataQuery.init();
      
      return { currentZodiac: '马', zodiacCycle: fallbackCycle };
    }
  },

  /**
   * 隐藏加载遮罩
   */
  hideLoading: () => {
    DOM.loadingMask.classList.add('hide');
    setTimeout(() => {
      DOM.loadingMask.style.display = 'none';
    }, CONFIG.ANIM_NORMAL);
  }
};
