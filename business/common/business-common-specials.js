/**
 * business-common-specials.js
 * 通用特码数据层：提供特码生肖/波色/五行等属性的统一访问入口
 *
 * 依赖：Utils.SpecialCalculator（core/utils.js）
 * 原则：薄封装层，不包含业务计算，仅做缓存/预计算优化
 *
 * v2.5.0 扩展：
 * - 新增 buildWindowed(histories, ...) 滑动窗口预计算 API
 *   用于回测场景，一次性预计算多段 historyData 的 specials，避免重复 getSpecial
 * - 新增 cache-aware 子数组返回，让调用方可直接复用 specials[i..i+W]
 */

const BusinessCommonSpecials = {

  /**
   * 预计算缓存（key: expect + openCode, value: getSpecial 结果）
   * @private
   */
  _precomputeCache: null,

  /**
   * 滑动窗口缓存（v2.5.0 新增）
   * @private
   * 结构：{ data: historyData引用, specials: Array<getSpecial result> }
   * 缓存整段 historyData 对应的 specials 数组 + 子切片，避免回测中重复计算
   */
  _windowCache: null,

  /**
   * 获取单个数据项的特码信息
   * 直接委托给 Utils.SpecialCalculator.getSpecial（自带 LRU 缓存）
   * @param {Object} item - 历史数据项 { expect, openCode, zodiac }
   * @returns {Object} 特码信息 { te, tail, head, wave, colorName, zod, odd, big, wuxing, animal, fullZodArr }
   */
  getOne: (item) => {
    return Utils.SpecialCalculator.getSpecial(item);
  },

  /**
   * 批量预计算特码信息（用于同一区块内多次使用 getOne 的场景，减少重复计算）
   * @param {Array} list - 历史数据项数组
   * @returns {Array} 特码信息数组（与 list 同长度）
   */
  precompute: (list) => {
    if (!Array.isArray(list) || !list.length) return [];
    return Utils.SpecialCalculator.batchGetSpecial(list);
  },

  /**
   * 滑动窗口预计算（v2.5.0 新增）
   *
   * 用法：在回测循环开始前调用一次，得到 specials 全量数组；
   *      回测过程中直接用 specials.slice(offset+1, offset+1+W) 获取窗口。
   *
   * 性能对比（n=100, W=24, limit=36）：
   *   - 旧方案：每期 slice + 逐项 getSpecial → 76 次数组切片 + 76*N 次特殊检查
   *   - 新方案：1 次预计算 + 76 次小数组切片 → 1800+ 次 getSpecial → 100 次
   *
   * 失效：historyData 引用变化时自动重建；可手动调用 clearWindowCache() 强制清空
   *
   * @param {Array} historyData - 历史数据
   * @returns {Array} specials 数组（与 historyData 等长）
   */
  buildWindowed: (historyData) => {
    if (!Array.isArray(historyData) || !historyData.length) return [];

    const cache = BusinessCommonSpecials._windowCache;
    if (cache && cache.data === historyData) {
      return cache.specials;
    }

    // 失效或首次：重新预计算
    const specials = Utils.SpecialCalculator.batchGetSpecial(historyData);
    BusinessCommonSpecials._windowCache = {
      data: historyData,
      specials: specials
    };
    return specials;
  },

  /**
   * 获取当前缓存的 specials（不触发预计算）
   * 用于调用方在 buildWindowed 后访问缓存数组（避免再创建新引用）
   * @returns {Array|null}
   */
  peekWindowed: () => {
    const cache = BusinessCommonSpecials._windowCache;
    return cache ? cache.specials : null;
  },

  /**
   * 清除滑动窗口缓存（v2.5.0 新增）
   * 在以下场景调用：
   *  - 历史数据刷新时（防止数据穿越）
   *  - 视图层卸载组件时
   *  - 调试时强制重建
   */
  clearWindowCache: () => {
    BusinessCommonSpecials._windowCache = null;
  }

};