/**
 * business-common-specials.js
 * 通用特码数据层：提供特码生肖/波色/五行等属性的统一访问入口
 *
 * 依赖：Utils.SpecialCalculator（core/utils.js）
 * 原则：薄封装层，不包含业务计算，仅做缓存/预计算优化
 */

const BusinessCommonSpecials = {

  /**
   * 预计算缓存（key: expect + openCode, value: getSpecial 结果）
   * @private
   */
  _precomputeCache: null,

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
  }

};