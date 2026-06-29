/**
 * 业务层 - 通用 LRU 缓存工具（v2.0.8 新增）
 *
 * 职责：将 historyData 等大型数组作为 key 的高频计算函数包装为 LRU 缓存函数
 *      避免视图层频繁刷新时的重复计算开销。
 *
 * 设计要点：
 *   - 以 historyData 数组引用作为 key（同一份数据反复使用时不重算）
 *   - 容量上限 50 条，超过时按 LRU 淘汰最久未使用
 *   - historyData 引用变化（刷新数据）时自动失效旧缓存
 *
 * 使用规范：
 *   - 业务层高频计算函数：calcContinuousScores / runZoneBacktest / getLatest*Stats 等
 *     调用 withHistoryLRU(fn, 50) 包装一次即可
 *
 * 依赖方向：被 business/* 业务模块使用
 */
const BusinessCommonLRU = {

  /**
   * 以 historyData 引用为 key 的 LRU 包装器（v2.0.8）
   * 适用于输入包含 historyData 的纯函数（其他参数拼到 key 中）
   *
   * @param {Function} fn - 原函数，签名为 fn(historyData, ...args)
   * @param {number} [maxSize=50] - LRU 最大容量
   * @param {Function} [extraKeyFn] - 额外参数 key 生成函数（可选）
   * @returns {Function} 包装后的函数
   *
   * @example
   *   var _calcContinuousScores = BusinessCommonLRU.withHistoryLRU(function(historyData) {
   *     // 复杂计算...
   *     return result;
   *   }, 30);
   *   // 调用：_calcContinuousScores(historyData)  // 同一引用命中缓存
   */
  withHistoryLRU: (fn, maxSize, extraKeyFn) => {
    var cache = Utils.createLRU(maxSize || 50);
    return function(historyData) {
      // key = historyData 引用 + 额外参数
      var key = historyData;
      if (extraKeyFn) {
        var extra = extraKeyFn(Array.prototype.slice.call(arguments, 1));
        key = historyData + '|' + extra;
      }
      var cached = cache.get(key);
      if (cached !== undefined) return cached;
      var result = fn.apply(this, arguments);
      cache.set(key, result);
      return result;
    };
  },

  /**
   * 以 historyData 引用 + 窗口大小为 key 的 LRU 包装器（v2.0.8）
   * 适用于 calcFrequencyRating / getLatestSizeStats 等依赖 (historyData, windowSize) 的函数
   *
   * @param {Function} fn - 原函数，签名为 fn(historyData, windowSize, ...args)
   * @param {number} [maxSize=100] - LRU 最大容量
   * @returns {Function} 包装后的函数
   */
  withHistoryWindowLRU: (fn, maxSize) => {
    var cache = Utils.createLRU(maxSize || 100);
    return function(historyData, windowSize) {
      var key = historyData + '|' + (windowSize || 'all');
      var cached = cache.get(key);
      if (cached !== undefined) return cached;
      var result = fn.apply(this, arguments);
      cache.set(key, result);
      return result;
    };
  },

  /**
   * 清除所有 LRU 缓存（历史数据刷新时调用）
   * 业务层无需持有 cache 引用，刷新时统一清空即可
   */
  clearAll: () => {
    // 注：每个包装后的函数持有自己的 cache，这里通过一个全局注册表来支持统一清空
    if (BusinessCommonLRU._registry) {
      BusinessCommonLRU._registry.forEach(function(cache) {
        cache.clear();
      });
    }
  },

  /**
   * 注册 cache 用于统一管理（私有 API，由包装器内部调用）
   * @private
   */
  _registry: null,
  _ensureRegistry: function() {
    if (!BusinessCommonLRU._registry) BusinessCommonLRU._registry = new Set();
  },
  _register: function(cache) {
    BusinessCommonLRU._ensureRegistry();
    BusinessCommonLRU._registry.add(cache);
  },

  /**
   * 内部辅助：创建带注册能力的 LRU
   * @private
   */
  _createRegisteredLRU: function(maxSize) {
    var cache = Utils.createLRU(maxSize);
    BusinessCommonLRU._register(cache);
    return cache;
  }
};

/**
 * 注册一个 LRU 到统一管理表（供业务模块直接调用，无须访问 BusinessCommonLRU._registry）
 * 用法：
 *   var _cache = BusinessCommonLRU.createRegisteredLRU(50);
 *   _cache.get(key); _cache.set(key, value);
 */
BusinessCommonLRU.createRegisteredLRU = function(maxSize) {
  return BusinessCommonLRU._createRegisteredLRU(maxSize);
};