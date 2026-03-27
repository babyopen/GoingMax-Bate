
// ====================== 1. 常量枚举配置（所有可配置项集中管理，冻结不可修改）======================
/**
 * 全局配置常量
 * @readonly
 * @enum {any}
 */
const CONFIG = Object.freeze({
  VERSION: '26.1.00',
  DATA_VERSION: 1, // 数据版本号，用于后续数据迁移
  // API配置
  API: Object.freeze({
    HISTORY: 'https://history.macaumarksix.com/history/macaujc2/y/'
  }),
  // 动画配置
  TOAST_DURATION: 2000,
  SCROLL_HIDE_DELAY: 1500,
  SCROLL_THROTTLE_DELAY: 100,
  CLICK_DEBOUNCE_DELAY: 50,
  // 布局配置
  BACK_TOP_THRESHOLD: 300,
  TOP_OFFSET: 240,
  PREVIEW_MAX_COUNT: 8,
  MAX_SAVE_COUNT: 30,
  // 生肖配置
  ZODIAC_BASE: Object.freeze({
    '子':'鼠','丑':'牛','寅':'虎','卯':'兔','辰':'龙','巳':'蛇',
    '午':'马','未':'羊','申':'猴','酉':'鸡','戌':'狗','亥':'猪'
  }),
  EARTHLY_BRANCHES: Object.freeze(['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']),
  SPRING_FESTIVAL: Object.freeze({
    2025: '2025-01-29', 2026: '2026-02-17', 2027: '2027-02-06',
    2028: '2028-01-26', 2029: '2029-02-13', 2030: '2030-02-03'
  }),
  // 分类配置
  JIAQIN: Object.freeze(['马','牛','羊','鸡','狗','猪']),
  YESHOU: Object.freeze(['鼠','虎','兔','龙','蛇','猴']),
  NUMBER_GROUPS: Object.freeze(['head','tail','sum']), // 数字类型的分组
  // 号码规则配置
  COLOR_MAP: Object.freeze({
    '红':[1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46],
    '蓝':[3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48],
    '绿':[5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49]
  }),
  ELEMENT_MAP: Object.freeze({
    '金':[4,5,12,13,26,27,34,35,42,43],
    '木':[8,9,16,17,24,25,38,39,46,47],
    '水':[1,14,15,22,23,30,31,44,45],
    '火':[2,3,10,11,18,19,32,33,40,41,48,49],
    '土':[6,7,20,21,28,29,36,37]
  }),
  BIG_RANGE: Object.freeze([25,49]),
  SMALL_RANGE: Object.freeze([1,24]),
  // 分析模块配置
  ANALYSIS: Object.freeze({
    ZODIAC_ALL: Object.freeze(["鼠","牛","虎","兔","龙","蛇","马","羊","猴","鸡","狗","猪"]),
    HOME_ZODIAC: Object.freeze(['鼠','牛','兔','马','羊','鸡','狗','猪']),
    WILD_ZODIAC: Object.freeze(['虎','龙','蛇','猴']),
    ZODIAC_TRAD_TO_SIMP: Object.freeze({
      '鼠': '鼠', '牛': '牛', '虎': '虎', '兔': '兔',
      '龍': '龙', '龙': '龙', '蛇': '蛇', '馬': '马', '马': '马',
      '羊': '羊', '猴': '猴', '雞': '鸡', '鸡': '鸡', '狗': '狗',
      '豬': '猪', '猪': '猪'
    }),
    DEFAULT_PERIOD: 30,
    DEFAULT_SHOW_COUNT: 20
  }),
  // 动作枚举（避免硬编码字符串错误）
  ACTIONS: Object.freeze({
    // 分组操作
    RESET_GROUP: 'resetGroup',
    SELECT_GROUP: 'selectGroup',
    INVERT_GROUP: 'invertGroup',
    CLEAR_GROUP: 'clearGroup',
    // 全局操作
    SELECT_ALL: 'selectAllFilters',
    CLEAR_ALL: 'clearAllFilters',
    SAVE_FILTER: 'saveFilterPrompt',
    CLEAR_ALL_SAVED: 'clearAllSavedFilters',
    // 排除号码操作
    INVERT_EXCLUDE: 'invertExclude',
    UNDO_EXCLUDE: 'undoExclude',
    BATCH_EXCLUDE: 'batchExcludePrompt',
    CLEAR_EXCLUDE: 'clearExclude',
    // 方案操作
    TOGGLE_SHOW_ALL: 'toggleShowAllFilters',
    LOAD_FILTER: 'loadFilter',
    RENAME_FILTER: 'renameFilter',
    COPY_FILTER: 'copyFilterNums',
    TOP_FILTER: 'topFilter',
    DELETE_FILTER: 'deleteFilter',
    // 导航操作
    SWITCH_NAV: 'switchBottomNav'
  })
});

// ====================== 2. 工具函数模块（纯函数，无副作用）======================
/**
 * 通用工具函数
 * @namespace Utils
 */
const Utils = {
  /**
   * 节流函数（优化高频事件）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 节流延迟(ms)
   * @returns {Function} 节流后的函数
   */
  throttle: (fn, delay) => {
    let timer = null;
    return function(...args) {
      if(!timer){
        timer = setTimeout(() => {
          fn.apply(this, args);
          timer = null;
        }, delay);
      }
    }
  },

  /**
   * 防抖函数（优化高频点击）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 防抖延迟(ms)
   * @returns {Function} 防抖后的函数
   */
  debounce: (fn, delay) => {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    }
  },

  /**
   * 深拷贝对象
   * @param {any} obj - 要拷贝的对象
   * @returns {any} 拷贝后的对象
   */
  deepClone: (obj) => {
    try {
      if(typeof obj !== 'object' || obj === null) {
        return obj;
      }
      if(typeof structuredClone === 'function') {
        return structuredClone(obj);
      }
      return JSON.parse(JSON.stringify(obj));
    } catch(e) {
      console.error('深拷贝失败', e);
      return obj;
    }
  },

  /**
   * 标签值类型转换（解决数字/字符串匹配问题）
   * @param {string|number} value - 标签值
   * @param {string} group - 分组名
   * @returns {string|number} 转换后的值
   */
  formatTagValue: (value, group) => {
    return CONFIG.NUMBER_GROUPS.includes(group) ? Number(value) : value;
  },

  /**
   * 获取安全区顶部高度
   * @returns {number} 安全区高度(px)
   */
  getSafeTop: () => {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  },

  /**
   * 校验筛选方案格式
   * @param {any} item - 要校验的方案对象
   * @returns {boolean} 是否合法
   */
  validateFilterItem: (item) => {
    return item && 
      typeof item === 'object' && 
      typeof item.name === 'string' && 
      item.selected && typeof item.selected === 'object' &&
      Array.isArray(item.excluded);
  },

  /**
   * 生成DocumentFragment优化DOM渲染
   * @param {Array} list - 要渲染的列表
   * @param {Function} renderItem - 单个元素渲染函数
   * @returns {DocumentFragment} 生成的文档片段
   */
  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if(el) fragment.appendChild(el);
    });
    return fragment;
  }
};

// ====================== 2.5. 数据查询模块（统一数据查询，打通所有关联关系）======================
/**
 * 数据查询模块 - 打通生肖、五行、波色、家禽野兽、大小单双等所有关联关系
 * @namespace DataQuery
 */
