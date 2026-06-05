/**
 * 业务层：生肖预测门面（拆分自原 business-zodiac-prediction.js，2026-06-05）
 * @namespace ZodiacPrediction
 *
 * 拆分后职责（本文件）：
 *   - 共享基础数据：ZODIAC_ORDER / ZODIAC_EMOJI / WUXING_MAP / WUXING_SHENG / TAIL_ZODIAC_MAP
 *   - 公共工具方法：getZodiacEmoji / _getSpecial
 *   - 作为统一调用门面，承载所有子模块挂载的方法
 *
 * 子模块拆分：
 *   - business-zodiac-scores.js   → 连续分数、策略调优、回测
 *   - business-zodiac-miss.js     → 遗漏历史、跟随统计
 *   - business-zodiac-zones.js    → 频率/区域分析/推荐/区域变动追踪
 *   - business-zodiac-stats.js    → 大小/奇偶/五行/波色统计
 *   - business-zodiac-backtest.js → 通用回测、综合未推荐
 *
 * 拆分原则（只新增不破坏）：
 * - 外部调用（business-main.js / view-zodiac-prediction.js / event.js 等）中
 *   所有 ZodiacPrediction.xxx() 引用方式完全不变
 * - 子模块加载完毕后通过 Object.assign 自动挂载到本门面上
 * - 各子模块内通过运行时查找 `ZodiacPrediction.xxx` 引用门面上的共享数据/工具
 */
const ZodiacPrediction = {
  ZODIAC_ORDER: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  ZODIAC_EMOJI: {
    '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
    '龙': '🐲', '蛇': '🐍', '马': '🐎', '羊': '🐏',
    '猴': '🐒', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
  },

  getZodiacEmoji: function(zodiac) {
    return this.ZODIAC_EMOJI[zodiac] || '';
  },

  WUXING_MAP: {
    '鼠': '水', '牛': '土', '虎': '木', '兔': '木',
    '龙': '土', '蛇': '火', '马': '火', '羊': '土',
    '猴': '金', '鸡': '金', '狗': '土', '猪': '水'
  },

  WUXING_SHENG: {
    '金': '水', '水': '木', '木': '火', '火': '土', '土': '金'
  },

  TAIL_ZODIAC_MAP: {
    0: ['鼠', '猪'], 1: ['牛', '狗'], 2: ['虎', '鸡'],
    3: ['兔', '猴'], 4: ['龙', '羊'], 5: ['蛇', '马'],
    6: ['鼠', '猪'], 7: ['牛', '狗'], 8: ['虎', '鸡'],
    9: ['兔', '猴']
  }

  /**
   * 兼容路径：_getSpecial 包装层已删除（2026-06-05 重构，统一使用 Utils.SpecialCalculator.getSpecial）
   * 原 _getSpecial: function(item) { return Utils.SpecialCalculator.getSpecial(item); }
   * 已无任何调用方（5 个子模块 ~30 处调用已统一替换为 Utils.SpecialCalculator.getSpecial）
   */
};
