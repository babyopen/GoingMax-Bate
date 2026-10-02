/**
 * business-common-data.js
 * 通用数据层：提供历史数据的统一访问入口
 *
 * 依赖：StateManager（core/state.js）
 * 原则：纯数据访问，无 DOM 操作、无业务计算
 */

const BusinessCommonData = {

  /**
   * 获取历史数据
   * @param {Object} [state] - 状态对象（可选，默认取 StateManager._state）
   * @returns {Array} 历史数据数组
   */
  getHistoryData: (state) => {
    const s = state || StateManager._state;
    return (s && s.analysis && s.analysis.historyData) || [];
  },

  /**
   * 确保历史数据存在（如果为空则尝试从 localStorage 加载）
   * @param {Object} [state] - 状态对象（可选）
   * @returns {Array} 历史数据数组
   */
  ensureHistoryData: (state) => {
    const s = state || StateManager._state;
    const data = BusinessCommonData.getHistoryData(s);
    if (!data || !data.length) {
      // 尝试从 Storage 加载
      try {
        if (typeof StorageManager !== 'undefined' && StorageManager.loadHistory) {
          const loaded = StorageManager.loadHistory();
          if (loaded && loaded.length) {
            if (s && s.analysis) {
              s.analysis.historyData = loaded;
            } else if (StateManager._state && StateManager._state.analysis) {
              StateManager._state.analysis.historyData = loaded;
            }
            return loaded;
          }
        }
      } catch (e) {
        console.warn('BusinessCommonData.ensureHistoryData: 从 Storage 加载历史数据失败', e);
      }
    }
    return data;
  },

  /**
   * 获取历史数据及时间戳（用于数据陈旧检测）
   * @param {Object} [state] - 状态对象（可选）
   * @returns {{ historyData: Array, timestamp: number }}
   */
  getDataWithTimestamp: (state) => {
    const s = state || StateManager._state;
    const historyData = BusinessCommonData.getHistoryData(s);
    const timestamp = (s && s.analysis && s.analysis.historyTimestamp) || 0;
    return {
      historyData: historyData,
      timestamp: timestamp
    };
  },

  // ============================================================
  // v2.7.0 新增：分析快照缓存层
  // 解决问题：refreshHistory / renderFullAnalysis / renderZodiacAnalysis / initGiongTab
  //   每次都会重新遍历 historyData 计算 specials + 各种统计。
  //   实际数据未变时，结果是完全相同的——浪费 CPU。
  //
  // 设计：
  //   - key = historyData 引用 + analyzeLimit + 数据指纹（首期 expect + 末期 expect + 长度）
  //   - value = { specials, computed, createdAt }
  //   - 调用方传入 cacheKey（如 'full' / 'zodiac'）区分不同分析维度
  //   - 数据刷新时由 BusinessMain.invalidateAnalysisCache() 清空
  // ============================================================

  /**
   * 快照缓存 Map<cacheKey, { dataRef, summary, computed }>
   * @private
   */
  _analysisSnapshotCache: null,

  /**
   * 生成数据指纹（基于首期+末期+长度+总大小）
   * 用于检测 historyData 是否实质变化（避免引用改变但内容相同）
   * @private
   * @param {Array} data
   * @returns {string}
   */
  _fingerprint: (data) => {
    if (!Array.isArray(data) || !data.length) return 'empty';
    const len = data.length;
    const first = data[0];
    const last = data[len - 1];
    return len + ':' + (first && first.expect || '') + ':' + (last && last.expect || '') + ':' + first.expect + last.expect;
  },

  /**
   * 获取或创建分析快照
   * 调用方传入 cacheKey 区分不同分析维度，data 与 limits 都匹配时直接返回缓存
   *
   * @param {string} cacheKey - 缓存键名（如 'full' / 'zodiac' / 'merged'）
   * @param {Array} data - historyData
   * @param {number} limit - 分析窗口大小
   * @param {Function} computeFn - 实际计算函数，接收 specials 数组，返回任意结果
   * @returns {*} 计算结果（与 computeFn 返回值相同）
   */
  getOrComputeSnapshot: (cacheKey, data, limit, computeFn) => {
    if (!BusinessCommonData._analysisSnapshotCache) {
      BusinessCommonData._analysisSnapshotCache = new Map();
    }
    const cache = BusinessCommonData._analysisSnapshotCache;
    if (!Array.isArray(data) || !data.length) return null;

    const dataRef = data;
    const fp = BusinessCommonData._fingerprint(data);
    const fullKey = cacheKey + '|' + fp + '|' + limit + '|' + dataRef.length;
    const entry = cache.get(fullKey);

    // 命中：data 引用 + 指纹 + limit 都一致（避免脏数据穿透）
    if (entry && entry.dataRef === dataRef && entry.fingerprint === fp && entry.limit === limit) {
      return entry.computed;
    }

    // 失效或首次：调用 computeFn
    // 预计算 specials 数组传入函数，让 computeFn 复用 specials，避免内部 getOne 重复查缓存
    const specials = BusinessCommonData._buildSpecialsSlice(data, limit);
    const computed = computeFn( specials.slice, specials.list );

    // 仅缓存成功计算的结果（非 null/undefined）
    if (computed !== null && computed !== undefined) {
      cache.set(fullKey, {
        dataRef: dataRef,
        fingerprint: fp,
        limit: limit,
        computed: computed,
        createdAt: Date.now()
      });
    }
    return computed;
  },

  /**
   * 预计算 specials 列表（窗口内）
   * @private
   * @param {Array} data
   * @param {number} limit
   * @returns {{ list: Array, slice: (start, end) => Array }}
   */
  _buildSpecialsSlice: (data, limit) => {
    const list = data.slice(0, Math.min(limit, data.length));
    // 一次性预计算所有 specials（利用 SpecialCalculator 内部 LRU，二次访问 O(1)）
    const specials = list.map(item => Utils.SpecialCalculator.getSpecial(item));
    return {
      list: list,
      slice: function(start, end) {
        return specials.slice(start, end);
      },
      // 直接暴露 specials，让 computeFn 自由遍历
      specials: specials
    };
  },

  /**
   * 失效分析快照缓存
   * 在以下场景调用：
   *   - historyData 引用变化时（数据刷新后）
   *   - analyzeLimit 变化时
   *   - 调试时强制重建
   */
  invalidateAnalysisCache: () => {
    BusinessCommonData._analysisSnapshotCache = null;
  },

  /**
   * 移除指定 cacheKey 的缓存条目（精细化失效）
   * @param {string} cacheKey
   */
  invalidateAnalysisCacheByKey: (cacheKey) => {
    const cache = BusinessCommonData._analysisSnapshotCache;
    if (!cache) return;
    for (const key of cache.keys()) {
      if (key.indexOf(cacheKey + '|') === 0) {
        cache.delete(key);
      }
    }
  },

  /**
   * 获取缓存统计（调试用）
   * @returns {{ size: number, keys: string[] }}
   */
  getAnalysisCacheStats: () => {
    const cache = BusinessCommonData._analysisSnapshotCache;
    if (!cache) return { size: 0, keys: [] };
    return {
      size: cache.size,
      keys: Array.from(cache.keys())
    };
  }

};