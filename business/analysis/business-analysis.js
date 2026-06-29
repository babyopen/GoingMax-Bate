/**
 * 【业务层】分析模块相关逻辑
 * 从 business-main.js 拆分出来（v2.0.9）
 * 
 * 职责：
 * - 历史数据加载与刷新
 * - 分析参数同步（期数、号码数量等）
 * - 加载更多历史数据
 */
const BusinessAnalysis = {
  /**
   * 刷新历史数据
   * @param {boolean} silentUpdate - 是否静默更新（不显示Toast/Loading）
   */
  refreshHistory: async (silentUpdate = false) => {
    const state = StateManager._state;
    const cache = Storage.getHistoryCache();
    const cacheLatestExpect = cache && cache.data && cache.data.length 
      ? Number(cache.data[0].expect || 0) 
      : 0;
    const currentHistoryData = BusinessCommonData.getHistoryData(state);
    const currentLatestExpect = currentHistoryData.length 
      ? Number(currentHistoryData[0].expect || 0) 
      : 0;

    if (!silentUpdate && typeof ViewAnalysis !== 'undefined') {
      ViewAnalysis.showHistoryLoading();
    }

    try {
      const year = new Date().getFullYear();
      // 网络请求超时控制（弱网环境避免无限等待）
      const abortController = (typeof AbortController !== 'undefined') 
        ? new AbortController() 
        : null;
      const timeoutId = abortController 
        ? setTimeout(() => abortController.abort(), 10000) 
        : null;
      
      const res = await fetch(
        CONFIG.API.HISTORY + year, 
        abortController ? { signal: abortController.signal } : {}
      );
      
      if (timeoutId) clearTimeout(timeoutId);
      const data = await res.json();
      let rawData = data.data || [];

      // 过滤无效数据
      rawData = rawData.filter(item => {
        const expect = item.expect || '';
        const openCode = item.openCode || '';
        return expect && openCode && openCode.split(',').length === 7;
      });

      // 去重
      const uniqueMap = new Map();
      rawData.forEach(item => {
        const expectNum = Number(item.expect || 0);
        if (expectNum && !isNaN(expectNum)) {
          uniqueMap.set(expectNum, item);
        }
      });

      // 按期数降序排序
      const sortedData = Array.from(uniqueMap.values()).sort((a, b) => {
        return Number(b.expect || 0) - Number(a.expect || 0);
      });

      const newLatestExpect = sortedData.length 
        ? Number(sortedData[0].expect || 0) 
        : 0;

      // 判断是否需要更新
      if (newLatestExpect > currentLatestExpect) {
        // 有新数据，保存到缓存并更新状态
        const now = Date.now();
        Storage.saveHistoryCache(sortedData);
        
        const newAnalysis = {
          ...StateManager._state.analysis,
          historyData: sortedData,
          historyTimestamp: now
        };
        
        StateManager.setState({ analysis: newAnalysis }, false);
        
        // 触发相关业务初始化（委托给主模块）
        if (typeof Business !== 'undefined') {
          Business.renderZodiacPrediction();
          Business.initZodiacBacktest();
          Business.initGiongTab();
        }
        
        const latestItem = sortedData[0];
        if (latestItem && typeof Business !== 'undefined') {
          Business.renderLatest(latestItem);
        }
        
        if (typeof ViewAnalysis !== 'undefined') {
          ViewAnalysis.renderHistory();
          ViewAnalysis.renderFullAnalysis(null);
          ViewAnalysis.renderZodiacAnalysis(null);
        }
        
        if (!silentUpdate) Toast.show('数据加载成功');
        
      } else if (cacheLatestExpect > currentLatestExpect) {
        // 使用缓存数据
        const newAnalysis = {
          ...state.analysis,
          historyData: cache.data,
          historyTimestamp: cache.timestamp || 0
        };
        
        StateManager.setState({ analysis: newAnalysis }, false);
        
        if (typeof Business !== 'undefined') {
          Business.renderZodiacPrediction();
          Business.initZodiacBacktest();
          Business.initGiongTab();
        }
        
        const latestItem = cache.data[0];
        if (latestItem && typeof Business !== 'undefined') {
          Business.renderLatest(latestItem);
        }
        
        if (typeof ViewAnalysis !== 'undefined') {
          ViewAnalysis.renderHistory();
          ViewAnalysis.renderFullAnalysis(null);
          ViewAnalysis.renderZodiacAnalysis(null);
        }
        
        if (!silentUpdate) Toast.show('已加载缓存最新数据');
        
      } else {
        // 已是最新
        if (!silentUpdate) Toast.show('已是最新数据');
      }
      
    } catch (e) {
      console.error('获取历史数据失败:', e);
      if (!silentUpdate && typeof ViewAnalysis !== 'undefined') {
        ViewAnalysis.showHistoryError();
      }
      Toast.show('网络请求失败，请检查网络连接');
    }
  },
  
  /**
   * 加载更多历史数据（分页）
   */
  loadMoreHistory: () => {
    const state = StateManager._state;
    const currentShowCount = state.analysis.showCount || 20;
    const newShowCount = currentShowCount + 20;
    
    StateManager.setState({
      analysis: {
        ...state.analysis,
        showCount: newShowCount
      }
    });
  },
  
  /**
   * 同步全维度分析参数（由 event.js 传入 DOM 值，符合分层规范）
   * @param {Object} domValues - { custom: string, selectVal: string }
   */
  syncAnalyze: (domValues) => {
    const { custom, selectVal } = domValues || {};
    const state = StateManager._state;
    
    let analyzeLimit = state.analysis.analyzeLimit || 12;
    
    if (selectVal === 'custom' && custom) {
      const num = parseInt(custom, 10);
      if (!isNaN(num) && num >= 1 && num <= 100) {
        analyzeLimit = num;
      }
    } else if (selectVal && selectVal !== 'custom') {
      const num = parseInt(selectVal, 10);
      if (!isNaN(num)) {
        analyzeLimit = num;
      }
    }
    
    StateManager.setState({
      analysis: {
        ...state.analysis,
        analyzeLimit
      }
    });
  },
  
  /**
   * 同步生肖分析参数
   * @param {Object} domValues - { customPeriod, selectPeriodVal, countVal, customCount }
   */
  syncZodiacAnalyze: (domValues) => {
    const { customPeriod, selectPeriodVal, countVal, customCount } = domValues || {};
    const state = StateManager._state;
    
    let analyzeLimit = state.analysis.analyzeLimit || 36;
    let selectedNumCount = state.analysis.selectedNumCount || 5;
    
    // 处理期数
    if (selectPeriodVal === 'custom' && customPeriod) {
      const num = parseInt(customPeriod, 10);
      if (!isNaN(num) && num >= 1 && num <= 100) {
        analyzeLimit = num;
      }
    } else if (selectPeriodVal && selectPeriodVal !== 'custom') {
      const num = parseInt(selectPeriodVal, 10);
      if (!isNaN(num)) {
        analyzeLimit = num;
      }
    }
    
    // 处理号码数量
    if (countVal === 'custom' && customCount) {
      const num = parseInt(customCount, 10);
      if (!isNaN(num) && num >= 1 && num <= 49) {
        selectedNumCount = num;
      }
    } else if (countVal && countVal !== 'custom') {
      const num = parseInt(countVal, 10);
      if (!isNaN(num)) {
        selectedNumCount = num;
      }
    }
    
    StateManager.setState({
      analysis: {
        ...state.analysis,
        analyzeLimit,
        selectedNumCount
      }
    });
  }
};
