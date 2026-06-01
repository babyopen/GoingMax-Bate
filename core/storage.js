const Storage = {
  /**
   * 存储key常量
   * @readonly
   * @enum {string}
   */
  KEYS: Object.freeze({
    SAVED_FILTERS: 'savedFilters',
    DATA_VERSION: 'dataVersion',
    HISTORY_DATA: 'historyData',
    HISTORY_TIMESTAMP: 'historyTimestamp',
    ZODIAC_BACKTEST: 'zodiacBacktest',
    GIONG_BACKTEST_RECORDS: 'giongBacktestRecords',
    MARK_HINT_SHOWN: 'markHintShown'
  }),

  /**
   * 内存兜底存储（隐私模式下localStorage不可用时使用）
   * @private
   */
  _memoryStorage: {},

  /**
   * localStorage可用性缓存，避免重复检测
   * @private
   */
  _storageAvailable: null,

  /**
   * 检测localStorage是否可用
   * @returns {boolean} 是否可用
   */
  isLocalStorageAvailable: () => {
    if(Storage._storageAvailable !== null) return Storage._storageAvailable;
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      Storage._storageAvailable = true;
      return true;
    } catch(e) {
      Storage._storageAvailable = false;
      return false;
    }
  },

  /**
   * 获取存储数据
   * @param {string} key - 存储key
   * @param {any} defaultValue - 默认值
   * @returns {any} 存储的值
   */
  get: (key, defaultValue = null) => {
    try {
      if(Storage.isLocalStorageAvailable()){
        const value = localStorage.getItem(key);
        return value ? JSON.parse(value) : defaultValue;
      } else {
        return Storage._memoryStorage[key] || defaultValue;
      }
    } catch(e) {
      console.error('存储读取失败', e);
      return defaultValue;
    }
  },

  /**
   * 写入存储数据
   * @param {string} key - 存储key
   * @param {any} value - 要存储的值
   * @returns {boolean} 是否成功
   */
  set: (key, value) => {
    try {
      const serialized = JSON.stringify(value);
      if(Storage.isLocalStorageAvailable()){
        localStorage.setItem(key, serialized);
      } else {
        Storage._memoryStorage[key] = value;
      }
      return true;
    } catch(e) {
      console.error('存储写入失败', e);
      Toast.show('保存失败，存储空间可能已满');
      return false;
    }
  },

  /**
   * 移除存储数据
   * @param {string} key - 存储key
   * @returns {boolean} 是否成功
   */
  remove: (key) => {
    try {
      if(Storage.isLocalStorageAvailable()){
        localStorage.removeItem(key);
      } else {
        delete Storage._memoryStorage[key];
      }
      return true;
    } catch(e) {
      console.error('存储移除失败', e);
      return false;
    }
  },

  /**
   * 加载并校验保存的方案
   * @returns {Array} 合法的方案列表
   */
  loadSavedFilters: () => {
    // 数据版本校验
    const savedVersion = Storage.get(Storage.KEYS.DATA_VERSION, 0);
    if(savedVersion < CONFIG.DATA_VERSION){
      // 后续可添加数据迁移逻辑
      Storage.set(Storage.KEYS.DATA_VERSION, CONFIG.DATA_VERSION);
    }

    const rawList = Storage.get(Storage.KEYS.SAVED_FILTERS, []);
    const validList = Array.isArray(rawList) ? rawList.filter(Utils.validateFilterItem) : [];
    StateManager.setState({ savedFilters: validList }, false);
    return validList;
  },

  /**
   * 保存方案到本地
   * @param {Object} filterItem - 方案对象
   * @returns {boolean} 是否成功
   */
  saveFilter: (filterItem) => {
    const state = StateManager._state;
    const newList = [filterItem, ...state.savedFilters];
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    if(success) StateManager.setState({ savedFilters: newList });
    return success;
  },

  /**
   * 获取缓存的历史数据
   * @returns {Object|null} { data: Array, timestamp: number }
   */
  getHistoryCache: () => {
    const data = Storage.get(Storage.KEYS.HISTORY_DATA, null);
    const timestamp = Storage.get(Storage.KEYS.HISTORY_TIMESTAMP, 0);
    if(data && Array.isArray(data) && data.length > 0) {
      return { data, timestamp };
    }
    return null;
  },

  /**
   * 保存历史数据到缓存
   * @param {Array} data - 历史数据数组
   */
  saveHistoryCache: (data) => {
    Storage.set(Storage.KEYS.HISTORY_DATA, data);
    Storage.set(Storage.KEYS.HISTORY_TIMESTAMP, Date.now());
  },

  getGiongBacktestRecords: () => {
    return Storage.get(Storage.KEYS.GIONG_BACKTEST_RECORDS, []);
  },

  saveGiongBacktestRecords: (records) => {
    return Storage.set(Storage.KEYS.GIONG_BACKTEST_RECORDS, records);
  }
};
