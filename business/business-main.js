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
      Business.renderZodiacPrediction();
      Business.initZodiacBacktest();
      Business.initGiongTab();
      ViewAnalysis.updateLoadMoreBtn(
        StateManager._state.analysis.historyData.length > StateManager._state.analysis.showCount
      );
    }
  },

  /**
   * 初始化分析页面
   */
  initAnalysisPage: () => {
    return;
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
        if(!silentUpdate) Toast.show('数据加载成功');
      } else if(cacheLatestExpect > currentLatestExpect) {
        const newAnalysis = { ...state.analysis, historyData: cache.data };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        Business.initDBAlgorithm();
        if(!silentUpdate) Toast.show('已加载缓存最新数据');
      } else {
        if(!silentUpdate) Toast.show('已是最新数据');
      }
    } catch(e) {
      console.error('加载历史数据失败', e);
      if(cacheLatestExpect > currentLatestExpect) {
        const newAnalysis = { ...state.analysis, historyData: cache.data };
        StateManager.setState({ analysis: newAnalysis }, false);
        Business.renderZodiacPrediction();
        Business.initZodiacBacktest();
        Business.initGiongTab();
        Business.initDBAlgorithm();
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
    return;
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
    return;
  },

  /**
   * 计算全维度分析
   * @returns {Object} 分析数据
   */
  calcFullAnalysis: () => {
    return null;
  },

  /**
   * 渲染全维度分析
   */
  renderFullAnalysis: () => {
    ViewAnalysis.renderFullAnalysis(null);
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
    return null;
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

    ViewAnalysis.renderZodiacAnalysis(null);
  },

  /**
   * 渲染生肖精选号码
   * @param {Object} data - 分析数据
   */
  renderZodiacFinalNums: (data) => {
    return '';
  },

  /**
   * 同步全维度分析
   */
  syncAnalyze: () => {
    return;
  },

  /**
   * 同步生肖关联分析
   */
  syncZodiacAnalyze: () => {
    return;
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
    ViewAnalysis.updateLoadMoreBtn(newShowCount < state.analysis.historyData.length);
  },

  /**
   * 开始倒计时
   */
  startCountdown: () => {
    return;
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
    return;
  },

  /**
   * 检查开奖时间循环
   */
  checkDrawTimeLoop: () => {
    return;
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
    ViewZodiacPrediction.renderZoneAnalysis(patternResult);

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
        console.log('[DB回测-核对] 期号', prevExpect, '开奖:', BusinessPredictOld._toZodiac(currentNum), '→', prevRecord.isHit ? (prevRecord.hitType === 'main' ? '主推中✓' : '备选中○') : '未命中✗');
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
          console.log('[DB回测-更新] 期号', expect, '预测内容已更新，重置为待开奖');
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

    console.log('[DB回测-新建] 期号', expect || '(无期号)', '推荐:', result.main.join(' '), result.backup ? '(' + result.backup.join(' ') + ')' : '');

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

    console.log('[DB回测-去重] 原始记录数:', records.length, '→ 去重后:', unique.length);

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
        console.log('[DB回测-清理] 期号', record.expect, '是未来期却被标记为已开奖，重置为待开奖');
        record.actualResult = null;
        record.isHit = null;
        record.hitType = null;
        cleaned = true;
      }

      if (recordExpect === latestNum && record.actualResult === null) {
        console.log('[DB回测-清理] 期号', record.expect, '是当前最新期但未开奖，保持待开奖');
      }
    });

    if (cleaned) {
      console.log('[DB回测-清理] 已清理无效的核对数据');
    }

    return records;
  },

  calculateDBBacktestStats: (latestExpect) => {
    var records = Storage.getDBBacktestRecords();

    records = Business._deduplicateByExpect(records);
    records = Business._cleanInvalidRecords(records, latestExpect);

    if (latestExpect) {
      Storage.saveDBBacktestRecords(records);
    }

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
        if (record.hitType === 'main') {
          stats.mainHitCount++;
        } else if (record.hitType === 'backup') {
          stats.backupHitCount++;
        }
      } else {
        stats.missCount++;
        stats.consecutiveHits = 0;
      }
    });

    var tempConsecutive = 0;
    for (var i = validRecords.length - 1; i >= 0; i--) {
      if (validRecords[i].isHit) {
        tempConsecutive++;
        if (tempConsecutive > stats.maxConsecutiveHits) {
          stats.maxConsecutiveHits = tempConsecutive;
        }
      } else {
        tempConsecutive = 0;
      }
    }

    for (var j = 0; j < validRecords.length; j++) {
      if (validRecords[j].isHit) {
        stats.consecutiveHits++;
      } else {
        break;
      }
    }

    if (validRecords.length > 0) {
      stats.hitRate = ((stats.hitCount / validRecords.length) * 100).toFixed(1);
    }

    stats.recentRecords = records.slice(0, 10).map(function(r) {
      return {
        id: r.id,
        predictTime: r.predictTime,
        expect: r.expect || '',
        mainPredictions: r.mainPredictions,
        backupPredictions: r.backupPredictions,
        actualResult: r.actualResult ? BusinessPredictOld._toZodiac(r.actualResult) : null,
        isHit: r.isHit,
        hitType: r.hitType
      };
    });

    console.log('[DB回测] 统计:', JSON.stringify(stats));
    return stats;
  },

  saveGiongBacktestRecord: (giongData, currentNum, expect) => {
    if (!giongData || giongData.insufficient) return;

    var newMain = giongData.newResult.main.map(function(item) { return item.zodiac; });
    var newBackup = giongData.newResult.backup.map(function(item) { return item.zodiac; });
    var oldMain = giongData.oldResult.main.map(function(item) { return item.zodiac; });
    var oldBackup = giongData.oldResult.backup.map(function(item) { return item.zodiac; });

    var allMain = newMain.slice();
    var allBackup = newBackup.concat(oldMain).concat(oldBackup);

    var seen = {};
    var dedupedBackup = [];
    allBackup.forEach(function(z) {
      if (allMain.indexOf(z) === -1 && !seen[z]) {
        seen[z] = true;
        dedupedBackup.push(z);
      }
    });

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
        var sameMain = JSON.stringify(exist.mainPredictions) === JSON.stringify(allMain);
        var sameBackup = JSON.stringify(exist.backupPredictions) === JSON.stringify(dedupedBackup);
        if (!sameMain || !sameBackup) {
          exist.mainPredictions = allMain.slice();
          exist.backupPredictions = dedupedBackup.slice();
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
      mainPredictions: allMain.slice(),
      backupPredictions: dedupedBackup.slice(),
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
