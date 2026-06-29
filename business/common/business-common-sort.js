/**
 * 业务层 - 通用排序工具（2026-06-20 新增）
 *
 * 职责：将视图层常见的 .sort() 业务计算下沉到业务层，避免视图层违反
 *      「❌ 禁止在 view-*.js 中出现任何业务计算」红线。
 *
 * 使用规范：
 *   - 视图层如需排序，调用 BusinessCommonSort.sortByXxx(arr, ...)
 *   - 不再直接在视图层 .sort(callback)
 *
 * 依赖方向：被 views/ 调用，无任何 DOM 操作
 * 拆分记录：2026-06-20 从 views/view-analysis-full.js / view-zodiac-giong.js
 *          等多处重复 .sort 提取为统一业务层函数
 */
const BusinessCommonSort = {

  /**
   * 按数字字段降序排序
   * @param {Array} list 列表
   * @param {string} field 字段名
   * @returns {Array} 排序后的新数组（不修改原数组）
   */
  sortByNumberDesc: (list, field) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => (b[field] || 0) - (a[field] || 0));
  },

  /**
   * 按数字字段升序排序
   * @param {Array} list 列表
   * @param {string} field 字段名
   * @returns {Array} 排序后的新数组
   */
  sortByNumberAsc: (list, field) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => (a[field] || 0) - (b[field] || 0));
  },

  /**
   * 按 count 字段降序排序（高频用法）
   * @param {Array} list 列表
   * @returns {Array} 排序后的新数组
   */
  sortByCountDesc: (list) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => (b.count || 0) - (a.count || 0));
  },

  /**
   * 按 value 字段降序排序（用于 Object.entries 后排序）
   * @param {Array<[string, number]>} entries Object.entries 结果
   * @returns {Array} 排序后的新数组
   */
  sortEntriesByValueDesc: (entries) => {
    if (!Array.isArray(entries)) return [];
    return [...entries].sort((a, b) => b[1] - a[1]);
  },

  /**
   * 按 shengxiao 字符串本地化排序
   * @param {Array} list 列表
   * @returns {Array} 排序后的新数组
   */
  sortByZodiacName: (list) => {
    if (!Array.isArray(list)) return [];
    return [...list].sort((a, b) => {
      const an = (a.shengxiao || a.zodiac || a.name || '').toString();
      const bn = (b.shengxiao || b.zodiac || b.name || '').toString();
      return an.localeCompare(bn, 'zh-CN');
    });
  }
};
