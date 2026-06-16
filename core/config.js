// 【核心层】常量、配置、枚举、映射表（禁止函数）
// 只读禁止修改：新增映射需确保与原有数据结构完全一致
// 2026-06-09 重构：整合所有基础映射（生肖/五行/波色/大小/单双/头尾/家禽野兽/阴阳/六合）

// ============================================================
// 基础数据变量（供 CONFIG 内部引用，不暴露给外部）
// ============================================================

// 生肖 Emoji 映射（12 生肖 → emoji）
var _ZODIAC_EMOJI = Object.freeze({
  '鼠': '🐭', '牛': '🐂', '虎': '🐯', '兔': '🐰',
  '龙': '🐉', '蛇': '🐍', '马': '🐴', '羊': '🐑',
  '猴': '🐵', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
});

// 阴阳映射（奇数=阳，偶数=阴）
var _YIN_YANG = Object.freeze({
  1:'阳',2:'阴',3:'阳',4:'阴',5:'阳',6:'阴',7:'阳',8:'阴',9:'阳',10:'阴',
  11:'阳',12:'阴',13:'阳',14:'阴',15:'阳',16:'阴',17:'阳',18:'阴',19:'阳',20:'阴',
  21:'阳',22:'阴',23:'阳',24:'阴',25:'阳',26:'阴',27:'阳',28:'阴',29:'阳',30:'阴',
  31:'阳',32:'阴',33:'阳',34:'阴',35:'阳',36:'阴',37:'阳',38:'阴',39:'阳',40:'阴',
  41:'阳',42:'阴',43:'阳',44:'阴',45:'阳',46:'阴',47:'阳',48:'阴',49:'阳'
});

// 六合映射（生肖 → 六合地支）
var _LIUHE = Object.freeze({
  '鼠':'酉','牛':'申','虎':'亥','兔':'戌','龙':'卯','蛇':'辰',
  '马':'丑','羊':'子','猴':'巳','鸡':'寅','狗':'未','猪':'午'
});

// 号码 → 生肖映射源数据（1-49，每年春节后需更新）
var _NUM_TO_ZODIAC_DATA = Object.freeze({
  1:'马',2:'蛇',3:'龙',4:'兔',5:'虎',6:'牛',7:'鼠',8:'猪',9:'狗',10:'鸡',11:'猴',12:'羊',
  13:'马',14:'蛇',15:'龙',16:'兔',17:'虎',18:'牛',19:'鼠',20:'猪',21:'狗',22:'鸡',23:'猴',24:'羊',
  25:'马',26:'蛇',27:'龙',28:'兔',29:'虎',30:'牛',31:'鼠',32:'猪',33:'狗',34:'鸡',35:'猴',36:'羊',
  37:'马',38:'蛇',39:'龙',40:'兔',41:'虎',42:'牛',43:'鼠',44:'猪',45:'狗',46:'鸡',47:'猴',48:'羊',49:'马'
});

// 生肖 → 号码映射（从 _NUM_TO_ZODIAC_DATA 反向构建）
var _ZODIAC_TO_NUM = Object.freeze((function() {
  var map = {};
  var all = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
  all.forEach(function(z) { map[z] = []; });
  for (var i = 1; i <= 49; i++) {
    var z = _NUM_TO_ZODIAC_DATA[i];
    if (z && map[z]) map[z].push(i);
  }
  all.forEach(function(z) { map[z] = Object.freeze(map[z]); });
  return Object.freeze(map);
})());

// 头映射（0-4 头）
var _HEAD_MAP = Object.freeze((function() {
  var m = {};
  for (var i = 1; i <= 49; i++) { m[i] = Math.floor(i / 10); }
  return Object.freeze(m);
})());

// 尾映射（0-9 尾）
var _TAIL_MAP = Object.freeze((function() {
  var m = {};
  for (var i = 1; i <= 49; i++) { m[i] = i % 10; }
  return Object.freeze(m);
})());