const DataQuery = {
  /**
   * 缓存：号码到所有属性的映射
   * @private
   */
  _numToAttrMap: null,
  
  /**
   * 缓存：属性到号码的反向映射
   * @private
   */
  _attrToNumMap: null,

  /**
   * 初始化数据查询模块（预计算所有映射关系）
   */
  init: () => {
    if(DataQuery._numToAttrMap && DataQuery._attrToNumMap) {
      return;
    }
    
    DataQuery._numToAttrMap = {};
    DataQuery._attrToNumMap = {
      zodiac: {},
      color: {},
      element: {},
      type: {},
      head: {},
      tail: {},
      sum: {},
      bs: {},
      colorsx: {}
    };
    
    for(let num = 1; num <= 49; num++) {
      const attrs = DataQuery.getNumAttrs(num);
      DataQuery._numToAttrMap[num] = attrs;
      
      Object.keys(attrs).forEach(key => {
        if(DataQuery._attrToNumMap[key]) {
          if(!DataQuery._attrToNumMap[key][attrs[key]]) {
            DataQuery._attrToNumMap[key][attrs[key]] = [];
          }
          DataQuery._attrToNumMap[key][attrs[key]].push(num);
        }
      });
    }
  },

  /**
   * 获取单个号码的所有属性
   * @param {number} num - 号码 (1-49)
   * @returns {Object} 包含所有属性的对象
   */
  getNumAttrs: (num) => {
    num = Number(num);
    const s = num.toString().padStart(2, '0');
    const head = Math.floor(num / 10);
    const tail = num % 10;
    const sum = (head + tail) % 10;
    const big = num >= 25 ? '大' : '小';
    const odd = num % 2 === 1 ? '单' : '双';
    const bs = big + odd;
    
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(num));
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(num));
    
    const type = CONFIG.JIAQIN.includes(DataQuery._getZodiacByNum(num)) ? '家禽' : '野兽';
    
    return {
      num,
      s,
      color,
      element,
      zodiac: DataQuery._getZodiacByNum(num),
      type,
      head,
      tail,
      sum,
      big,
      odd,
      bs,
      colorsx: color + odd
    };
  },

  /**
   * 根据号码获取生肖（私有辅助方法）
   * @private
   * @param {number} num - 号码
   * @returns {string} 生肖
   */
  _getZodiacByNum: (num) => {
    const state = StateManager._state;
    if(state.zodiacCycle && state.zodiacCycle.length === 12) {
      return state.zodiacCycle[(num - 1) % 12];
    }
    const fallbackCycle = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    return fallbackCycle[(num - 1) % 12];
  },

  /**
   * 通过属性获取号码列表
   * @param {string} attrType - 属性类型 (zodiac/color/element/type/head/tail/sum/bs/colorsx)
   * @param {string|number} attrValue - 属性值
   * @returns {Array<number>} 号码列表
   */
  getNumsByAttr: (attrType, attrValue) => {
    DataQuery.init();
    if(!DataQuery._attrToNumMap[attrType]) {
      return [];
    }
    return DataQuery._attrToNumMap[attrType][attrValue] || [];
  },

  /**
   * 批量查询：通过多个属性获取交集号码
   * @param {Object} conditions - 查询条件对象 {zodiac: '鼠', color: '红', ...}
   * @returns {Array<number>} 符合所有条件的号码列表
   */
  getNumsByConditions: (conditions) => {
    DataQuery.init();
    let result = Array.from({length: 49}, (_, i) => i + 1);
    
    Object.keys(conditions).forEach(attrType => {
      const attrValue = conditions[attrType];
      const nums = DataQuery.getNumsByAttr(attrType, attrValue);
      result = result.filter(n => nums.includes(n));
    });
    
    return result;
  },

  /**
   * 检查号码是否符合某个属性
   * @param {number} num - 号码
   * @param {string} attrType - 属性类型
   * @param {string|number} attrValue - 属性值
   * @returns {boolean}
   */
  checkNumAttr: (num, attrType, attrValue) => {
    const attrs = DataQuery.getNumAttrs(num);
    return attrs[attrType] === attrValue;
  },

  /**
   * 获取两个号码的所有共同属性
   * @param {number} num1 - 号码1
   * @param {number} num2 - 号码2
   * @returns {Array<string>} 共同属性列表
   */
  getCommonAttrs: (num1, num2) => {
    const attrs1 = DataQuery.getNumAttrs(num1);
    const attrs2 = DataQuery.getNumAttrs(num2);
    const common = [];
    
    ['zodiac', 'color', 'element', 'type', 'big', 'odd', 'bs', 'colorsx'].forEach(key => {
      if(attrs1[key] === attrs2[key]) {
        common.push(key);
      }
    });
    
    return common;
  }
};

// ====================== 3. 状态管理模块（统一管理所有状态，避免状态与视图不同步）======================
/**
 * 状态管理器
 * @namespace StateManager
 */
