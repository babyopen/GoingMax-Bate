const Business = {
  // ====================== 排除号码相关 ======================
  /**
   * 切换号码排除状态
   * @param {number} num - 号码
   */
  toggleExclude: (num) => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    const newExcluded = [...state.excluded];
    const newHistory = [...state.excludeHistory];

    if(newExcluded.includes(num)){
      newHistory.push([num, 'out']);
      const index = newExcluded.indexOf(num);
      newExcluded.splice(index, 1);
    } else {
      newHistory.push([num, 'in']);
      newExcluded.push(num);
    }

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
  },

  /**
   * 反选排除号码（已排除的恢复，未排除的排除）
   */
  invertExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    const allNums = Array.from({length: 49}, (_, i) => i + 1);
    const newExcluded = [];
    const newHistory = [...state.excludeHistory];

    allNums.forEach(num => {
      const isCurrentlyExcluded = state.excluded.includes(num);
      if(!isCurrentlyExcluded){
        // 当前未排除的，现在排除
        newExcluded.push(num);
        newHistory.push([num, 'in']);
      } else {
        // 当前已排除的，现在恢复
        newHistory.push([num, 'out']);
      }
    });

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
    Toast.show(`已反选，当前排除 ${newExcluded.length} 个号码`);
  },

  /**
   * 撤销上一次排除操作
   */
  undoExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude || !state.excludeHistory.length) return;

    const newHistory = [...state.excludeHistory];
    const [num, act] = newHistory.pop();
    const newExcluded = [...state.excluded];

    act === 'in' 
      ? newExcluded.splice(newExcluded.indexOf(num), 1)
      : newExcluded.push(num);

    StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
  },

  /**
   * 清空所有排除号码
   */
  clearExclude: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;
    StateManager.setState({ excluded: [], excludeHistory: [] });
    Toast.show('已清空所有排除号码');
  },

  /**
   * 批量排除号码弹窗
   */
  batchExcludePrompt: () => {
    const state = StateManager._state;
    if(state.lockExclude) return;

    if(typeof GIONGBETA_INPUT_MODAL !== 'undefined' && GIONGBETA_INPUT_MODAL.show){
      GIONGBETA_INPUT_MODAL.show('批量排除号码', '输入要排除的号码，空格/逗号/顿号/引号/竖线/点/横线分隔', '', (input) => {
        if(!input) return;
        const nums = input.split(/[\s,，、。."'|-]+/).map(Number).filter(num => num >=1 && num <=49);
        if(nums.length === 0) {
          Toast.show('请输入有效的号码');
          return;
        }
        const newExcluded = [...state.excluded];
        const newHistory = [...state.excludeHistory];
        let addCount = 0;
        nums.forEach(num => {
          if(!newExcluded.includes(num)){
            newExcluded.push(num);
            newHistory.push([num, 'in']);
            addCount++;
          }
        });
        StateManager.setState({ excluded: newExcluded, excludeHistory: newHistory });
        Toast.show(addCount > 0 ? `已添加${addCount}个排除号码` : '号码已在排除列表中');
      });
    }
  },

  /**
   * 切换排除锁定状态
   */
  toggleExcludeLock: () => {
    const isLocked = DOM.lockExclude.checked;
    StateManager.setState({ lockExclude: isLocked }, false);
    Toast.show(isLocked ? '已锁定排除号码' : '已解锁排除号码');
  },

  // ====================== 方案管理相关 ======================
  /**
   * 保存方案弹窗
   */
  saveFilterPrompt: () => {
    const state = StateManager._state;
    if(state.savedFilters.length >= CONFIG.MAX_SAVE_COUNT){
      Toast.show(`最多只能保存${CONFIG.MAX_SAVE_COUNT}个方案`);
      return;
    }

    const defaultName = `方案${state.savedFilters.length + 1}`;
    GIONGBETA_INPUT_MODAL.show('请输入方案名称', '请输入方案名称', defaultName, (name) => {
      if(name === null) return;
      const filterName = name.trim() || defaultName;
      const filterItem = {
        name: filterName,
        selected: Utils.deepClone(state.selected),
        excluded: Utils.deepClone(state.excluded),
        locked: Utils.deepClone(state.locked)
      };
      const success = Storage.saveFilter(filterItem);
      if(success){
        Render.renderFilterList();
        Toast.show('保存成功');
      }
    });
  },

  /**
   * 加载保存的方案
   * @param {number} index - 方案索引
   */
  loadFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    StateManager.setState({
      selected: Utils.deepClone(item.selected),
      excluded: Utils.deepClone(item.excluded),
      locked: Utils.deepClone(item.locked || {})
    });
    Toast.show('加载成功');
  },

  /**
   * 复制方案号码
   * @param {number} index - 方案索引
   */
  copyFilterNums: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const list = Filter.getFilteredList(item.selected, item.excluded);
    if(list.length === 0){
      Toast.show('该方案无符合条件的号码');
      return;
    }

    const numStr = list.map(n => n.s).join(' ');
    // 剪贴板API兼容
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(numStr).then(() => {
        Toast.show('复制成功');
      }).catch(() => {
        GIONGBETA_INPUT_MODAL.show('复制号码', '点击选中并复制', numStr, () => {});
      });
    } else {
      GIONGBETA_INPUT_MODAL.show('复制号码', '点击选中并复制', numStr, () => {});
    }
  },

  /**
   * 重命名方案
   * @param {number} index - 方案索引
   */
  renameFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    GIONGBETA_INPUT_MODAL.show('修改方案名称', '请输入新名称', item.name, (newName) => {
      if(newName === null || newName.trim() === "") return;
      const newList = [...state.savedFilters];
      newList[index].name = newName.trim();
      const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      if(success){
        StateManager.setState({ savedFilters: newList }, false);
        Render.renderFilterList();
        Toast.show('重命名成功');
      }
    });
  },

  /**
   * 置顶方案
   * @param {number} index - 方案索引
   */
  topFilter: (index) => {
    const state = StateManager._state;
    const item = state.savedFilters[index];
    if(!item) return;

    const newList = [...state.savedFilters];
    newList.splice(index, 1);
    newList.unshift(item);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
      Render.renderFilterList();
      Toast.show('置顶成功');
    }
  },

  /**
   * 删除方案
   * @param {number} index - 方案索引
   */
  deleteFilter: (index) => {
    const doDelete = () => {
      const state = StateManager._state;
      const newList = [...state.savedFilters];
      newList.splice(index, 1);
      const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
      if(success){
        StateManager.setState({ savedFilters: newList }, false);
        Render.renderFilterList();
        Toast.show('删除成功');
      }
    };

    GIONGBETA_CONFIRM_MODAL.show('确定删除该方案？', (result) => {
      if(result) doDelete();
    });
  },

  /**
   * 清空所有方案
   */
  clearAllSavedFilters: () => {
    const doClear = () => {
      Storage.remove(Storage.KEYS.SAVED_FILTERS);
      StateManager.setState({ savedFilters: [] }, false);
      Render.renderFilterList();
      Toast.show('已清空所有方案');
    };

    GIONGBETA_CONFIRM_MODAL.show('确定清空所有方案？', (result) => {
      if(result) doClear();
    });
  },

  /**
   * 切换方案列表展开/收起
   */
  toggleShowAllFilters: () => {
    const state = StateManager._state;
    StateManager.setState({ showAllFilters: !state.showAllFilters }, false);
    Render.renderFilterList();
  },

  // ====================== 导航相关 ======================
  /**
   * 切换底部导航
   * @param {number} index - 导航索引
   */
  switchBottomNav: (index) => {
    ViewFilter.switchBottomNavUI(index);
    if(index === 1) {
      Business.initAnalysisPage();
    }
    if(index === 2) {
      Business.switchZodiacTab('ultimate');
    }
  },

  // ====================== 分析页面相关 ======================
  /**
   * 加载历史记录缓存
   */
  loadHistoryCache: () => {
    const cache = Storage.getHistoryCache();
    const currentLatestExpect = StateManager._state.analysis.historyData.length ? Number(StateManager._state.analysis.historyData[0].expect || 0) : 0;
    const cacheLatestExpect = cache && cache.data && cache.data.length ? Number(cache.data[0].expect || 0) : 0;
    
    if(cache && cache.data && cache.data.length > 0 && cacheLatestExpect > currentLatestExpect) {
      const newAnalysis = { ...StateManager._state.analysis, historyData: cache.data };
      StateManager.setState({ analysis: newAnalysis }, false);
      Business.renderLatest(cache.data[0]);
      Business.renderHistory();
      Business.renderFullAnalysis();
      Business.renderZodiacAnalysis();
      Business.renderZodiacPrediction();
      Business.initZodiacBacktest();
      Business.initGiongTab();
      Business.initDBAlgorithm();
      ViewAnalysis.updateLoadMoreBtn(
        StateManager._state.analysis.historyData.length > StateManager._state.analysis.showCount
      );
    }
  },

  /**
   * 初始化分析页面
   */
  initAnalysisPage: () => {
    Business.loadHistoryCache();
    const state = StateManager._state;
    if(state.analysis.historyData.length === 0) {
      Business.refreshHistory();
    }
    Business.startCountdown();
    Business.startAutoRefresh();
  },

  /**
   * 刷新历史数据
   * @param {boolean} silentUpdate - 是否静默更新（不显示loading）
   */
  refreshHistory: async (silentUpdate = false) => {
    const state = StateManager._state;
    const cache = Storage.getHistoryCache();
    const cacheLatestExpect = cache && cache.data && cache.data.length ? Number(cache.data[0].expect || 0) : 0;
    const currentLatestExpect = state.analysis.historyData.length ? Number(state.analysis.historyData[0].expect || 0) : 0;

    if(!silentUpdate) ViewAnalysis.showHistoryLoading();

    try {
      const year = new Date().getFullYear();
      const res = await fetch(CONFIG.API.HISTORY + year);
      const data = await res.json();
      let rawData = data.data || [];

      rawData = rawData.filter(item => {
        const expect = item.expect || '';
        const openCode = item.openCode || '';
        return expect && openCode && openCode.split(',').length === 7;
      });

      const uniqueMap = new Map();
      rawData.forEach(item => {
        const expectNum = Number(item.expect || 0);
        if(expectNum && !isNaN(expectNum)) {
          uniqueMap.set(expectNum, item);
        }
      });

      const sortedData = Array.from(uniqueMap.values()).sort((a, b) => {
        return Number(b.expect || 0) - Number(a.expect || 0);
      });

      const newLatestExpect = sortedData.length ? Number(sortedData[0].expect || 0) : 0;
      if(newLatestExpect > currentLatestExpect) {
        Storage.saveHistoryCache(sortedData);
        const newAnalysis = { ...StateManager._state.analysis, historyData: sortedData };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        Business.initDBAlgorithm();
        const latestItem = sortedData[0];
        if(latestItem) Business.renderLatest(latestItem);
        Business.renderHistory();
        Business.renderFullAnalysis();
        Business.renderZodiacAnalysis();
        if(!silentUpdate) Toast.show('数据加载成功');
      } else if(cacheLatestExpect > currentLatestExpect) {
        const newAnalysis = { ...state.analysis, historyData: cache.data };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        Business.initDBAlgorithm();
        const latestItem2 = cache.data[0];
        if(latestItem2) Business.renderLatest(latestItem2);
        Business.renderHistory();
        Business.renderFullAnalysis();
        Business.renderZodiacAnalysis();
        if(!silentUpdate) Toast.show('已加载缓存最新数据');
      } else {
        if(!silentUpdate) Toast.show('已是最新数据');
      }
    } catch(e) {
      if(cacheLatestExpect > currentLatestExpect) {
        const newAnalysis = { ...state.analysis, historyData: cache.data };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        Business.initDBAlgorithm();
        const latestItem3 = cache.data[0];
        if(latestItem3) Business.renderLatest(latestItem3);
        Business.renderHistory();
        Business.renderFullAnalysis();
        Business.renderZodiacAnalysis();
        if(!silentUpdate) Toast.show('使用缓存数据（网络不可用）');
      } else {
        if(!silentUpdate) {
          ViewAnalysis.showHistoryError();
          Toast.show('数据加载失败');
        }
      }
    }

    ViewAnalysis.updateLoadMoreBtn(
      StateManager._state.analysis.historyData.length > StateManager._state.analysis.showCount
    );
  },

  /**
   * 获取特码信息
   * @param {Object} item - 历史数据项
   * @returns {Object} 特码信息
   */
  getSpecial: (item) => {
    const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
    const zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
    const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
    const te = Math.max(0, Number(codeArr[6]));
    
    return {
      te,
      tail: te % 10,
      head: Math.floor(te / 10),
      wave: Business.getColor(te),
      colorName: Business.getColorName(te),
      zod: zodArr[6] || '-',
      odd: te % 2 === 1,
      big: te >= 25,
      animal: CONFIG.ANALYSIS.HOME_ZODIAC.includes(zodArr[6]) ? '家禽' : '野兽',
      wuxing: Business.getWuxing(te),
      fullZodArr: zodArr
    };
  },

  /**
   * 获取五行
   * @param {number} n - 号码
   * @returns {string} 五行
   */
  getColor: (n) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(n));
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green' };
    return colorMap[color] || 'red';
  },
  
  getColorName: (n) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(n));
    return color || '红';
  },
  
  getWuxing: (n) => {
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(n));
    return element || '金';
  },

  /**
   * 获取生肖等级
   * @param {number} count - 出现次数
   * @param {number} miss - 遗漏期数
   * @param {number} total - 总期数
   * @returns {Object} 等级信息
   */
  getZodiacLevel: (count, miss, total) => {
    const avgCount = total / 12;
    if(count >= avgCount * 1.5 && miss <= 3) return { cls: 'hot', text: '热' };
    if(count <= avgCount * 0.5 || miss >= 8) return { cls: 'cold', text: '冷' };
    return { cls: 'warm', text: '温' };
  },

  /**
   * 渲染最新开奖
   * @param {Object} item - 最新数据项
   */
  renderLatest: (item) => {
    if(!item) return;
    const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
    const s = Business.getSpecial(item);
    const zodArr = s.fullZodArr;

    let html = '';
    for(let i = 0; i < 6; i++) {
      const num = Number(codeArr[i]);
      html += Business.buildBall(codeArr[i], Business.getColor(num), zodArr[i]);
    }
    html += '<div class="ball-sep">+</div>' + Business.buildBall(codeArr[6], s.wave, zodArr[6]);

    ViewAnalysis.renderLatest({ ballsHtml: html, expect: item.expect || '--' });
  },

  /**
   * 构建球元素
   * @param {string} num - 号码
   * @param {string} color - 颜色
   * @param {string} zodiac - 生肖
   * @returns {string} HTML字符串
   */
  buildBall: (num, color, zodiac) => {
    return `
    <div class="ball-item">
      <div class="ball ${color}">${num}</div>
      <div class="ball-zodiac">${zodiac}</div>
    </div>`;
  },

  /**
   * 渲染历史记录
   */
  renderHistory: () => {
    const state = StateManager._state;
    const list = state.analysis.historyData.slice(0, state.analysis.showCount);

    if(!list.length) {
      ViewAnalysis.renderHistory({ isEmpty: true });
      return;
    }

    const historyHtml = list.map(item => {
      const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
      const waveArr = (item.wave || 'red,red,red,red,red,red,red').split(',');
      const s = Business.getSpecial(item);
      const zodArr = s.fullZodArr;
      let balls = '';
      for(let i = 0; i < 6; i++) balls += Business.buildBall(codeArr[i], waveArr[i], zodArr[i]);
      balls += '<div class="ball-sep">+</div>' + Business.buildBall(codeArr[6], waveArr[6], zodArr[6]);
      return '<div class="history-item"><div class="history-expect">第' + (item.expect || '') + '期</div><div class="ball-group">' + balls + '</div></div>';
    }).join('');

    const loadMoreVisible = state.analysis.showCount < state.analysis.historyData.length;
    ViewAnalysis.renderHistory({ historyHtml: historyHtml, isEmpty: false, loadMoreVisible: loadMoreVisible });
  },

  /**
   * 计算全维度分析
   * @returns {Object} 分析数据
   */
  calcFullAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    if(!historyData.length) return null;

    const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
    const total = list.length;
    const latestExpect = historyData[0]?.expect || 0;

    const singleDouble = { '单': 0, '双': 0 };
    const bigSmall = { '大': 0, '小': 0 };
    const range = { '1-9': 0, '10-19': 0, '20-29': 0, '30-39': 0, '40-49': 0 };
    const head = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
    const tail = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0 };
    const color = { '红': 0, '蓝': 0, '绿': 0 };
    const wuxing = { '金': 0, '木': 0, '水': 0, '火': 0, '土': 0 };
    const animal = { '家禽': 0, '野兽': 0 };
    const zodiac = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiac[z] = 0);
    const numCount = {};
    for(let i = 1; i <= 49; i++) numCount[String(i).padStart(2, '0')] = 0;

    const lastAppearIdx = {};
    for(let i = 1; i <= 49; i++) lastAppearIdx[i] = -1;
    
    const lastAppearSD = { '单': -1, '双': -1 };
    const lastAppearBS = { '大': -1, '小': -1 };
    const lastAppearRange = { '1-9': -1, '10-19': -1, '20-29': -1, '30-39': -1, '40-49': -1 };
    const lastAppearHead = { 0: -1, 1: -1, 2: -1, 3: -1, 4: -1 };
    const lastAppearTail = { 0: -1, 1: -1, 2: -1, 3: -1, 4: -1, 5: -1, 6: -1, 7: -1, 8: -1, 9: -1 };
    const lastAppearColor = { '红': -1, '蓝': -1, '绿': -1 };
    const lastAppearWuxing = { '金': -1, '木': -1, '水': -1, '火': -1, '土': -1 };
    const lastAppearAnimal = { '家禽': -1, '野兽': -1 };
    const lastAppearZod = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => lastAppearZod[z] = -1);

    list.forEach((item, idx) => {
      const s = Business.getSpecial(item);
      s.odd ? singleDouble['单']++ : singleDouble['双']++;
      s.big ? bigSmall['大']++ : bigSmall['小']++;
      const rangeKey = Utils.getRangeCategory(s.te);
      range[rangeKey]++;
      head[s.head]++;
      tail[s.tail]++;
      color[s.colorName]++;
      wuxing[s.wuxing]++;
      animal[s.animal]++;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zodiac[s.zod]++;
      numCount[String(s.te).padStart(2, '0')]++;
      
      if(lastAppearIdx[s.te] === -1) lastAppearIdx[s.te] = idx;
      if(s.odd && lastAppearSD['单'] === -1) lastAppearSD['单'] = idx;
      else if(!s.odd && lastAppearSD['双'] === -1) lastAppearSD['双'] = idx;
      if(s.big && lastAppearBS['大'] === -1) lastAppearBS['大'] = idx;
      else if(!s.big && lastAppearBS['小'] === -1) lastAppearBS['小'] = idx;
      if(lastAppearRange[rangeKey] === -1) lastAppearRange[rangeKey] = idx;
      if(lastAppearHead[s.head] === -1) lastAppearHead[s.head] = idx;
      if(lastAppearTail[s.tail] === -1) lastAppearTail[s.tail] = idx;
      if(lastAppearColor[s.colorName] === -1) lastAppearColor[s.colorName] = idx;
      if(lastAppearWuxing[s.wuxing] === -1) lastAppearWuxing[s.wuxing] = idx;
      if(lastAppearAnimal[s.animal] === -1) lastAppearAnimal[s.animal] = idx;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod) && lastAppearZod[s.zod] === -1) {
        lastAppearZod[s.zod] = idx;
      }
    });

    const sdMiss = { '单': Utils.calcMiss(lastAppearSD['单'], total, latestExpect, list), '双': Utils.calcMiss(lastAppearSD['双'], total, latestExpect, list) };
    const bsMiss = { '大': Utils.calcMiss(lastAppearBS['大'], total, latestExpect, list), '小': Utils.calcMiss(lastAppearBS['小'], total, latestExpect, list) };
    const rangeMiss = {
      '1-9': Utils.calcMiss(lastAppearRange['1-9'], total, latestExpect, list),
      '10-19': Utils.calcMiss(lastAppearRange['10-19'], total, latestExpect, list),
      '20-29': Utils.calcMiss(lastAppearRange['20-29'], total, latestExpect, list),
      '30-39': Utils.calcMiss(lastAppearRange['30-39'], total, latestExpect, list),
      '40-49': Utils.calcMiss(lastAppearRange['40-49'], total, latestExpect, list)
    };
    const headMiss = {
      0: Utils.calcMiss(lastAppearHead[0], total, latestExpect, list),
      1: Utils.calcMiss(lastAppearHead[1], total, latestExpect, list),
      2: Utils.calcMiss(lastAppearHead[2], total, latestExpect, list),
      3: Utils.calcMiss(lastAppearHead[3], total, latestExpect, list),
      4: Utils.calcMiss(lastAppearHead[4], total, latestExpect, list)
    };
    const tailMiss = {};
    for(let t = 0; t <= 9; t++) tailMiss[t] = Utils.calcMiss(lastAppearTail[t], total, latestExpect, list);
    const colorMiss = { '红': Utils.calcMiss(lastAppearColor['红'], total, latestExpect, list), '蓝': Utils.calcMiss(lastAppearColor['蓝'], total, latestExpect, list), '绿': Utils.calcMiss(lastAppearColor['绿'], total, latestExpect, list) };
    const wuxingMiss = {
      '金': Utils.calcMiss(lastAppearWuxing['金'], total, latestExpect, list),
      '木': Utils.calcMiss(lastAppearWuxing['木'], total, latestExpect, list),
      '水': Utils.calcMiss(lastAppearWuxing['水'], total, latestExpect, list),
      '火': Utils.calcMiss(lastAppearWuxing['火'], total, latestExpect, list),
      '土': Utils.calcMiss(lastAppearWuxing['土'], total, latestExpect, list)
    };
    const animalMiss = { '家禽': Utils.calcMiss(lastAppearAnimal['家禽'], total, latestExpect, list), '野兽': Utils.calcMiss(lastAppearAnimal['野兽'], total, latestExpect, list) };
    const zodiacMiss = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => zodiacMiss[z] = Utils.calcMiss(lastAppearZod[z], total, latestExpect, list));

    let totalMissSum = 0, maxMiss = 0, hot = 0, warm = 0, cold = 0;
    const allMiss = [];
    for(let m = 1; m <= 49; m++) {
      const miss = Utils.calcMiss(lastAppearIdx[m], total, latestExpect, list);
      allMiss.push(miss);
      totalMissSum += miss;
      if(miss > maxMiss) maxMiss = miss;
      if(miss <= 3) hot++;
      else if(miss <= 9) warm++;
      else cold++;
    }
    const avgMiss = (totalMissSum / 49).toFixed(1);
    const curMaxMiss = Math.max(...allMiss);

    let curStreak = 1, maxStreak = 1, current = 1;
    if(list.length >= 2) {
      const firstS = Business.getSpecial(list[0]);
      const firstShape = `${firstS.odd}_${firstS.big}`;
      for(let i = 1; i < list.length; i++) {
        const s = Business.getSpecial(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === firstShape) curStreak++;
        else break;
      }
      let prevShape = firstShape;
      for(let i = 1; i < list.length; i++) {
        const s = Business.getSpecial(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === prevShape) {
          current++;
          if(current > maxStreak) maxStreak = current;
        } else {
          current = 1;
          prevShape = shape;
        }
      }
    }

    const hotSD = Object.entries(singleDouble).sort((a, b) => b[1] - a[1])[0];
    const hotBS = Object.entries(bigSmall).sort((a, b) => b[1] - a[1])[0];
    const hotHead = Object.entries(head).sort((a, b) => b[1] - a[1])[0];
    const hotTail = Object.entries(tail).sort((a, b) => b[1] - a[1])[0];
    const hotColor = Object.entries(color).sort((a, b) => b[1] - a[1])[0];
    const hotWx = Object.entries(wuxing).sort((a, b) => b[1] - a[1])[0];
    const hotZod = Object.entries(zodiac).sort((a, b) => b[1] - a[1]).slice(0, 3).map(i => i[0]).join('、');
    const hotAni = Object.entries(animal).sort((a, b) => b[1] - a[1])[0];
    const hotNum = Object.entries(numCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(i => i[0]).join(' ');

    return {
      total, singleDouble, bigSmall, range, head, tail, color, wuxing, animal, zodiac, numCount,
      hotSD, hotBS, hotHead, hotTail, hotColor, hotWx, hotZod, hotAni, hotNum,
      miss: { curMaxMiss, avgMiss, maxMiss, hot, warm, cold },
      streak: { curStreak, maxStreak },
      sdMiss, bsMiss, rangeMiss, headMiss, tailMiss, colorMiss, wuxingMiss, animalMiss, zodiacMiss
    };
  },

  /**
   * 渲染全维度分析
   */
  renderFullAnalysis: () => {
    const data = Business.calcFullAnalysis();
    if(!data) {
      ViewAnalysis.renderFullAnalysis(null);
      return;
    }

    const rankKeys = ['singleDoubleRank', 'bigSmallRank', 'rangeRank', 'headRank', 'tailRank', 'colorRank', 'wuxingRank', 'animalRank', 'zodiacRank'];
    const rankDataObjs = [data.singleDouble, data.bigSmall, data.range, data.head, data.tail, data.color, data.wuxing, data.animal, data.zodiac];
    const rankMissMaps = [data.sdMiss, data.bsMiss, data.rangeMiss, data.headMiss, data.tailMiss, data.colorMiss, data.wuxingMiss, data.animalMiss, data.zodiacMiss];
    const rankHtmls = {};
    rankKeys.forEach(function(k, i) {
      rankHtmls[k] = ViewAnalysis.buildRankHtml(rankDataObjs[i], data.total, rankMissMaps[i]);
    });

    ViewAnalysis.renderFullAnalysis({
      hotSD: data.hotSD[0] + ' / ' + data.hotBS[0],
      hotZodiac: data.hotZod,
      hotHT: data.hotHead[0] + '头 / ' + data.hotTail[0] + '尾',
      hotCW: data.hotColor[0] + ' / ' + data.hotWx[0],
      hotMiss: '热:' + data.miss.hot + ' 温:' + data.miss.warm + ' 冷:' + data.miss.cold + ' | 最大遗漏:' + data.miss.maxMiss + '期',
      odd: data.singleDouble['单'], even: data.singleDouble['双'],
      big: data.bigSmall['大'], small: data.bigSmall['小'],
      r1: data.range['1-9'], r2: data.range['10-19'], r3: data.range['20-29'], r4: data.range['30-39'], r5: data.range['40-49'],
      h0: data.head[0], h1: data.head[1], h2: data.head[2], h3: data.head[3], h4: data.head[4],
      cRed: data.color['红'], cBlue: data.color['蓝'], cGreen: data.color['绿'],
      wJin: data.wuxing['金'], wMu: data.wuxing['木'], wShui: data.wuxing['水'], wHuo: data.wuxing['火'], wTu: data.wuxing['土'],
      aniHome: data.animal['家禽'], aniWild: data.animal['野兽'],
      _hotShape2: Business.getTopHot(Object.entries(data.singleDouble).concat(Object.entries(data.bigSmall))),
      _hotRange2: Business.getTopHot(Object.entries(data.range)),
      _hotHead2: Business.getTopHot(Object.entries(data.head)),
      _hotTail2: Business.getTopHot(Object.entries(data.tail)),
      _hotColor2: Business.getTopHot(Object.entries(data.color)),
      _hotWuxing2: Business.getTopHot(Object.entries(data.wuxing)),
      _hotAnimal: Business.getTopHot(Object.entries(data.animal)),
      _hotZodiac2: Object.entries(data.zodiac).sort(function(a, b) { return b[1] - a[1]; }).slice(0, 5).map(function(i) { return i[0] + '(' + i[1] + ')'; }).join(' '),
      hotNum: data.hotNum,
      missCur: data.miss.curMaxMiss, missAvg: data.miss.avgMiss, missMax: data.miss.maxMiss,
      missHot: data.miss.hot, missWarm: data.miss.warm, missCold: data.miss.cold,
      hotColdTip: '热:' + data.miss.hot + ' 温:' + data.miss.warm + ' 冷:' + data.miss.cold,
      streakCur: data.streak.curStreak, streakMax: data.streak.maxStreak,
      streakTip: '当前:' + data.streak.curStreak + '期 最长:' + data.streak.maxStreak + '期',
      tailArr: data.tail,
      rankHtmls: rankHtmls,
      zodiacMiss: data.zodiacMiss
    });
  },

  /**
   * 获取热门值
   * @param {Array} arr - 数组
   * @param {number} limit - 限制数量
   * @returns {string} 热门值字符串
   */
  getTopHot: (arr, limit = 2) => {
    return arr.sort((a, b) => b[1] - a[1]).slice(0, limit).map(i => i[0]).join(' / ');
  },

  /**
   * 计算生肖关联分析
   * @returns {Object} 分析数据
   */
  calcZodiacAnalysis: () => {
    const state = StateManager._state;
    const { historyData, analyzeLimit } = state.analysis;
    if(!historyData.length || historyData.length < 2) return null;

    const list = historyData.slice(0, Math.min(analyzeLimit, historyData.length));
    const total = list.length;
    const avgExpect = total / 12;
    const latestExpect = historyData[0]?.expect || 0;

    const zodCount = {};
    const lastAppearIdx = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => { zodCount[z] = 0; lastAppearIdx[z] = -1; });
    const tailZodMap = {};
    for(let t = 0; t <= 9; t++) tailZodMap[t] = {};
    const followMap = {};

    list.forEach((item, idx) => {
      const s = Business.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        zodCount[s.zod]++;
        if(lastAppearIdx[s.zod] === -1) lastAppearIdx[s.zod] = idx;
      }
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        tailZodMap[s.tail][s.zod] = (tailZodMap[s.tail][s.zod] || 0) + 1;
      }
    });

    for(let i = 1; i < list.length; i++) {
      const preZod = Business.getSpecial(list[i-1]).zod;
      const curZod = Business.getSpecial(list[i]).zod;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(preZod) && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curZod)) {
        if(!followMap[preZod]) followMap[preZod] = {};
        followMap[preZod][curZod] = (followMap[preZod][curZod] || 0) + 1;
      }
    }

    const zodMiss = {};
    const zodAvgMiss = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      zodMiss[z] = Utils.calcMiss(lastAppearIdx[z], total, latestExpect, list);
      zodAvgMiss[z] = zodCount[z] > 0 ? (total / zodCount[z]).toFixed(1) : total;
    });

    const topZod = Object.entries(zodCount).sort((a, b) => b[1] - a[1]);
    const topTail = Array.from({ length: 10 }, (_, t) => ({
      t, sum: Object.values(tailZodMap[t]).reduce((a, b) => a + b, 0)
    })).sort((a, b) => b.sum - a.sum);

    return { list, total, avgExpect, zodCount, zodMiss, zodAvgMiss, tailZodMap, followMap, topZod, topTail };
  },

  /**
   * 渲染生肖关联分析
   */
  renderZodiacAnalysis: () => {
    const data = Business.calcZodiacAnalysis();

    if(!data) {
      ViewAnalysis.renderZodiacAnalysis(null);
      return;
    }

    const combo1 = '1. 首选：尾' + (data.topTail[0]?.t ?? '-') + ' + ' + (data.topZod[0]?.[0] ?? '-') + '（出现' + (data.topZod[0]?.[1] ?? 0) + '次）';
    const combo2 = '2. 次选：尾' + (data.topTail[1]?.t ?? '-') + ' + ' + (data.topZod[1]?.[0] ?? '-') + '（出现' + (data.topZod[1]?.[1] ?? 0) + '次）';
    const combo3 = '3. 备选：尾' + (data.topTail[2]?.t ?? '-') + ' + ' + (data.topZod[2]?.[0] ?? '-') + '（出现' + (data.topZod[2]?.[1] ?? 0) + '次）';

    let tailZodiacHtml = '';
    for(let t = 0; t <= 9; t++) {
      const arr = Object.entries(data.tailZodMap[t]).sort((a, b) => b[1] - a[1]);
      const topZ = arr.length ? arr[0][0] : '-';
      const cnt = arr.length ? arr[0][1] : 0;
      const level = Business.getZodiacLevel(cnt, data.zodMiss[topZ] || 0, data.total);
      tailZodiacHtml += '<div class="data-item-z ' + level.cls + '">尾' + t + '<br>' + topZ + '<br>' + cnt + '次</div>';
    }

    let followTableHtml = '<tr><th>上期生肖</th><th>首选(次数)</th><th>次选(次数)</th><th>排除生肖</th></tr>';
    const followKeys = Object.keys(data.followMap).slice(0, 4);
    followKeys.forEach(k => {
      const arr = Object.entries(data.followMap[k]).sort((a, b) => b[1] - a[1]);
      const first = arr[0] ? arr[0][0] + '(' + arr[0][1] + ')' : '-';
      const second = arr[1] ? arr[1][0] + '(' + arr[1][1] + ')' : '-';
      const exclude = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => !arr.some(x => x[0] === z)).slice(0, 2).join('、');
      followTableHtml += '<tr><td>' + k + '</td><td>' + first + '</td><td>' + second + '</td><td>' + (exclude || '-') + '</td></tr>';
    });

    let zodiacTotalHtml = '';
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      const cnt = data.zodCount[z];
      const miss = data.zodMiss[z];
      const rate = ((cnt / data.total) * 100).toFixed(0) + '%';
      const level = Business.getZodiacLevel(cnt, miss, data.total);
      zodiacTotalHtml += '<div class="data-item-z ' + level.cls + '">' + z + '<br>' + cnt + '次/' + rate + '<br>遗' + miss + '</div>';
    });

    let zodiacMissHtml = '';
    const missSort = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 3);
    missSort.forEach(function(entry) {
      const z = entry[0], m = entry[1];
      const avgMiss = data.zodAvgMiss[z];
      const tag = m > avgMiss ? '超平均' : '';
      zodiacMissHtml += '<div class="data-item-z cold">' + z + '<br>遗' + m + '期<br>' + tag + '</div>';
    });

    ViewAnalysis.renderZodiacAnalysis({
      combo1, combo2, combo3,
      tailZodiacHtml, followTableHtml, zodiacTotalHtml, zodiacMissHtml,
      finalNums: Business.renderZodiacFinalNums(data)
    });
  },

  /**
   * 渲染生肖精选号码
   * @param {Object} data - 分析数据
   */
  renderZodiacFinalNums: (data) => {
    const state = StateManager._state;
    const numZodiacMap = new Map();
    const latestItem = data.list[0];
    if(latestItem) {
      const codeArr = (latestItem.openCode || '').split(',');
      const zodArrRaw = (latestItem.zodiac || '').split(',');
      const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
      codeArr.forEach((num, idx) => {
        const numVal = Number(num);
        if(numVal && zodArr[idx]) numZodiacMap.set(numVal, zodArr[idx]);
      });
    }

    const coreZodiacs = data.topZod.slice(0, 2).map(i => i[0]);
    const missZodiac = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 1).map(i => i[0]);
    if(missZodiac.length && !coreZodiacs.includes(missZodiac[0])) coreZodiacs.push(missZodiac[0]);

    const hotTails = data.topTail.slice(0, 3).map(i => i.t);

    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod = numZodiacMap.get(num);
      const tail = num % 10;
      if(coreZodiacs.includes(zod) && hotTails.includes(tail)) {
        const miss = data.zodMiss[zod] || 0;
        const count = data.zodCount[zod] || 0;
        candidateNums.push({ num, weight: count * 10 + (10 - miss) });
      }
    }

    const targetCount = state.analysis.selectedNumCount;
    candidateNums.sort((a, b) => b.weight - a.weight);
    let finalNums = candidateNums.slice(0, targetCount).map(i => i.num);

    if(finalNums.length < targetCount) {
      const fillNums = [...new Set(data.list.map(item => Business.getSpecial(item).te))]
        .filter(num => !finalNums.includes(num))
        .slice(0, targetCount - finalNums.length);
      finalNums.push(...fillNums);
    }

    finalNums.sort((a, b) => a - b);
    const finalFormatNums = finalNums.map(num => String(num).padStart(2, '0'));
    return '✅ 精选特码：' + (finalFormatNums.join(' ') || '无');
  },

  /**
   * 同步全维度分析
   */
  syncAnalyze: () => {
    const customNumEl = document.getElementById('customNum');
    const analyzeSelectEl = document.getElementById('analyzeSelect');
    const custom = customNumEl ? customNumEl.value.trim() : '';
    const selectVal = analyzeSelectEl ? analyzeSelectEl.value : '12';
    const historyData = StateManager._state.analysis.historyData;

    let newLimit;
    if(custom && !isNaN(custom) && custom > 0) {
      newLimit = Number(custom);
    } else if(selectVal === 'all') {
      const currentYear = new Date().getFullYear();
      const yearData = historyData.filter(item => {
        const expect = item.expect || '';
        return String(expect).startsWith(String(currentYear));
      });
      newLimit = yearData.length;
    } else {
      newLimit = Number(selectVal);
    }

    const newAnalysis = { ...StateManager._state.analysis, analyzeLimit: newLimit };
    StateManager.setState({ analysis: newAnalysis }, false);

    ViewAnalysis.syncSelectors({ zodiacAnalyzeSelect: selectVal, zodiacCustomNum: custom });

    Business.renderFullAnalysis();
    Business.renderZodiacAnalysis();
  },

  /**
   * 同步生肖关联分析
   */
  syncZodiacAnalyze: () => {
    const zodiacCustomNumEl = document.getElementById('zodiacCustomNum');
    const zodiacAnalyzeSelectEl = document.getElementById('zodiacAnalyzeSelect');
    const numCountSelectEl = document.getElementById('numCountSelect');
    const customNumCountEl = document.getElementById('customNumCount');

    const customPeriod = zodiacCustomNumEl ? zodiacCustomNumEl.value.trim() : '';
    const selectPeriodVal = zodiacAnalyzeSelectEl ? zodiacAnalyzeSelectEl.value : '36';
    const historyData = StateManager._state.analysis.historyData;

    let newLimit;
    if(customPeriod && !isNaN(customPeriod) && customPeriod > 0) {
      newLimit = Number(customPeriod);
    } else if(selectPeriodVal === 'all') {
      const currentYear = new Date().getFullYear();
      const yearData = historyData.filter(item => {
        const expect = item.expect || '';
        return String(expect).startsWith(String(currentYear));
      });
      newLimit = yearData.length;
    } else {
      newLimit = Number(selectPeriodVal);
    }

    const countVal = numCountSelectEl ? numCountSelectEl.value : '5';
    const customCount = customNumCountEl ? customNumCountEl.value.trim() : '';
    let finalCount = 5;

    if(countVal === 'custom') {
      finalCount = customCount && !isNaN(customCount) && Number(customCount) >= 1 && Number(customCount) <= 49
        ? Number(customCount) : 5;
    } else {
      finalCount = Number(countVal);
    }

    const newAnalysis = { ...StateManager._state.analysis, analyzeLimit: newLimit, selectedNumCount: finalCount };
    StateManager.setState({ analysis: newAnalysis }, false);

    ViewAnalysis.syncSelectors({
      analyzeSelect: selectPeriodVal,
      customNum: customPeriod,
      customNumCountVisible: countVal === 'custom'
    });

    Business.renderFullAnalysis();
    Business.renderZodiacAnalysis();
  },

  /**
   * 切换详情显示
   * @param {string} targetId - 目标元素ID
   */
  toggleDetail: (targetId) => {
    ViewAnalysis.toggleDetail(targetId);
  },

  /**
   * 切换分析标签页
   * @param {string} tab - 标签名
   */
  switchAnalysisTab: (tab) => {
    ViewAnalysis.switchTabUI(tab);
    const newAnalysis = { ...StateManager._state.analysis, currentTab: tab };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  /**
   * 加载更多历史
   */
  loadMoreHistory: () => {
    const state = StateManager._state;
    const newShowCount = state.analysis.showCount + 30;
    const newAnalysis = { ...state.analysis, showCount: newShowCount };
    StateManager.setState({ analysis: newAnalysis }, false);
    Business.renderHistory();
    ViewAnalysis.updateLoadMoreBtn(newShowCount < StateManager._state.analysis.historyData.length);
  },

  /**
   * 开始倒计时
   */
  startCountdown: () => {
    const state = StateManager._state;
    if(state.analysis.countdownTimer) clearInterval(state.analysis.countdownTimer);
    const timer = setInterval(() => {
      const now = new Date();
      const target = new Date();
      target.setHours(21, 32, 32, 0);
      if(now > target) target.setDate(target.getDate() + 1);
      const diff = target - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      ViewAnalysis.updateCountdown(h + ':' + m + ':' + s);
    }, 1000);
    const newAnalysis = { ...state.analysis, countdownTimer: timer };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  /**
   * 检查是否在开奖时间
   * @returns {boolean} 是否在开奖时间
   */
  isInDrawTime: () => {
    const now = new Date();
    const h = now.getHours();
    const m = now.getMinutes();
    return h === 21 && m >= 32 && m <= 40;
  },

  /**
   * 开始自动刷新
   */
  startAutoRefresh: () => {
    const state = StateManager._state;
    if(state.analysis.autoRefreshTimer) clearInterval(state.analysis.autoRefreshTimer);

    const newTimer = setInterval(() => {
      if(Business.isInDrawTime()) {
        Business.refreshHistory();
      } else {
        clearInterval(state.analysis.autoRefreshTimer);
        const newAnalysis = {
          ...StateManager._state.analysis,
          autoRefreshTimer: null
        };
        StateManager.setState({ analysis: newAnalysis }, false);
      }
    }, 20000);

    const newAnalysis = {
      ...state.analysis,
      autoRefreshTimer: newTimer
    };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  /**
   * 检查开奖时间循环
   */
  checkDrawTimeLoop: () => {
    const state = StateManager._state;
    if(state.analysis.drawTimeLoopTimer) clearInterval(state.analysis.drawTimeLoopTimer);
    const timer = setInterval(() => {
      if(Business.isInDrawTime() && !StateManager._state.analysis.autoRefreshTimer) {
        Business.startAutoRefresh();
      }
    }, 60000);
    const newAnalysis = { ...state.analysis, drawTimeLoopTimer: timer };
    StateManager.setState({ analysis: newAnalysis }, false);
  },

  /**
   * 滚动到指定模块
   * @param {string} targetId - 模块ID
   */
  scrollToModule: (targetId) => {
    ViewFilter.scrollToModule(targetId);
    Business.toggleQuickNav(false);
  },

  /**
   * 切换快捷导航展开/收起
   * @param {boolean|null} isOpen - 强制指定展开/收起
   */
  toggleQuickNav: (isOpen = null) => {
    const shouldOpen = isOpen === null ? !ViewFilter.isQuickNavExpanded() : isOpen;
    ViewFilter.toggleQuickNavUI(shouldOpen);
  },

  /**
   * 返回顶部
   */
  backToTop: () => {
    ViewFilter.backToTop();
  },

  /**
   * 滚动事件处理（已节流优化）
   */
  handleScroll: Utils.throttle(() => {
    const state = StateManager._state;
    const scrollTop = ViewFilter.getScrollTop();
    clearTimeout(state.scrollTimer);

    if(scrollTop > CONFIG.BACK_TOP_THRESHOLD){
      ViewFilter.toggleBackTopBtn(true);
      state.scrollTimer = setTimeout(() => {
        ViewFilter.toggleBackTopBtn(false);
      }, CONFIG.SCROLL_HIDE_DELAY);
    } else {
      ViewFilter.toggleBackTopBtn(false);
    }
  }, CONFIG.SCROLL_THROTTLE_DELAY),

  /**
   * 页面卸载清理，避免内存泄漏
   */
  handlePageUnload: () => {
    StateManager.clearAllTimers();
    ViewFilter.cleanupPageEvents(Business.handleScroll, Business.handlePageUnload);
  },

  // ====================== 生肖预测相关 ======================
  initZodiacPrediction: () => {
    var state = StateManager._state;
    var historyData = state.analysis.historyData;
    if (!historyData || !historyData.length) {
      Business.loadHistoryCache();
      historyData = StateManager._state.analysis.historyData;
    }
    Business.renderZodiacPrediction();
    Business.initZodiacBacktest();
  },

  renderZodiacPrediction: () => {
    var state = StateManager._state;
    var historyData = state.analysis.historyData;
    if (!historyData || !historyData.length) {
      ViewZodiacPrediction.renderEmpty();
      return;
    }
    var result = ZodiacPrediction.calcContinuousScores(historyData);
    ViewZodiacPrediction.renderPrediction(result);
  },

  initZodiacBacktest: () => {
    var state = StateManager._state;
    var historyData = state.analysis.historyData;
    if (!historyData || !historyData.length) {
      ViewZodiacPrediction.renderBacktest(null);
      ViewZodiacPrediction.renderStrategyPanel(null);
      return;
    }
    ViewZodiacPrediction.renderBacktestEmpty();
    ViewZodiacPrediction.renderStrategyPanel(null);
    setTimeout(function() {
      var result = ZodiacPrediction.runBacktest(historyData);
      ViewZodiacPrediction.renderBacktest(result);
      if (result) {
        var newTuned = ZodiacPrediction.analyzeBacktest(result);
        ViewZodiacPrediction.renderStrategyPanel(newTuned);
      }
    }, 100);
  },

  switchZodiacTab: (tab) => {
    ViewZodiacPrediction.switchTabUI(tab);
    if (tab === 'predict') Business.renderZodiacPrediction();
    if (tab === 'giong') Business.initGiongTab();
    if (tab === 'db') Business.initDBAlgorithm();
    if (tab === 'ultimate') Business.initUltimateAlgorithm();
  },

  initGiongTab: () => {
    var state = StateManager._state;
    var historyData = state.analysis.historyData;
    if (!historyData || !historyData.length) {
      Business.loadHistoryCache();
      historyData = StateManager._state.analysis.historyData;
    }
    if (!historyData || !historyData.length) return;

    var freqResult = ZodiacPrediction.calcFrequencyRating(historyData);
    ViewZodiacPrediction.renderFrequencyRating(freqResult);

    var patternResult = ZodiacPrediction.analyzeZonePatterns(historyData);

    if (freqResult && patternResult) {
      var recommend = ZodiacPrediction.getZoneRecommend(historyData, freqResult, patternResult);
      var nextExpect = (Number(historyData[0].expect || 0) + 1) || '';
      ViewZodiacPrediction.renderZoneRecommend(recommend, nextExpect);
    }

    ViewZodiacPrediction.renderZoneBacktestEmpty();
    setTimeout(function() {
      var zoneBt = ZodiacPrediction.runZoneBacktest(historyData);
      if (zoneBt) ViewZodiacPrediction.renderZoneBacktest(zoneBt);
    }, 150);
  },

  initDBAlgorithm: () => {
    var state = StateManager._state;
    var historyData = state.analysis.historyData;
    if (!historyData || !historyData.length) {
      Business.loadHistoryCache();
      historyData = StateManager._state.analysis.historyData;
    }
    if (!historyData || !historyData.length) {
      ViewZodiacPrediction.renderDBAlgorithm(null, null, null);
      return;
    }

    var numArray = BusinessGiong.historyDataToNumArray(historyData);
    var result = BusinessGiong.generateFullResult(numArray);
    var displayData = BusinessGiong.formatResultForDisplay(result);

    var expect = historyData[0] ? historyData[0].expect : '';
    var currentNum = numArray[0] || 0;
    Business.saveGiongBacktestRecord(displayData, currentNum, expect);

    var backtestStats = Business.calculateGiongBacktestStats(expect);

    ViewZodiacPrediction.renderGiongAlgorithm(displayData, backtestStats);
  },

  initUltimateAlgorithm: () => {
    var state = StateManager._state;
    var historyData = state.analysis.historyData;
    if (!historyData || !historyData.length) {
      Business.loadHistoryCache();
      historyData = StateManager._state.analysis.historyData;
    }
    if (!historyData || !historyData.length) {
      ViewZodiacPrediction.renderUltimateAlgorithm(null);
      ViewZodiacPrediction.renderUltimateBacktestEmpty();
      return;
    }

    var ultimateHistory = BusinessUltimate.historyDataToUltimateFormat(historyData);
    if (!ultimateHistory || !ultimateHistory.length) {
      ViewZodiacPrediction.renderUltimateAlgorithm(null);
      ViewZodiacPrediction.renderUltimateBacktestEmpty();
      return;
    }

    var report = BusinessUltimate.generateFullReport(ultimateHistory);
    var nextExpect = Number(historyData[0].expect || 0) + 1;
    var numbers = report.numbers ? (report.numbers.mainNumbers || report.numbers.transitionNumbers || []) : [];

    if (numbers.length > 0) {
      BusinessUltimate.saveRecommendHistory(nextExpect, numbers);
    }

    ViewZodiacPrediction.renderUltimateAlgorithm({
      report: report,
      nextExpect: nextExpect,
      numbers: BusinessUltimate.formatNumbersToDisplay(numbers),
      alternative: report.numbers ? BusinessUltimate.formatNumbersToDisplay(report.numbers.alternativeNumbers || []) : [],
      adaptiveInfo: BusinessUltimate.getAdaptiveState()
    });

    if (ultimateHistory.length >= 25) {
      ViewZodiacPrediction.renderUltimateBacktestEmpty();
      var currentBackupCount = (report.numbers && report.numbers.alternativeNumbers) ? report.numbers.alternativeNumbers.length : (BusinessUltimate.getAdaptiveState().currentBackupCount || 3);
      setTimeout(function() {
        var btSummary = BusinessUltimate.runBacktest(ultimateHistory);
        if (btSummary) ViewZodiacPrediction.renderUltimateBacktest(btSummary, currentBackupCount);
      }, 100);
    } else {
      ViewZodiacPrediction.renderUltimateBacktestEmpty();
    }
  },

  saveDBBacktestRecord: (result, currentNum, expect) => {
    if (!result || !result.main) return;

    var records = Storage.getDBBacktestRecords();

    records = Business._deduplicateByExpect(records);
    records = Business._cleanInvalidRecords(records, expect);

    if (expect && currentNum >= 1 && currentNum <= 12) {
      var prevExpect = String(Number(expect) - 1);
      var prevIndex = records.findIndex(function(r) {
        return r.expect === prevExpect && r.actualResult === null;
      });
      if (prevIndex !== -1) {
        var prevRecord = records[prevIndex];
        prevRecord.actualResult = currentNum;
        var mainHit = prevRecord.mainPredictions.indexOf(BusinessPredictOld._toZodiac(currentNum)) !== -1;
        var backupHit = prevRecord.backupPredictions.indexOf(BusinessPredictOld._toZodiac(currentNum)) !== -1;
        if (mainHit) {
          prevRecord.isHit = true;
          prevRecord.hitType = 'main';
        } else if (backupHit) {
          prevRecord.isHit = true;
          prevRecord.hitType = 'backup';
        } else {
          prevRecord.isHit = false;
          prevRecord.hitType = null;
        }
      }
    }

    if (expect) {
      var existingIndex = records.findIndex(function(r) { return r.expect === expect; });
      if (existingIndex !== -1) {
        var existRecord = records[existingIndex];

        var samePredictions = JSON.stringify(existRecord.mainPredictions) === JSON.stringify(result.main.slice()) &&
                               JSON.stringify(existRecord.backupPredictions) === JSON.stringify(result.backup ? result.backup.slice() : []);
        if (!samePredictions) {
          existRecord.mainPredictions = result.main.slice();
          existRecord.backupPredictions = result.backup ? result.backup.slice() : [];
          existRecord.currentNum = currentNum;
        }

        Storage.saveDBBacktestRecords(records);
        return;
      }
    } else {
      if (records.length > 0 && currentNum >= 1 && currentNum <= 12) {
        var lastRecord = records[0];
        if (lastRecord.actualResult === null) {
          lastRecord.actualResult = currentNum;
          var mainHit2 = lastRecord.mainPredictions.indexOf(BusinessPredictOld._toZodiac(currentNum)) !== -1;
          var backupHit2 = lastRecord.backupPredictions.indexOf(BusinessPredictOld._toZodiac(currentNum)) !== -1;
          if (mainHit2) {
            lastRecord.isHit = true;
            lastRecord.hitType = 'main';
          } else if (backupHit2) {
            lastRecord.isHit = true;
            lastRecord.hitType = 'backup';
          } else {
            lastRecord.isHit = false;
            lastRecord.hitType = null;
          }
        }
        Storage.saveDBBacktestRecords(records);
        return;
      }
    }

    var now = new Date();
    var recordId = now.getTime();

    var newRecord = {
      id: recordId,
      predictTime: now.toISOString(),
      expect: expect || '',
      mainPredictions: result.main.slice(),
      backupPredictions: result.backup ? result.backup.slice() : [],
      currentNum: currentNum,
      actualResult: null,
      isHit: null,
      hitType: null
    };

    records.unshift(newRecord);
    var maxRecords = 50;
    if (records.length > maxRecords) {
      records = records.slice(0, maxRecords);
    }

    Storage.saveDBBacktestRecords(records);
  },

  _deduplicateByExpect: (records) => {
    if (!records || !Array.isArray(records) || records.length <= 1) return records || [];

    var seen = {};
    var unique = [];

    for (var i = records.length - 1; i >= 0; i--) {
      var record = records[i];
      var key = record.expect || ('time_' + record.predictTime);
      if (!seen[key]) {
        seen[key] = true;
        unique.unshift(record);
      }
    }

    return unique;
  },

  _cleanInvalidRecords: (records, latestExpect) => {
    if (!records || !records.length || !latestExpect) return records;

    var cleaned = false;
    var latestNum = Number(latestExpect);

    records.forEach(function(record) {
      if (!record.expect) return;

      var recordExpect = Number(record.expect);
      if (isNaN(recordExpect)) return;

      if (recordExpect > latestNum && record.actualResult !== null) {
        record.actualResult = null;
        record.isHit = null;
        record.hitType = null;
        cleaned = true;
      }

      if (recordExpect === latestNum && record.actualResult === null) {
      }
    });

    return records;
  },

  saveGiongBacktestRecord: (giongData, currentNum, expect) => {
    if (!giongData || giongData.insufficient) return;

    var mainPredictions = giongData.mergedResult ? giongData.mergedResult.main.map(function(item) { return item.zodiac; }) : [];
    var backupPredictions = giongData.mergedResult ? giongData.mergedResult.backup.map(function(item) { return item.zodiac; }) : [];

    if (mainPredictions.length === 0) {
      var newMain = giongData.newResult.main.map(function(item) { return item.zodiac; });
      var newBackup = giongData.newResult.backup.map(function(item) { return item.zodiac; });
      mainPredictions = newMain;
      backupPredictions = newBackup;
    }

    var records = Storage.getGiongBacktestRecords();
    records = Business._deduplicateByExpect(records);
    records = Business._cleanInvalidRecords(records, expect);

    if (expect && currentNum >= 1 && currentNum <= 12) {
      var prevExpect = String(Number(expect) - 1);
      var prevIndex = records.findIndex(function(r) {
        return r.expect === prevExpect && r.actualResult === null;
      });
      if (prevIndex !== -1) {
        var prevRecord = records[prevIndex];
        prevRecord.actualResult = currentNum;
        var mainHit = prevRecord.mainPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
        var backupHit = prevRecord.backupPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
        if (mainHit) {
          prevRecord.isHit = true;
          prevRecord.hitType = 'main';
        } else if (backupHit) {
          prevRecord.isHit = true;
          prevRecord.hitType = 'backup';
        } else {
          prevRecord.isHit = false;
          prevRecord.hitType = null;
        }
      }
    }

    if (expect) {
      var existingIndex = records.findIndex(function(r) { return r.expect === expect; });
      if (existingIndex !== -1) {
        var exist = records[existingIndex];
        var sameMain = JSON.stringify(exist.mainPredictions) === JSON.stringify(mainPredictions);
        var sameBackup = JSON.stringify(exist.backupPredictions) === JSON.stringify(backupPredictions);
        if (!sameMain || !sameBackup) {
          exist.mainPredictions = mainPredictions.slice();
          exist.backupPredictions = backupPredictions.slice();
          exist.currentNum = currentNum;
        }
        Storage.saveGiongBacktestRecords(records);
        return;
      }
    } else {
      if (records.length > 0 && currentNum >= 1 && currentNum <= 12) {
        var last = records[0];
        if (last.actualResult === null) {
          last.actualResult = currentNum;
          var mh = last.mainPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
          var bh = last.backupPredictions.indexOf(BusinessGiong._toZodiac(currentNum)) !== -1;
          if (mh) { last.isHit = true; last.hitType = 'main'; }
          else if (bh) { last.isHit = true; last.hitType = 'backup'; }
          else { last.isHit = false; last.hitType = null; }
        }
        Storage.saveGiongBacktestRecords(records);
        return;
      }
    }

    var now = new Date();
    var newRecord = {
      id: now.getTime(),
      predictTime: now.toISOString(),
      expect: expect || '',
      mainPredictions: mainPredictions.slice(),
      backupPredictions: backupPredictions.slice(),
      currentNum: currentNum,
      actualResult: null,
      isHit: null,
      hitType: null
    };

    records.unshift(newRecord);
    if (records.length > 50) records = records.slice(0, 50);
    Storage.saveGiongBacktestRecords(records);
  },

  calculateGiongBacktestStats: (latestExpect) => {
    var records = Storage.getGiongBacktestRecords();
    records = Business._deduplicateByExpect(records);
    records = Business._cleanInvalidRecords(records, latestExpect);
    if (latestExpect) Storage.saveGiongBacktestRecords(records);

    var stats = {
      totalRecords: records.length,
      hitCount: 0,
      mainHitCount: 0,
      backupHitCount: 0,
      missCount: 0,
      pendingCount: 0,
      recentRecords: [],
      consecutiveHits: 0,
      maxConsecutiveHits: 0,
      hitRate: '0.0'
    };

    var validRecords = records.filter(function(r) { return r.isHit !== null; });
    stats.pendingCount = records.length - validRecords.length;

    validRecords.forEach(function(record) {
      if (record.isHit) {
        stats.hitCount++;
        if (record.hitType === 'main') stats.mainHitCount++;
        else if (record.hitType === 'backup') stats.backupHitCount++;
      } else {
        stats.missCount++;
      }
    });

    var tempConsecutive = 0;
    for (var i = validRecords.length - 1; i >= 0; i--) {
      if (validRecords[i].isHit) {
        tempConsecutive++;
        if (tempConsecutive > stats.maxConsecutiveHits) stats.maxConsecutiveHits = tempConsecutive;
      } else {
        tempConsecutive = 0;
      }
    }

    for (var j = 0; j < validRecords.length; j++) {
      if (validRecords[j].isHit) stats.consecutiveHits++;
      else break;
    }

    if (validRecords.length > 0) {
      stats.hitRate = ((stats.hitCount / validRecords.length) * 100).toFixed(1);
    }

    stats.recentRecords = records.slice(0, 8).map(function(r) {
      return {
        id: r.id,
        predictTime: r.predictTime,
        expect: r.expect || '',
        mainPredictions: r.mainPredictions,
        backupPredictions: r.backupPredictions,
        actualResult: r.actualResult ? BusinessGiong._toZodiac(r.actualResult) : null,
        isHit: r.isHit,
        hitType: r.hitType
      };
    });

    return stats;
  }
};
