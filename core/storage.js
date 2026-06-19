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
    MARK_HINT_SHOWN: 'markHintShown',
    // 用户偏好（区域变动追踪卡片展开状态）
    ZONE_CHANGE_EXPANDED: 'zoneChangeExpanded',
    // 当前主页临时筛选状态（新增：用于后台返回/页面刷新后恢复未保存的筛选）
    CURRENT_FILTER: 'currentFilter',
    // 2026-06-20 新增：方案分组相关存储
    //   FILTER_GROUPS: 分组列表（含每分组的完整快照：savedFilters/selected/excluded/locked/marked/markCount/excludeHistory/lockExclude/showAllFilters）
    //   CURRENT_GROUP_ID: 当前激活分组 ID
    FILTER_GROUPS: 'filterGroups',
    CURRENT_GROUP_ID: 'currentGroupId'
    // 注：页面子标签记忆（profile/analysis/random）改由 TAB_MEMORY 配置表管理，见下方
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
  },

  /**
   * 获取区域变动追踪卡片的展开状态
   * @returns {boolean} 是否展开
   */
  getZoneChangeExpanded: () => {
    return Storage.get(Storage.KEYS.ZONE_CHANGE_EXPANDED, false);
  },

  /**
   * 保存区域变动追踪卡片的展开状态
   * @param {boolean} expanded - 是否展开
   */
  saveZoneChangeExpanded: (expanded) => {
    return Storage.set(Storage.KEYS.ZONE_CHANGE_EXPANDED, !!expanded);
  },

  // ============================================================
  // 新增：当前主页临时筛选状态持久化（2026-06-07）
  // 用途：解决"后台返回/页面刷新后丢失未保存的筛选"问题
  // 设计：与 SAVED_FILTERS（已命名方案）相互独立，互不干扰
  // ============================================================

  /**
   * 保存当前主页临时筛选状态到 localStorage
   * @param {Object} payload - 包含 selected/excluded/locked/marked/markCount/excludeHistory 的对象
   * @returns {boolean} 是否成功
   */
  saveCurrentFilter: (payload) => {
    if(!payload || typeof payload !== 'object') return false;
    // 只持久化白名单字段，避免写入临时定时器/分析状态
    const safe = {
      selected: payload.selected || {},
      excluded: Array.isArray(payload.excluded) ? payload.excluded : [],
      locked: payload.locked || {},
      marked: payload.marked || {},
      markCount: payload.markCount || {},
      excludeHistory: Array.isArray(payload.excludeHistory) ? payload.excludeHistory : [],
      lockExclude: !!payload.lockExclude,
      showAllFilters: !!payload.showAllFilters,
      _ts: Date.now()
    };
    return Storage.set(Storage.KEYS.CURRENT_FILTER, safe);
  },

  /**
   * 加载并校验当前主页临时筛选状态
   * @returns {Object|null} 合法的状态对象；无缓存/校验失败返回 null
   */
  loadCurrentFilter: () => {
    const raw = Storage.get(Storage.KEYS.CURRENT_FILTER, null);
    if(!raw || typeof raw !== 'object') return null;

    // 7 天过期自动失效，避免历史脏数据长期生效
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if(raw._ts && (Date.now() - raw._ts) > SEVEN_DAYS) {
      Storage.remove(Storage.KEYS.CURRENT_FILTER);
      return null;
    }

    // 字段校验
    const safe = {
      selected: (raw.selected && typeof raw.selected === 'object') ? raw.selected : {},
      excluded: Array.isArray(raw.excluded) ? raw.excluded : [],
      locked: (raw.locked && typeof raw.locked === 'object') ? raw.locked : {},
      marked: (raw.marked && typeof raw.marked === 'object') ? raw.marked : {},
      markCount: (raw.markCount && typeof raw.markCount === 'object') ? raw.markCount : {},
      excludeHistory: Array.isArray(raw.excludeHistory) ? raw.excludeHistory : [],
      lockExclude: !!raw.lockExclude,
      showAllFilters: !!raw.showAllFilters,
      _ts: raw._ts || Date.now()
    };

    // 兜底：selected 必须包含所有 group（缺失补空数组）
    const expectedGroups = ['zodiac','color','colorsx','type','element','head','tail','sum','sumOdd','sumSize','tailSize','bs','hot','num'];
    expectedGroups.forEach(g => {
      if(!Array.isArray(safe.selected[g])) safe.selected[g] = [];
    });

    return safe;
  },

  /**
   * 清除当前主页临时筛选状态缓存
   * @returns {boolean} 是否成功
   */
  clearCurrentFilter: () => {
    return Storage.remove(Storage.KEYS.CURRENT_FILTER);
  },

  // ============================================================
  // 新增：页面离开时子标签记忆（2026-06-08）
  // 用途：在『我的/广播/资料』页面切换到任意子标签后离开到其他页面，
  //       再次回到时还原离开时的 tab；首次进入使用各页面默认
  // 设计：TAB_MEMORY 配置驱动，新增页面只需添加配置项
  // ============================================================
  TAB_MEMORY: Object.freeze({
    profile: {
      key: 'profileLastTab',
      default: 'mine',
      valid: ['mine', 'official', 'phoenix', 'daxian']
    },
    analysis: {
      key: 'analysisLastTab',
      default: 'history',
      valid: ['history', 'analysis', 'zodiac']
    },
    random: {
      key: 'randomLastTab',
      default: 'ultimate',
      // 注意：『主推』(main) 是从快捷导航进入的（顶部 tab 栏未列出），但需要支持记忆
      valid: ['main', 'ultimate', 'predict', 'giong']
    }
  }),

  /**
   * 获取指定页面上次的子标签
   * @param {string} pageName - profile / analysis / random
   * @returns {string|null} 合法子标签；未配置返回 null
   */
  getLastTab: (pageName) => {
    const conf = Storage.TAB_MEMORY[pageName];
    if (!conf) return null;
    const v = Storage.get(conf.key, conf.default);
    return conf.valid.indexOf(v) >= 0 ? v : conf.default;
  },

  /**
   * 保存指定页面当前子标签
   * @param {string} pageName - profile / analysis / random
   * @param {string} tab - 当前 tab
   * @returns {boolean} 是否成功；未配置或非法值返回 false
   */
  saveLastTab: (pageName, tab) => {
    const conf = Storage.TAB_MEMORY[pageName];
    if (!conf) return false;
    if (conf.valid.indexOf(tab) < 0) return false;
    return Storage.set(conf.key, tab);
  }
};
