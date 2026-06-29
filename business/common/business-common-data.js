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
    var s = state || StateManager._state;
    return (s && s.analysis && s.analysis.historyData) || [];
  },

  /**
   * 确保历史数据存在（如果为空则尝试从 localStorage 加载）
   * @param {Object} [state] - 状态对象（可选）
   * @returns {Array} 历史数据数组
   */
  ensureHistoryData: (state) => {
    var s = state || StateManager._state;
    var data = BusinessCommonData.getHistoryData(s);
    if (!data || !data.length) {
      // 尝试从 Storage 加载
      try {
        if (typeof StorageManager !== 'undefined' && StorageManager.loadHistory) {
          var loaded = StorageManager.loadHistory();
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
    var s = state || StateManager._state;
    var historyData = BusinessCommonData.getHistoryData(s);
    var timestamp = (s && s.analysis && s.analysis.historyTimestamp) || 0;
    return {
      historyData: historyData,
      timestamp: timestamp
    };
  }

};