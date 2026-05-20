const CONFIG = Object.freeze({
  VERSION: 'Beta2',
  DATA_VERSION: 1, // 数据版本号，用于后续数据迁移
  // API配置（GitHub Pages/Vercel均使用完整URL直连外部API）
  API: Object.freeze({
    HISTORY: 'https://history.macaumarksix.com/history/macaujc2/y/'
  }),
  // 动画配置
  TOAST_DURATION: 2000,
  SCROLL_HIDE_DELAY: 1500,
  SCROLL_THROTTLE_DELAY: 100,
  CLICK_DEBOUNCE_DELAY: 50,
  ANIM_NORMAL: 300,
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
  NUMBER_GROUPS: Object.freeze(['head','tail','sum','num']), // 数字类型的分组
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
    MARK_GROUP: 'markGroup',
    LOCK_GROUP: 'lockGroup',
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