const StateManager = {
  /**
   * 私有状态对象
   * @private
   */
  _state: {
    selected: {
      zodiac:[], color:[], colorsx:[], type:[], element:[],
      head:[], tail:[], sum:[], bs:[], hot:[]
    },
    excluded: [],
    excludeHistory: [],
    lockExclude: false,
    savedFilters: [],
    showAllFilters: false,
    numList: [],
    currentZodiac: '',
    zodiacCycle: [],
    scrollTimer: null,
    // 分析模块状态
    analysis: {
      historyData: [],
      analyzeLimit: 30,
      selectedNumCount: 5,
      showCount: 20,
      currentTab: 'history',
      autoRefreshTimer: null
    }
  },

  /**
   * 获取只读状态快照
   * @returns {Object} 状态快照
   */
  getState: () => Utils.deepClone(StateManager._state),

  /**
   * 统一更新状态入口
   * @param {Object} partialState - 要更新的部分状态
   * @param {boolean} needRender - 是否自动触发渲染
   */
  setState: (partialState, needRender = true) => {
    try {
      StateManager._state = {
        ...StateManager._state,
        ...partialState
      };
      if(needRender) Render.renderAll();
    } catch(e) {
      console.error('状态更新失败', e);
      Toast.show('操作失败，请刷新重试');
    }
  },

  /**
   * 更新选中的筛选条件
   * @param {string} group - 分组名
   * @param {string|number} value - 选中的值
   */
  updateSelected: (group, value) => {
    const state = StateManager._state;
    const index = state.selected[group].indexOf(value);
    const newSelected = { ...state.selected };
    
    index > -1 
      ? newSelected[group] = newSelected[group].filter(item => item !== value)
      : newSelected[group] = [...newSelected[group], value];

    StateManager.setState({ selected: newSelected });
  },

  /**
   * 重置分组选中状态
   * @param {string} group - 分组名
   */
  resetGroup: (group) => {
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = [];
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 全选分组
   * @param {string} group - 分组名
   */
  selectGroup: (group) => {
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    const allValues = allTags.map(tag => Utils.formatTagValue(tag.dataset.value, group));
    const newSelected = { ...StateManager._state.selected };
    newSelected[group] = allValues;
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 反选分组
   * @param {string} group - 分组名
   */
  invertGroup: (group) => {
    const state = StateManager._state;
    const allTags = [...document.querySelectorAll(`.tag[data-group="${group}"]`)];
    const allValues = allTags.map(tag => Utils.formatTagValue(tag.dataset.value, group));
    const newSelected = { ...state.selected };
    newSelected[group] = allValues.filter(v => !state.selected[group].includes(v));
    StateManager.setState({ selected: newSelected });
  },

  /**
   * 清理所有定时器，避免内存泄漏
   */
  clearAllTimers: () => {
    const state = StateManager._state;
    if(state.scrollTimer) clearTimeout(state.scrollTimer);
    Toast.clearTimer();
  }
};

// ====================== 4. 存储模块（统一管理本地存储，加校验和兜底）======================
/**
 * 本地存储管理器
 * @namespace Storage
 */
const Storage = {
  /**
   * 存储key常量
   * @readonly
   * @enum {string}
   */
  KEYS: Object.freeze({
    SAVED_FILTERS: 'savedFilters',
    DATA_VERSION: 'dataVersion'
  }),

  /**
   * 内存兜底存储（隐私模式下localStorage不可用时使用）
   * @private
   */
  _memoryStorage: {},

  /**
   * 检测localStorage是否可用
   * @returns {boolean} 是否可用
   */
  isLocalStorageAvailable: () => {
    try {
      const testKey = '__test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch(e) {
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
  }
};

// ====================== 5. Toast提示模块 ======================
/**
 * Toast提示管理器
 * @namespace Toast
 */
const Toast = {
  /** @private */
  _dom: document.getElementById('toast'),
  /** @private */
  _timer: null,

  /**
   * 显示提示
   * @param {string} text - 提示文本
   * @param {number} duration - 显示时长(ms)
   */
  show: (text, duration = CONFIG.TOAST_DURATION) => {
    clearTimeout(Toast._timer);
    Toast._dom.innerText = text;
    Toast._dom.classList.add('show');
    Toast._timer = setTimeout(() => {
      Toast._dom.classList.remove('show');
    }, duration);
  },

  /**
   * 清除定时器
   */
  clearTimer: () => {
    clearTimeout(Toast._timer);
  }
};

// ====================== 6. DOM缓存模块（所有常用DOM提前缓存，避免重复查询）======================
/**
 * DOM元素缓存
 * @namespace DOM
 */
const DOM = {
  // 加载遮罩
  loadingMask: document.getElementById('loadingMask'),
  // 结果展示
  resultCount: document.getElementById('resultCount'),
  resultNums: document.getElementById('resultNums'),
  // 排除号码
  excludeCount: document.getElementById('excludeCount'),
  excludeGrid: document.getElementById('excludeGrid'),
  lockExclude: document.getElementById('lockExclude'),
  // 方案列表
  filterList: document.getElementById('filterList'),
  // 生肖标签
  zodiacTags: document.getElementById('zodiacTags'),
  // 快捷导航
  quickNav: document.getElementById('quickNav'),
  navToggle: document.getElementById('navToggle'),
  navTabs: document.getElementById('navTabs'),
  // 返回顶部
  backTopBtn: document.getElementById('backTopBtn')
};

// ====================== 7. 渲染模块（所有视图渲染逻辑，增量更新优化）======================
/**
 * 视图渲染管理器
 * @namespace Render
 */
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
      
      groups.forEach(g => {
        const selectedList = state.selected[g];
        document.querySelectorAll(`.tag[data-group="${g}"]`).forEach(tag => {
          const tagValue = Utils.formatTagValue(tag.dataset.value, g);
          const isActive = selectedList.includes(tagValue);
          tag.classList.toggle('active', isActive);
          tag.setAttribute('aria-checked', isActive);
        });
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
        const previewList = Filter.getFilteredList(item.selected, item.excluded).slice(0, CONFIG.PREVIEW_MAX_COUNT);
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

// ====================== 8. 筛选逻辑模块 ======================
/**
 * 筛选逻辑管理器
 * @namespace Filter
 */
const Filter = {
  /**
   * 通用筛选函数
   * @param {Object|null} selected - 选中的筛选条件
   * @param {Array|null} excluded - 排除的号码
   * @returns {Array} 筛选后的号码列表
   */
  getFilteredList: (selected = null, excluded = null) => {
    try {
      const state = StateManager._state;
      const targetSelected = selected || state.selected;
      const targetExcluded = excluded || state.excluded;
      const numList = state.numList;

      return numList.filter(item => {
        // 排除号码
        if(targetExcluded.includes(item.num)) return false;
        // 遍历所有筛选条件
        for(const group in targetSelected){
          if(targetSelected[group].length && !targetSelected[group].includes(item[group])) return false;
        }
        return true;
      });
    } catch(e) {
      console.error('筛选失败', e);
      return [];
    }
  },

  /**
   * 全选所有筛选条件（防抖优化）
   */
  selectAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    Object.keys(state.selected).forEach(group => StateManager.selectGroup(group));
    Toast.show('已全选所有筛选条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY),

  /**
   * 清除所有筛选条件（防抖优化）
   */
  clearAllFilters: Utils.debounce(() => {
    const state = StateManager._state;
    // 重置所有筛选条件
    Object.keys(state.selected).forEach(group => StateManager.resetGroup(group));
    // 重置排除号码
    StateManager.setState({
      excluded: [],
      excludeHistory: [],
      lockExclude: false
    });
    // 更新复选框
    DOM.lockExclude.checked = false;
    Toast.show('已清除所有筛选与排除条件');
  }, CONFIG.CLICK_DEBOUNCE_DELAY)
};

// ====================== 9. 业务逻辑模块 ======================
/**
 * 业务逻辑管理器
 * @namespace Business
 */
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

    const input = prompt("输入要排除的号码，空格/逗号分隔");
    if(!input) return;

    const nums = input.split(/[\s,，]+/).map(Number).filter(num => num >=1 && num <=49);
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
    const name = prompt("请输入方案名称", defaultName);
    if(name === null) return;

    const filterName = name.trim() || defaultName;
    const filterItem = {
      name: filterName,
      selected: Utils.deepClone(state.selected),
      excluded: Utils.deepClone(state.excluded)
    };

    const success = Storage.saveFilter(filterItem);
    if(success){
      Render.renderFilterList();
      Toast.show('保存成功');
    }
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
      excluded: Utils.deepClone(item.excluded)
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
        prompt('请手动复制以下号码：', numStr);
      });
    } else {
      prompt('请手动复制以下号码：', numStr);
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

    const newName = prompt("修改方案名称", item.name);
    if(newName === null || newName.trim() === "") return;

    const newList = [...state.savedFilters];
    newList[index].name = newName.trim();
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
      Render.renderFilterList();
      Toast.show('重命名成功');
    }
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
    if(!confirm("确定删除该方案？")) return;
    const state = StateManager._state;
    const newList = [...state.savedFilters];
    newList.splice(index, 1);
    const success = Storage.set(Storage.KEYS.SAVED_FILTERS, newList);
    
    if(success){
      StateManager.setState({ savedFilters: newList }, false);
      Render.renderFilterList();
      Toast.show('删除成功');
    }
  },

  /**
   * 清空所有方案
   */
  clearAllSavedFilters: () => {
    if(!confirm("确定清空所有方案？")) return;
    Storage.remove(Storage.KEYS.SAVED_FILTERS);
    StateManager.setState({ savedFilters: [] }, false);
    Render.renderFilterList();
    Toast.show('已清空所有方案');
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
    document.querySelectorAll('.bottom-nav-item').forEach((el,i)=>{
      el.classList.toggle('active', i===index);
    });
    
    // 切换页面显示
    const pages = ['filterPage', 'randomPage', 'analysisPage', 'profilePage'];
    pages.forEach((pageId, i) => {
      const pageEl = document.getElementById(pageId);
      if(pageEl) {
        pageEl.style.display = i === index ? 'block' : 'none';
        pageEl.classList.toggle('active', i === index);
      }
    });
    
    // 控制顶部展示区的显示/隐藏：仅在筛选页面(index=0)显示
    const topBox = document.getElementById('topBox');
    if(topBox) {
      topBox.style.display = index === 0 ? 'block' : 'none';
    }
    
    // 控制主体内容区的顶部间距：筛选页面有顶部展示区，其他页面没有
    const bodyBox = document.querySelector('.body-box');
    if(bodyBox) {
      if(index === 0) {
        bodyBox.style.marginTop = 'calc(var(--top-offset) + var(--safe-top))';
      } else {
        bodyBox.style.marginTop = 'calc(12px + var(--safe-top))';
      }
    }
    
    // 控制快捷导航的显示/隐藏：仅在筛选页面(index=0)显示
    const quickNav = document.getElementById('quickNav');
    if(quickNav) {
      quickNav.style.display = index === 0 ? 'block' : 'none';
    }
    
    // 页面特定处理
    if(index === 2) {
      // 分析页面
      Business.initAnalysisPage();
    }
  },

  // ====================== 分析页面相关 ======================
  /**
   * 初始化分析页面
   */
  initAnalysisPage: () => {
    const state = StateManager._state;
    if(state.analysis.historyData.length === 0) {
      Business.refreshHistory();
    }
    Business.startCountdown();
    Business.startAutoRefresh();
  },

  /**
   * 刷新历史数据
   */
  refreshHistory: async () => {
    const historyList = document.getElementById('historyList');
    if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';
    
    try {
      const year = new Date().getFullYear();
      const res = await fetch(CONFIG.API.HISTORY + year);
      const data = await res.json();
      let rawData = data.data || [];

      // 过滤无效数据
      rawData = rawData.filter(item => {
        const expect = item.expect || '';
        const openCode = item.openCode || '';
        return expect && openCode && openCode.split(',').length === 7;
      });

      // 去重并排序
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

      // 更新状态
      const newAnalysis = { ...StateManager._state.analysis, historyData: sortedData };
      StateManager.setState({ analysis: newAnalysis }, false);

      // 渲染
      Business.renderLatest(sortedData[0]);
      Business.renderHistory();
      Business.renderFullAnalysis();
      Business.renderZodiacAnalysis();
      
      Toast.show('数据加载成功');
    } catch(e) {
      console.error('加载历史数据失败', e);
      if(historyList) {
        historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">数据加载失败，请刷新重试</div>';
      }
      Toast.show('数据加载失败');
    }
    
    const loadMore = document.getElementById('loadMore');
    if(loadMore) {
      loadMore.style.display = StateManager._state.analysis.historyData.length > StateManager._state.analysis.showCount ? 'block' : 'none';
    }
  },

  /**
   * 获取颜色
   * @param {number} n - 号码
   * @returns {string} 颜色
   */
  getColor: (n) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(n));
    const colorMap = { '红': 'red', '蓝': 'blue', '绿': 'green' };
    return colorMap[color] || 'red';
  },
  
  /**
   * 获取颜色中文名称
   * @param {number} n - 号码
   * @returns {string} 颜色中文名称
   */
  getColorName: (n) => {
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(n));
    return color || '红';
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
    
    const latestBalls = document.getElementById('latestBalls');
    const curExpect = document.getElementById('curExpect');
    if(latestBalls) latestBalls.innerHTML = html;
    if(curExpect) curExpect.innerText = item.expect || '--';
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
    const historyList = document.getElementById('historyList');
    
    if(!list.length) {
      if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">暂无历史数据</div>';
      return;
    }
    
    if(historyList) {
      historyList.innerHTML = list.map(item => {
        const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
        const waveArr = (item.wave || 'red,red,red,red,red,red,red').split(',');
        const s = Business.getSpecial(item);
        const zodArr = s.fullZodArr;
        let balls = '';
        for(let i = 0; i < 6; i++) balls += Business.buildBall(codeArr[i], waveArr[i], zodArr[i]);
        balls += '<div class="ball-sep">+</div>' + Business.buildBall(codeArr[6], waveArr[6], zodArr[6]);
        return `
        <div class="history-item">
          <div class="history-expect">第${item.expect || ''}期</div>
          <div class="ball-group">${balls}</div>
        </div>`;
      }).join('');
    }
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

    // 初始化统计对象
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
    const lastAppear = {};
    for(let i = 1; i <= 49; i++) lastAppear[i] = -1;

    // 统计
    list.forEach((item, idx) => {
      const s = Business.getSpecial(item);
      s.odd ? singleDouble['单']++ : singleDouble['双']++;
      s.big ? bigSmall['大']++ : bigSmall['小']++;
      s.te <= 9 ? range['1-9']++ : s.te <= 19 ? range['10-19']++ : s.te <= 29 ? range['20-29']++ : s.te <= 39 ? range['30-39']++ : range['40-49']++;
      head[s.head]++;
      tail[s.tail]++;
      color[s.colorName]++;
      wuxing[s.wuxing]++;
      animal[s.animal]++;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) zodiac[s.zod]++;
      numCount[String(s.te).padStart(2, '0')]++;
      if(lastAppear[s.te] === -1) lastAppear[s.te] = idx;
    });

    // 遗漏计算
    let totalMissSum = 0, maxMiss = 0, hot = 0, warm = 0, cold = 0;
    const allMiss = [];
    for(let m = 1; m <= 49; m++) {
      const p = lastAppear[m];
      const currentMiss = p === -1 ? total : p;
      allMiss.push(currentMiss);
      totalMissSum += currentMiss;
      if(currentMiss > maxMiss) maxMiss = currentMiss;
      if(currentMiss <= 3) hot++;
      else if(currentMiss <= 9) warm++;
      else cold++;
    }
    const avgMiss = (totalMissSum / 49).toFixed(1);
    const curMaxMiss = Math.max(...allMiss);

    // 连出计算
    let curStreak = 1, maxStreak = 1, current = 1;
    if(list.length >= 2) {
      const firstShape = `${Business.getSpecial(list[0]).odd}_${Business.getSpecial(list[0]).big}`;
      for(let i = 1; i < list.length; i++) {
        const s = Business.getSpecial(list[i]);
        const shape = `${s.odd}_${s.big}`;
        if(shape === firstShape) curStreak++;
        else break;
      }
      let prevShape = `${Business.getSpecial(list[0]).odd}_${Business.getSpecial(list[0]).big}`;
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

    // 热门排序
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
      streak: { curStreak, maxStreak }
    };
  },

  /**
   * 渲染全维度分析
   */
  renderFullAnalysis: () => {
    const data = Business.calcFullAnalysis();
    if(!data) {
      const hotWrap = document.getElementById('hotWrap');
      const emptyTip = document.getElementById('emptyTip');
      if(hotWrap) hotWrap.style.display = 'none';
      if(emptyTip) emptyTip.style.display = 'block';
      return;
    }
    
    const hotWrap = document.getElementById('hotWrap');
    const emptyTip = document.getElementById('emptyTip');
    if(hotWrap) hotWrap.style.display = 'block';
    if(emptyTip) emptyTip.style.display = 'none';

    // 更新DOM元素
    const elements = {
      'hotShape': `${data.hotSD[0]} / ${data.hotBS[0]}`,
      'hotZodiac': data.hotZod,
      'hotHeadTail': `${data.hotHead[0]}头 / ${data.hotTail[0]}尾`,
      'hotColorWx': `${data.hotColor[0]} / ${data.hotWx[0]}`,
      'hotMiss': `热:${data.miss.hot} 温:${data.miss.warm} 冷:${data.miss.cold} | 最大遗漏:${data.miss.maxMiss}期`,
      'odd': data.singleDouble['单'],
      'even': data.singleDouble['双'],
      'big': data.bigSmall['大'],
      'small': data.bigSmall['小'],
      'r1': data.range['1-9'],
      'r2': data.range['10-19'],
      'r3': data.range['20-29'],
      'r4': data.range['30-39'],
      'r5': data.range['40-49'],
      'h0': data.head[0],
      'h1': data.head[1],
      'h2': data.head[2],
      'h3': data.head[3],
      'h4': data.head[4],
      'cRed': data.color['红'],
      'cBlue': data.color['蓝'],
      'cGreen': data.color['绿'],
      'wJin': data.wuxing['金'],
      'wMu': data.wuxing['木'],
      'wShui': data.wuxing['水'],
      'wHuo': data.wuxing['火'],
      'wTu': data.wuxing['土'],
      'aniHome': data.animal['家禽'],
      'aniWild': data.animal['野兽'],
      'hotShape2': Business.getTopHot(Object.entries(data.singleDouble).concat(Object.entries(data.bigSmall))),
      'hotRange2': Business.getTopHot(Object.entries(data.range)),
      'hotHead2': Business.getTopHot(Object.entries(data.head)),
      'hotTail2': Business.getTopHot(Object.entries(data.tail)),
      'hotColor2': Business.getTopHot(Object.entries(data.color)),
      'hotWuxing2': Business.getTopHot(Object.entries(data.wuxing)),
      'hotAnimal': Business.getTopHot(Object.entries(data.animal)),
      'hotZodiac2': Object.entries(data.zodiac).sort((a, b) => b[1] - a[1]).slice(0, 5).map(i => `${i[0]}(${i[1]})`).join(' '),
      'hotNumber': data.hotNum,
      'missCur': data.miss.curMaxMiss,
      'missAvg': data.miss.avgMiss,
      'missMax': data.miss.maxMiss,
      'missHot': data.miss.hot,
      'missWarm': data.miss.warm,
      'missCold': data.miss.cold,
      'hotColdTip': `热:${data.miss.hot} 温:${data.miss.warm} 冷:${data.miss.cold}`,
      'streakCur': data.streak.curStreak,
      'streakMax': data.streak.maxStreak,
      'streakTip': `当前:${data.streak.curStreak}期 最长:${data.streak.maxStreak}期`
    };

    Object.entries(elements).forEach(([id, value]) => {
      const el = document.getElementById(id);
      if(el) el.innerText = value;
    });

    // 尾数行渲染
    const tailRow = document.getElementById('tailRow');
    if(tailRow) {
      let tailHtml = '';
      for(let t = 0; t <= 9; t++) {
        tailHtml += `<div class="analysis-item"><div class="label">尾${t}</div><div class="value">${data.tail[t]}</div></div>`;
      }
      tailRow.innerHTML = tailHtml;
    }

    // 完整排行渲染
    Business.renderFullRank('singleDoubleRank', data.singleDouble, data.total);
    Business.renderFullRank('bigSmallRank', data.bigSmall, data.total);
    Business.renderFullRank('rangeRank', data.range, data.total);
    Business.renderFullRank('headRank', data.head, data.total);
    Business.renderFullRank('tailRank', data.tail, data.total);
    Business.renderFullRank('colorRank', data.color, data.total);
    Business.renderFullRank('wuxingRank', data.wuxing, data.total);
    Business.renderFullRank('animalRank', data.animal, data.total);
    Business.renderFullRank('zodiacRank', data.zodiac, data.total);
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
   * 渲染完整排行
   * @param {string} containerId - 容器ID
   * @param {Object} dataObj - 数据对象
   * @param {number} total - 总数
   */
  renderFullRank: (containerId, dataObj, total) => {
    const container = document.getElementById(containerId);
    if(!container) return;
    if(total === 0) { container.innerHTML = ''; return; }
    
    const sorted = Object.entries(dataObj).sort((a, b) => b[1] - a[1]);
    let html = `
    <div class="rank-header">
      <div class="rank-no">名次</div>
      <div class="rank-name">分类</div>
      <div class="rank-count">次数</div>
      <div class="rank-rate">占比</div>
      <div class="rank-miss">遗漏</div>
    </div>`;
    
    sorted.forEach(([name, count], idx) => {
      const rate = ((count / total) * 100).toFixed(0) + '%';
      const miss = count > 0 ? Math.floor((total - count) / count) : total;
      html += `
      <div class="rank-row">
        <div class="rank-no">${idx + 1}</div>
        <div class="rank-name">${name}</div>
        <div class="rank-count">${count}</div>
        <div class="rank-rate">${rate}</div>
        <div class="rank-miss">${miss}</div>
      </div>`;
    });
    
    container.innerHTML = html;
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

    // 初始化统计对象
    const zodCount = {};
    const lastAppear = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => { zodCount[z] = 0; lastAppear[z] = -1; });
    const tailZodMap = {};
    for(let t = 0; t <= 9; t++) tailZodMap[t] = {};
    const followMap = {};

    // 循环统计
    list.forEach((item, idx) => {
      const s = Business.getSpecial(item);
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        zodCount[s.zod]++;
        if(lastAppear[s.zod] === -1) lastAppear[s.zod] = idx;
      }
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(s.zod)) {
        tailZodMap[s.tail][s.zod] = (tailZodMap[s.tail][s.zod] || 0) + 1;
      }
    });

    // 跟随统计
    for(let i = 1; i < list.length; i++) {
      const preZod = Business.getSpecial(list[i-1]).zod;
      const curZod = Business.getSpecial(list[i]).zod;
      if(CONFIG.ANALYSIS.ZODIAC_ALL.includes(preZod) && CONFIG.ANALYSIS.ZODIAC_ALL.includes(curZod)) {
        if(!followMap[preZod]) followMap[preZod] = {};
        followMap[preZod][curZod] = (followMap[preZod][curZod] || 0) + 1;
      }
    }

    // 遗漏期数计算
    const zodMiss = {};
    const zodAvgMiss = {};
    CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
      zodMiss[z] = lastAppear[z] === -1 ? total : lastAppear[z];
      zodAvgMiss[z] = zodCount[z] > 0 ? (total / zodCount[z]).toFixed(1) : total;
    });

    // 热门排序
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
    const zodiacEmptyTip = document.getElementById('zodiacEmptyTip');
    const zodiacContent = document.getElementById('zodiacContent');
    
    if(!data) {
      if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'block';
      if(zodiacContent) zodiacContent.style.display = 'none';
      return;
    }
    
    if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'none';
    if(zodiacContent) zodiacContent.style.display = 'block';

    // 共振组合
    const combo1 = document.getElementById('combo1');
    const combo2 = document.getElementById('combo2');
    const combo3 = document.getElementById('combo3');
    if(combo1) combo1.innerText = `1. 首选：尾${data.topTail[0]?.t ?? '-'} + ${data.topZod[0]?.[0] ?? '-'}（出现${data.topZod[0]?.[1] ?? 0}次）`;
    if(combo2) combo2.innerText = `2. 次选：尾${data.topTail[1]?.t ?? '-'} + ${data.topZod[1]?.[0] ?? '-'}（出现${data.topZod[1]?.[1] ?? 0}次）`;
    if(combo3) combo3.innerText = `3. 备选：尾${data.topTail[2]?.t ?? '-'} + ${data.topZod[2]?.[0] ?? '-'}（出现${data.topZod[2]?.[1] ?? 0}次）`;

    // 尾数→生肖网格
    const tailZodiacGrid = document.getElementById('tailZodiacGrid');
    if(tailZodiacGrid) {
      let tailHtml = '';
      for(let t = 0; t <= 9; t++) {
        const arr = Object.entries(data.tailZodMap[t]).sort((a, b) => b[1] - a[1]);
        const topZ = arr.length ? arr[0][0] : '-';
        const cnt = arr.length ? arr[0][1] : 0;
        const level = Business.getZodiacLevel(cnt, data.zodMiss[topZ] || 0, data.total);
        tailHtml += `<div class="data-item-z ${level.cls}">尾${t}<br>${topZ}<br>${cnt}次</div>`;
      }
      tailZodiacGrid.innerHTML = tailHtml;
    }

    // 跟随表格
    const zodiacFollowTable = document.getElementById('zodiacFollowTable');
    if(zodiacFollowTable) {
      let followHtml = `<tr><th>上期生肖</th><th>首选(次数)</th><th>次选(次数)</th><th>排除生肖</th></tr>`;
      const followKeys = Object.keys(data.followMap).slice(0, 4);
      followKeys.forEach(k => {
        const arr = Object.entries(data.followMap[k]).sort((a, b) => b[1] - a[1]);
        const first = arr[0] ? `${arr[0][0]}(${arr[0][1]})` : '-';
        const second = arr[1] ? `${arr[1][0]}(${arr[1][1]})` : '-';
        const exclude = CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => !arr.some(x => x[0] === z)).slice(0, 2).join('、');
        followHtml += `<tr><td>${k}</td><td>${first}</td><td>${second}</td><td>${exclude || '-'}</td></tr>`;
      });
      zodiacFollowTable.innerHTML = followHtml;
    }

    // 12生肖统计
    const zodiacTotalGrid = document.getElementById('zodiacTotalGrid');
    if(zodiacTotalGrid) {
      let zodHtml = '';
      CONFIG.ANALYSIS.ZODIAC_ALL.forEach(z => {
        const cnt = data.zodCount[z];
        const miss = data.zodMiss[z];
        const rate = ((cnt / data.total) * 100).toFixed(0) + '%';
        const level = Business.getZodiacLevel(cnt, miss, data.total);
        zodHtml += `<div class="data-item-z ${level.cls}">${z}<br>${cnt}次/${rate}<br>遗${miss}</div>`;
      });
      zodiacTotalGrid.innerHTML = zodHtml;
    }

    // 高遗漏生肖
    const zodiacMissGrid = document.getElementById('zodiacMissGrid');
    if(zodiacMissGrid) {
      const missSort = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 3);
      let missHtml = '';
      missSort.forEach(([z, m]) => {
        const avgMiss = data.zodAvgMiss[z];
        const tag = m > avgMiss ? '超平均' : '';
        missHtml += `<div class="data-item-z cold">${z}<br>遗${m}期<br>${tag}</div>`;
      });
      zodiacMissGrid.innerHTML = missHtml;
    }

    // 精选特码
    Business.renderZodiacFinalNums(data);
  },

  /**
   * 渲染生肖精选号码
   * @param {Object} data - 分析数据
   */
  renderZodiacFinalNums: (data) => {
    const state = StateManager._state;
    
    // 建立号码-生肖映射
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

    // 锁定核心生肖池
    const coreZodiacs = data.topZod.slice(0, 2).map(i => i[0]);
    const missZodiac = Object.entries(data.zodMiss).sort((a, b) => b[1] - a[1]).slice(0, 1).map(i => i[0]);
    if(missZodiac.length && !coreZodiacs.includes(missZodiac[0])) coreZodiacs.push(missZodiac[0]);

    // 锁定热门尾数TOP3
    const hotTails = data.topTail.slice(0, 3).map(i => i.t);

    // 筛选候选号码
    const candidateNums = [];
    for(let num = 1; num <= 49; num++) {
      const zod = numZodiacMap.get(num);
      const tail = num % 10;
      if(coreZodiacs.includes(zod) && hotTails.includes(tail)) {
        const miss = data.zodMiss[zod] || 0;
        const count = data.zodCount[zod] || 0;
        candidateNums.push({
          num,
          weight: count * 10 + (10 - miss)
        });
      }
    }

    // 按权重排序，取目标数量
    const targetCount = state.analysis.selectedNumCount;
    candidateNums.sort((a, b) => b.weight - a.weight);
    let finalNums = candidateNums.slice(0, targetCount).map(i => i.num);

    // 兜底机制
    if(finalNums.length < targetCount) {
      const fillNums = [...new Set(data.list.map(item => Business.getSpecial(item).te))]
        .filter(num => !finalNums.includes(num))
        .slice(0, targetCount - finalNums.length);
      finalNums.push(...fillNums);
    }

    // 排序并格式化
    finalNums.sort((a, b) => a - b);
    const finalFormatNums = finalNums.map(num => String(num).padStart(2, '0'));

    const zodiacFinalNum = document.getElementById('zodiacFinalNum');
    if(zodiacFinalNum) zodiacFinalNum.innerText = `✅ 精选特码：${finalFormatNums.join(' ') || '无'}`;
  },

  /**
   * 同步全维度分析
   */
  syncAnalyze: () => {
    const customNum = document.getElementById('customNum');
    const analyzeSelect = document.getElementById('analyzeSelect');
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    const zodiacCustomNum = document.getElementById('zodiacCustomNum');
    
    const custom = customNum ? customNum.value.trim() : '';
    const selectVal = analyzeSelect ? analyzeSelect.value : '30';
    const historyData = StateManager._state.analysis.historyData;
    
    const newLimit = custom && !isNaN(custom) && custom > 0
      ? Number(custom)
      : selectVal === 'all' ? historyData.length : Number(selectVal);
    
    // 更新状态
    const newAnalysis = { 
      ...StateManager._state.analysis, 
      analyzeLimit: newLimit 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    // 同步另一个选择器
    if(zodiacAnalyzeSelect) zodiacAnalyzeSelect.value = selectVal;
    if(zodiacCustomNum) zodiacCustomNum.value = custom;
    
    // 重新渲染
    Business.renderFullAnalysis();
    Business.renderZodiacAnalysis();
  },

  /**
   * 同步生肖关联分析
   */
  syncZodiacAnalyze: () => {
    const zodiacCustomNum = document.getElementById('zodiacCustomNum');
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    const analyzeSelect = document.getElementById('analyzeSelect');
    const customNum = document.getElementById('customNum');
    
    // 期数同步
    const customPeriod = zodiacCustomNum ? zodiacCustomNum.value.trim() : '';
    const selectPeriodVal = zodiacAnalyzeSelect ? zodiacAnalyzeSelect.value : '30';
    const historyData = StateManager._state.analysis.historyData;
    
    const newLimit = customPeriod && !isNaN(customPeriod) && customPeriod > 0
      ? Number(customPeriod)
      : selectPeriodVal === 'all' ? historyData.length : Number(selectPeriodVal);
    
    // 号码数量同步
    const countVal = numCountSelect ? numCountSelect.value : '5';
    const customCount = customNumCount ? customNumCount.value.trim() : '';
    let finalCount = 5;
    
    if(countVal === 'custom') {
      finalCount = customCount && !isNaN(customCount) && Number(customCount) >= 1 && Number(customCount) <= 49
        ? Number(customCount)
        : 5;
    } else {
      finalCount = Number(countVal);
    }
    
    // 更新状态
    const newAnalysis = { 
      ...StateManager._state.analysis, 
      analyzeLimit: newLimit,
      selectedNumCount: finalCount
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    // 同步另一个选择器
    if(analyzeSelect) analyzeSelect.value = selectPeriodVal;
    if(customNum) customNum.value = customPeriod;
    
    // 重新渲染
    Business.renderFullAnalysis();
    Business.renderZodiacAnalysis();
  },

  /**
   * 切换详情显示
   * @param {string} targetId - 目标元素ID
   */
  toggleDetail: (targetId) => {
    const el = document.getElementById(targetId);
    if(!el) return;
    
    const isVisible = el.style.display === 'block';
    el.style.display = isVisible ? 'none' : 'block';
    
    // 更新按钮文字
    const btn = el.previousElementSibling ? el.previousElementSibling.querySelector('.toggle-btn') : null;
    if(btn) btn.textContent = isVisible ? '展开详情' : '收起详情';
  },

  /**
   * 切换分析标签页
   * @param {string} tab - 标签名
   */
  switchAnalysisTab: (tab) => {
    // 更新按钮状态
    document.querySelectorAll('.analysis-tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.analysisTab === tab);
    });
    
    // 更新面板显示
    const panels = {
      'history': 'historyPanel',
      'analysis': 'analysisPanelContent',
      'zodiac': 'zodiacAnalysisPanel'
    };
    
    Object.entries(panels).forEach(([key, id]) => {
      const panel = document.getElementById(id);
      if(panel) panel.classList.toggle('active', key === tab);
    });
    
    // 更新状态
    const newAnalysis = { 
      ...StateManager._state.analysis, 
      currentTab: tab 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    // 特定标签页渲染
    if(tab === 'analysis') Business.renderFullAnalysis();
    if(tab === 'zodiac') Business.renderZodiacAnalysis();
  },

  /**
   * 加载更多历史
   */
  loadMoreHistory: () => {
    const state = StateManager._state;
    const newShowCount = state.analysis.showCount + 30;
    
    const newAnalysis = { 
      ...state.analysis, 
      showCount: newShowCount 
    };
    StateManager.setState({ analysis: newAnalysis }, false);
    
    Business.renderHistory();
    
    const loadMore = document.getElementById('loadMore');
    if(loadMore && newShowCount >= state.analysis.historyData.length) {
      loadMore.style.display = 'none';
    }
  },

  /**
   * 开始倒计时
   */
  startCountdown: () => {
    setInterval(() => {
      const now = new Date();
      const target = new Date();
      target.setHours(21, 32, 32, 0);
      if(now > target) target.setDate(target.getDate() + 1);
      const diff = target - now;
      const h = String(Math.floor(diff / 3600000)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, '0');
      const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, '0');
      
      const countdown = document.getElementById('countdown');
      if(countdown) countdown.innerText = `${h}:${m}:${s}`;
    }, 1000);
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
    setInterval(() => {
      if(Business.isInDrawTime() && !StateManager._state.analysis.autoRefreshTimer) {
        Business.startAutoRefresh();
      }
    }, 60000);
  },

  /**
   * 滚动到指定模块
   * @param {string} targetId - 模块ID
   */
  scrollToModule: (targetId) => {
    const targetEl = document.getElementById(targetId);
    if(targetEl){
      const offset = CONFIG.TOP_OFFSET + Utils.getSafeTop();
      window.scrollTo({top: targetEl.offsetTop - offset, behavior: 'smooth'});
    }
    Business.toggleQuickNav(false);
  },

  /**
   * 切换快捷导航展开/收起
   * @param {boolean|null} isOpen - 强制指定展开/收起
   */
  toggleQuickNav: (isOpen = null) => {
    const isCollapsed = DOM.quickNav.classList.contains('collapsed');
    const shouldOpen = isOpen === null ? isCollapsed : isOpen;

    if(shouldOpen){
      DOM.quickNav.classList.remove('collapsed');
      DOM.quickNav.classList.add('expanded');
      DOM.navToggle.style.display = 'none';
      DOM.navTabs.style.display = 'flex';
    } else {
      DOM.quickNav.classList.remove('expanded');
      DOM.quickNav.classList.add('collapsed');
      DOM.navTabs.style.display = 'none';
      DOM.navToggle.style.display = 'grid';
    }
  },

  /**
   * 返回顶部
   */
  backToTop: () => {
    window.scrollTo({top: 0, behavior: 'smooth'});
  },

  /**
   * 滚动事件处理（已节流优化）
   */
  handleScroll: Utils.throttle(() => {
    const state = StateManager._state;
    const scrollTop = document.documentElement.scrollTop || document.body.scrollTop;
    clearTimeout(state.scrollTimer);

    // 显示/隐藏返回顶部按钮
    if(scrollTop > CONFIG.BACK_TOP_THRESHOLD){
      DOM.backTopBtn.classList.add('show');
      // 滚动停止后延迟隐藏
      state.scrollTimer = setTimeout(() => {
        DOM.backTopBtn.classList.remove('show');
      }, CONFIG.SCROLL_HIDE_DELAY);
    } else {
      DOM.backTopBtn.classList.remove('show');
    }
  }, CONFIG.SCROLL_THROTTLE_DELAY),

  /**
   * 页面卸载清理，避免内存泄漏
   */
  handlePageUnload: () => {
    StateManager.clearAllTimers();
    window.removeEventListener('scroll', Business.handleScroll);
    window.removeEventListener('beforeunload', Business.handlePageUnload);
  }
};

