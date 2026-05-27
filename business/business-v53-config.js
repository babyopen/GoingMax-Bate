/**
 * V5.3 分区分层动态热度评分方案 - 配置常量
 * 来源文档: /指令、逻辑说明等/V5.3-修复版.md
 * 完全遵循V5.3-修复版.md文档第一章至第七章的全部规范
 */
const BusinessV53Config = {
  VERSION: 'V5.3',

  // ========== 第一章 1.1 永久分区 ==========
  FIXED_POOLS: Object.freeze({
    HOT: [1, 5, 6, 7, 12],
    COLD: [2, 3, 4, 8, 9, 10, 11]
  }),

  // ========== 滑动窗口配置 ==========
  WINDOWS: Object.freeze({
    MARKOV: 200,
    ASSOCIATION: 50,
    PHYSICAL: 20,
    TREND: 3,
    FREQ_36: 36,
    FREQ_24: 24,
    FREQ_12: 12,
    FREQ_7: 7,
    FREQ_3: 3
  }),

  // ========== 第二章 2.1 基础分权重 ==========
  BASE_WEIGHTS: Object.freeze({
    W36: 1, W24: 2, W12: 3, W7: 7, W3: 8
  }),

  // ========== 第二章 2.7 连出修正系数 ==========
  CONSECUTIVE_FACTOR: Object.freeze({
    0: 1.0, 1: 0.85, 2: 0.6, 3: 0.3
  }),

  // ========== 第二章 2.8 + 第三章 五区制风控系数 ==========
  ZONE_RISK_BASE: Object.freeze({
    PEAK:   { freq: 4, coeff: 0.5 },
    DOWN:   { freq: 3, coeff: 0.7 },
    ROTATE: { freq: 2, coeff: 1.0 },
    WAIT:   { freq: 1, coeff: 1.0 },
    SILENT: { freq: 0, coeff: 1.0 }
  }),

  // 自适应风控系数最终值（按文档2.8节表格，直接查表，不再用乘法）
  ZONE_RISK_TABLE: Object.freeze({
    strongHot:   { peak: 0.5, down: 0.7, rotate: 1.0, wait: 1.0, silent: 1.0 },
    strongCold:  { peak: 0.5, down: 0.7, rotate: 1.0, wait: 1.0, silent: 1.0 },
    oscillation: { peak: 0.3, down: 0.5, rotate: 1.0, wait: 1.0, silent: 1.0 }
  }),

  // 解权阈值：近11期≤2次时自动恢复1.0
  RISK_RELEASE_FREQ11: 2,

  // ========== 第二章 2.8 震荡趋势收紧系数 ==========
  TREND_RISK_MULTIPLIER: Object.freeze({
    strongHot: 1.0,
    strongCold: 1.0,
    oscillation: 0.7
  }),

  // ========== 第四章 动态身份状态枚举 ==========
  STATUS: Object.freeze({
    NORMAL_HOT:               'normal_hot',
    NORMAL_COLD:              'normal_cold',
    HOT_TO_COLD_HARD_OBSERVE: 'hot_to_cold_hard_observe',
    HOT_TO_COLD_SOFT_OBSERVE: 'hot_to_cold_soft_observe',
    COLD_TO_HOT_HARD_OBSERVE: 'cold_to_hot_hard_observe',
    COLD_TO_HOT_SOFT_OBSERVE: 'cold_to_hot_soft_observe'
  }),

  // ========== 第四章 观察期配置 ==========
  OBSERVE_PERIODS: Object.freeze({
    HOT_TO_COLD_HARD: 3,
    HOT_TO_COLD_SOFT: 3,
    COLD_TO_HOT_HARD: 2,
    COLD_TO_HOT_SOFT: 2
  }),

  // ========== 第一章 1.2 关联规则阈值 ==========
  ASSOCIATION: Object.freeze({
    MIN_SUPPORT: 3,
    MIN_CONFIDENCE: 0.6,
    MIN_LIFT: 1.5,
    MAX_RULES: 3
  }),

  // ========== 第二章 2.5 马尔可夫加分映射 ==========
  MARKOV_BONUS_MAP: Object.freeze([
    { threshold: 0.30, bonus: 10 },
    { threshold: 0.20, bonus: 7 },
    { threshold: 0.15, bonus: 4 },
    { threshold: 0.10, bonus: 2 },
    { threshold: 0.05, bonus: 1 }
  ]),

  // ========== 第五章 5.1 冷号缩权参数 ==========
  COLD_WEIGHT: Object.freeze({
    FACTOR: 0.1,
    RECENT_WINDOW: 2
  }),

  // ========== 第五章 5.5 趋势判定阈值 ==========
  TREND_THRESHOLD: Object.freeze({
    HOT_MIN: 2,
    COLD_MIN: 2
  }),

  // ========== 第六章 推荐策略输出格式 ==========
  RECOMMENDATION: Object.freeze({
    MAIN_COUNT: 4,
    BACKUP_COUNT: 2,
    CHANGE_DISK: 6
  }),

  // ========== 第七章 性能约束 ==========
  PERFORMANCE: Object.freeze({
    MAX_COMPUTE_TIME: 100,
    MAX_HISTORY_LENGTH: 500
  })
};