// ============================================================
// CONFIG 主对象（只读常量）
// ============================================================
const CONFIG = Object.freeze({
  VERSION: '2.0.7',
  DATA_VERSION: 1,
  API: Object.freeze({
    HISTORY: 'https://history.macaumarksix.com/history/macaujc2/y/'
  }),
  TOAST_DURATION: 2000,
  SCROLL_HIDE_DELAY: 1500,
  SCROLL_THROTTLE_DELAY: 100,
  CLICK_DEBOUNCE_DELAY: 50,
  ANIM_NORMAL: 300,
  BACK_TOP_THRESHOLD: 300,
  TOP_OFFSET: 240,
  PREVIEW_MAX_COUNT: 8,
  MAX_SAVE_COUNT: 30,

  // ========== 生肖基础配置 ==========
  ZODIAC_BASE: Object.freeze({
    '子':'鼠','丑':'牛','寅':'虎','卯':'兔','辰':'龙','巳':'蛇',
    '午':'马','未':'羊','申':'猴','酉':'鸡','戌':'狗','亥':'猪'
  }),
  EARTHLY_BRANCHES: Object.freeze(['子','丑','寅','卯','辰','巳','午','未','申','酉','戌','亥']),
  SPRING_FESTIVAL: Object.freeze({
    2025:'2025-01-29',2026:'2026-02-17',2027:'2027-02-06',
    2028:'2028-01-26',2029:'2029-02-13',2030:'2030-02-03'
  }),

  // ========== 分类配置 ==========
  JIAQIN: Object.freeze(['马','牛','羊','鸡','狗','猪']),
  YESHOU: Object.freeze(['鼠','虎','兔','龙','蛇','猴']),
  NUMBER_GROUPS: Object.freeze(['head','tail','sum','num']),

  // ========== 号码映射（全局统一来源） ==========
  NUM_TO_ZODIAC: _NUM_TO_ZODIAC_DATA,
  ZODIAC_TO_NUM: _ZODIAC_TO_NUM,
  ZODIAC_EMOJI: _ZODIAC_EMOJI,

  // ========== 号码属性映射 ==========
  COLOR_MAP: Object.freeze({
    '红':[1,2,7,8,12,13,18,19,23,24,29,30,34,35,40,45,46],
    '蓝':[3,4,9,10,14,15,20,25,26,31,36,37,41,42,47,48],
    '绿':[5,6,11,16,17,21,22,27,28,32,33,38,39,43,44,49]
  }),
  // 波色中文名 → 英文映射
  COLOR_NAME_TO_EN: Object.freeze({ '红':'red', '蓝':'blue', '绿':'green' }),
  ELEMENT_MAP: Object.freeze({
    '金':[4,5,12,13,26,27,34,35,42,43],
    '木':[8,9,16,17,24,25,38,39,46,47],
    '水':[1,14,15,22,23,30,31,44,45],
    '火':[2,3,10,11,18,19,32,33,40,41,48,49],
    '土':[6,7,20,21,28,29,36,37]
  }),
  BIG_RANGE: Object.freeze([25,49]),
  SMALL_RANGE: Object.freeze([1,24]),
  HEAD_MAP: _HEAD_MAP,
  TAIL_MAP: _TAIL_MAP,
  YIN_YANG_MAP: _YIN_YANG,
  LIUHE_MAP: _LIUHE,

  // ========== 分析模块配置 ==========
  ANALYSIS: Object.freeze({
    ZODIAC_ALL: Object.freeze(['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪']),
    HOME_ZODIAC: Object.freeze(['鼠','牛','兔','马','羊','鸡','狗','猪']),
    WILD_ZODIAC: Object.freeze(['虎','龙','蛇','猴']),
    ZODIAC_TRAD_TO_SIMP: Object.freeze({
      '鼠':'鼠','牛':'牛','虎':'虎','兔':'兔',
      '龍':'龙','龙':'龙','蛇':'蛇','馬':'马','马':'马',
      '羊':'羊','猴':'猴','雞':'鸡','鸡':'鸡','狗':'狗',
      '豬':'猪','猪':'猪'
    }),
    DEFAULT_PERIOD: 30,
    DEFAULT_SHOW_COUNT: 20
  }),

  // ========== 动作枚举 ==========
  ACTIONS: Object.freeze({
    RESET_GROUP:'resetGroup', SELECT_GROUP:'selectGroup', INVERT_GROUP:'invertGroup',
    CLEAR_GROUP:'clearGroup', MARK_GROUP:'markGroup', LOCK_GROUP:'lockGroup',
    SELECT_ALL:'selectAllFilters', CLEAR_ALL:'clearAllFilters', SAVE_FILTER:'saveFilterPrompt',
    SAVE_ZODIAC_FILTER:'saveZodiacFilterPrompt',
    CLEAR_ALL_SAVED:'clearAllSavedFilters', INVERT_EXCLUDE:'invertExclude', UNDO_EXCLUDE:'undoExclude',
    BATCH_EXCLUDE:'batchExcludePrompt', CLEAR_EXCLUDE:'clearExclude',
    TOGGLE_SHOW_ALL:'toggleShowAllFilters', LOAD_FILTER:'loadFilter', RENAME_FILTER:'renameFilter',
    COPY_FILTER:'copyFilterNums', TOP_FILTER:'topFilter', DELETE_FILTER:'deleteFilter',
    LOCK_FILTER:'toggleLockFilter',
    SWITCH_NAV:'switchBottomNav'
  }),

  // ========== 分区阈值配置 ==========
  ZONE_THRESHOLDS: Object.freeze({
    12: Object.freeze([4,3,2,1,0,0,0]),
    24: Object.freeze([8,6,5,4,3,2,0]),
    36: Object.freeze([12,9,7,5,3,2,0])
  })
});