// ====================== 10. 事件绑定模块（统一事件委托，支持键盘操作）======================
/**
 * 全局事件绑定器
 * @namespace EventBinder
 */
const EventBinder = {
  /**
   * 初始化所有事件绑定
   */
  init: () => {
    // 全局点击事件委托
    document.addEventListener('click', EventBinder.handleGlobalClick);
    // 键盘回车/空格事件（无障碍支持）
    document.addEventListener('keydown', EventBinder.handleKeyDown);
    // 滚动事件（已节流）
    window.addEventListener('scroll', Business.handleScroll);
    // 点击空白关闭快捷导航
    document.addEventListener('click', EventBinder.handleClickOutside);
    // 页面卸载清理
    window.addEventListener('beforeunload', Business.handlePageUnload);
    // 全局错误捕获
    window.addEventListener('error', EventBinder.handleGlobalError);
    
    // 分析页面：全维度分析选择器change事件
    const analyzeSelect = document.getElementById('analyzeSelect');
    if(analyzeSelect) {
      analyzeSelect.addEventListener('change', function() {
        Business.syncAnalyze();
      });
    }
    
    // 分析页面：特码生肖关联选择器change事件
    const zodiacAnalyzeSelect = document.getElementById('zodiacAnalyzeSelect');
    if(zodiacAnalyzeSelect) {
      zodiacAnalyzeSelect.addEventListener('change', function() {
        Business.syncZodiacAnalyze();
      });
    }
    
    // 分析页面：号码数量选择器change事件
    const numCountSelect = document.getElementById('numCountSelect');
    const customNumCount = document.getElementById('customNumCount');
    
    if(numCountSelect) {
      numCountSelect.addEventListener('change', function() {
        const isCustom = this.value === 'custom';
        if(customNumCount) customNumCount.style.display = isCustom ? 'inline-block' : 'none';
        if(!isCustom) {
          const newAnalysis = { 
            ...StateManager._state.analysis, 
            selectedNumCount: Number(this.value)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          Business.renderZodiacAnalysis();
        }
      });
    }
    
    if(customNumCount) {
      customNumCount.addEventListener('input', function() {
        const val = this.value.trim();
        if(val && !isNaN(val) && Number(val) >= 1 && Number(val) <= 49) {
          const newAnalysis = { 
            ...StateManager._state.analysis, 
            selectedNumCount: Number(val)
          };
          StateManager.setState({ analysis: newAnalysis }, false);
          Business.renderZodiacAnalysis();
        }
      });
    }
  },

  /**
   * 全局点击处理
   * @param {MouseEvent} e - 点击事件
   */
  handleGlobalClick: (e) => {
    const target = e.target;

    // 1. 筛选标签点击
    const tag = target.closest('.tag[data-group]');
    if(tag){
      const group = tag.dataset.group;
      const value = Utils.formatTagValue(tag.dataset.value, group);
      StateManager.updateSelected(group, value);
      return;
    }

    // 2. 排除号码点击
    const excludeTag = target.closest('.exclude-tag[data-num]');
    if(excludeTag){
      Business.toggleExclude(Number(excludeTag.dataset.num));
      return;
    }

    // 3. 快捷导航跳转
    const navTab = target.closest('.nav-tab[data-target]');
    if(navTab){
      const targetId = navTab.dataset.target;
      Business.scrollToModule(targetId);
      return;
    }

    // 4. 快捷导航开关
    if(target === DOM.navToggle){
      Business.toggleQuickNav();
      return;
    }

    // 5. 返回顶部
    if(target === DOM.backTopBtn){
      Business.backToTop();
      return;
    }

    // 6. 按钮动作处理（用枚举避免硬编码错误）
    const actionBtn = target.closest('[data-action]');
    if(actionBtn){
      const action = actionBtn.dataset.action;
      const group = actionBtn.dataset.group;
      const index = actionBtn.dataset.index;
      
      // 分组操作
      if(action === CONFIG.ACTIONS.RESET_GROUP) StateManager.resetGroup(group);
      if(action === CONFIG.ACTIONS.SELECT_GROUP) StateManager.selectGroup(group);
      if(action === CONFIG.ACTIONS.INVERT_GROUP) StateManager.invertGroup(group);
      if(action === CONFIG.ACTIONS.CLEAR_GROUP) StateManager.resetGroup(group);
      // 全局操作
      if(action === CONFIG.ACTIONS.SELECT_ALL) Filter.selectAllFilters();
      if(action === CONFIG.ACTIONS.CLEAR_ALL) Filter.clearAllFilters();
      if(action === CONFIG.ACTIONS.SAVE_FILTER) Business.saveFilterPrompt();
      if(action === CONFIG.ACTIONS.CLEAR_ALL_SAVED) Business.clearAllSavedFilters();
      // 排除号码操作
      if(action === CONFIG.ACTIONS.INVERT_EXCLUDE) Business.invertExclude();
      if(action === CONFIG.ACTIONS.UNDO_EXCLUDE) Business.undoExclude();
      if(action === CONFIG.ACTIONS.BATCH_EXCLUDE) Business.batchExcludePrompt();
      if(action === CONFIG.ACTIONS.CLEAR_EXCLUDE) Business.clearExclude();
      // 方案操作
      if(action === CONFIG.ACTIONS.TOGGLE_SHOW_ALL) Business.toggleShowAllFilters();
      if(action === CONFIG.ACTIONS.LOAD_FILTER) Business.loadFilter(Number(index));
      if(action === CONFIG.ACTIONS.RENAME_FILTER) Business.renameFilter(Number(index));
      if(action === CONFIG.ACTIONS.COPY_FILTER) Business.copyFilterNums(Number(index));
      if(action === CONFIG.ACTIONS.TOP_FILTER) Business.topFilter(Number(index));
      if(action === CONFIG.ACTIONS.DELETE_FILTER) Business.deleteFilter(Number(index));
      // 导航操作
      if(action === CONFIG.ACTIONS.SWITCH_NAV) Business.switchBottomNav(Number(actionBtn.dataset.index));
      // 分析页面操作
      if(action === 'refreshHistory') Business.refreshHistory();
      if(action === 'syncAnalyze') Business.syncAnalyze();
      if(action === 'syncZodiacAnalyze') Business.syncZodiacAnalyze();
      if(action === 'toggleDetail') Business.toggleDetail(actionBtn.dataset.target);
      if(action === 'loadMoreHistory') Business.loadMoreHistory();
      return;
    }

    // 7. 分析标签页切换
    const analysisTabBtn = target.closest('.analysis-tab-btn[data-analysis-tab]');
    if(analysisTabBtn){
      Business.switchAnalysisTab(analysisTabBtn.dataset.analysisTab);
      return;
    }

    // 8. 加载更多历史
    const loadMoreBtn = target.closest('#loadMore');
    if(loadMoreBtn){
      Business.loadMoreHistory();
      return;
    }
  },

  /**
   * 键盘事件处理（无障碍支持，回车/空格触发可交互元素）
   * @param {KeyboardEvent} e - 键盘事件
   */
  handleKeyDown: (e) => {
    // 仅处理回车和空格
    if(e.key !== 'Enter' && e.key !== ' ') return;
    
    const target = e.target;
    // 可交互元素
    const isInteractive = target.matches('.tag, .exclude-tag, .btn-mini, .btn-line, .nav-tab, .nav-toggle-btn, .back-top-btn, .filter-expand, .filter-item-btns button, .bottom-nav-item');
    
    if(isInteractive){
      e.preventDefault();
      target.click();
    }
  },

  /**
   * 点击空白关闭快捷导航
   * @param {MouseEvent} e - 点击事件
   */
  handleClickOutside: (e) => {
    if(!DOM.quickNav.contains(e.target) && DOM.quickNav.classList.contains('expanded')){
      Business.toggleQuickNav(false);
    }
  },

  /**
   * 全局错误捕获
   * @param {ErrorEvent} e - 错误事件
   */
  handleGlobalError: (e) => {
    console.error('全局错误', e.error);
    Toast.show('页面出现异常，请刷新重试');
  }
};

// ====================== 11. 应用初始化入口 ======================
/**
 * 应用初始化
 */
async function initApp() {
  try {
    // 1. 生成生肖数据
    Render.buildZodiacCycle();
    // 2. 生成号码基础数据
    Render.buildNumList();
    // 3. 初始化数据查询模块（打通所有数据关联）
    DataQuery.init();
    // 4. 渲染生肖标签
    Render.renderZodiacTags();
    // 5. 渲染排除号码网格
    Render.renderExcludeGrid();
    // 6. 加载本地存储的方案
    Storage.loadSavedFilters();
    // 7. 渲染方案列表
    Render.renderFilterList();
    // 8. 初始化事件绑定
    EventBinder.init();
    // 9. 启动分析页面倒计时和自动刷新检查
    Business.startCountdown();
    Business.checkDrawTimeLoop();
    // 10. 隐藏加载遮罩
    Render.hideLoading();
    
    console.log(`小摇筛选 v${CONFIG.VERSION} 初始化完成，当前农历生肖：${StateManager._state.currentZodiac}`);
  } catch(e) {
    console.error('应用初始化失败', e);
    Toast.show('页面初始化失败，请刷新重试');
    Render.hideLoading();
  }
}

// 页面加载完成后启动应用
window.addEventListener('DOMContentLoaded', initApp);
