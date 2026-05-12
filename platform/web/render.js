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
      console.error('渲染结果失败', e);
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

          // 处理标记圆点（6个固定槽位：左上→左中→左下→右上→右中→右下）
          const key = String(tagValue);
          const slotIndices = markedMap[key] || [];
          tag.querySelectorAll('.mark-dot').forEach(d => d.remove());

          slotIndices.forEach(idx => {
            const slot = StateManager.MARK_SLOTS[idx];
            if (!slot) return;
            const dot = document.createElement('span');
            dot.className = 'mark-dot';
            dot.style.backgroundColor = slot.color;
            if (slot.left) dot.style.left = slot.left;
            if (slot.right) dot.style.right = slot.right;
            if (slot.top) dot.style.top = slot.top;
            if (slot.bottom) dot.style.bottom = slot.bottom;
            if (slot.marginTop) dot.style.marginTop = slot.marginTop;
            tag.appendChild(dot);
          });
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
      console.error('渲染标签状态失败', e);
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
        wrapper.innerText = num.toString().padStart(2,'0');
        return wrapper;
      });

      DOM.excludeGrid.innerHTML = '';
      DOM.excludeGrid.appendChild(fragment);
    } catch(e) {
      console.error('渲染排除网格失败', e);
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
      console.error('渲染生肖标签失败', e);
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

      displayList.forEach((item, index) => {
        const realIndex = state.showAllFilters ? index : index;
        const previewList = Filter.getFilteredList(item.selected, item.excluded);
        const previewFragment = Utils.createFragment(previewList, (num) => {
          const wrapper = document.createElement('div');
          wrapper.className = 'num-item';
          wrapper.innerHTML = `<div class="num-ball ${num.color}色">${num.s}</div><div class="tag-zodiac">${num.zodiac}</div>`;
          return wrapper;
        });

        const itemWrapper = document.createElement('div');
        itemWrapper.className = 'filter-item';
        itemWrapper.setAttribute('role', 'listitem');
        itemWrapper.innerHTML = `
          <div class="filter-row">
            <div class="filter-item-name">${item.name}</div>
            <div class="filter-preview"></div>
          </div>
          <div class="filter-item-btns">
            <button data-action="${CONFIG.ACTIONS.LOAD_FILTER}" data-index="${realIndex}">加载</button>
            <button data-action="${CONFIG.ACTIONS.RENAME_FILTER}" data-index="${realIndex}">重命名</button>
            <button data-action="${CONFIG.ACTIONS.COPY_FILTER}" data-index="${realIndex}">复制</button>
            <button data-action="${CONFIG.ACTIONS.TOP_FILTER}" data-index="${realIndex}">置顶</button>
            <button class="del" data-action="${CONFIG.ACTIONS.DELETE_FILTER}" data-index="${realIndex}">删除</button>
          </div>
        `;
        itemWrapper.querySelector('.filter-preview').appendChild(previewFragment);
        fragment.appendChild(itemWrapper);
      });

      if(savedList.length > showCount){
        const expandBtn = document.createElement('div');
        expandBtn.className = 'filter-expand';
        expandBtn.dataset.action = CONFIG.ACTIONS.TOGGLE_SHOW_ALL;
        expandBtn.innerText = state.showAllFilters ? '收起' : `展开全部(${savedList.length}条)`;
        fragment.appendChild(expandBtn);
      }

      DOM.filterList.innerHTML = '';
      DOM.filterList.appendChild(fragment);
    } catch(e) {
      console.error('渲染方案列表失败', e);
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
      console.error('生成号码列表失败', e);
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
