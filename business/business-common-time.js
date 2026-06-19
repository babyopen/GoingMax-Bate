/**
 * 业务层 - 通用时间格式化工具（2026-06-20 新增）
 *
 * 职责：将视图层常见的时间格式化（"X 小时前 / X 天前"）下沉到业务层，
 *      避免视图层违反「❌ 禁止在 view-*.js 中出现任何业务计算」红线。
 *
 * 使用规范：
 *   - 视图层调用 BusinessCommonTime.formatRelative(timestamp)
 *   - 不再直接在视图层 new Date() + Math.floor(diff/...)
 *
 * 依赖方向：被 views/ 调用，无任何 DOM 操作
 * 拆分记录：2026-06-20 从 views/view-zodiac-main.js 等多处重复代码提取
 */
const BusinessCommonTime = {

  /**
   * 格式化时间戳为 "刚刚 / X 分钟前 / X 小时前 / X 天前" 格式
   * @param {number} timestamp 毫秒时间戳
   * @returns {string} 相对时间文本
   */
  formatRelative: (timestamp) => {
    if (!timestamp || isNaN(timestamp)) return '';
    const now = Date.now();
    const diff = now - timestamp;
    if (diff < 0) return BusinessCommonTime._formatAbsolute(timestamp);

    const minute = 60 * 1000;
    const hour = 60 * minute;
    const day = 24 * hour;

    if (diff < minute) return '刚刚';
    if (diff < hour) return Math.floor(diff / minute) + '分钟前';
    if (diff < day) return Math.floor(diff / hour) + '小时前';
    if (diff < 7 * day) return Math.floor(diff / day) + '天前';
    return BusinessCommonTime._formatAbsolute(timestamp);
  },

  /**
   * 格式化为绝对时间（YYYY-MM-DD HH:mm）
   * @param {number} timestamp 毫秒时间戳
   * @returns {string} 绝对时间文本
   */
  formatAbsolute: (timestamp) => {
    if (!timestamp || isNaN(timestamp)) return '';
    return BusinessCommonTime._formatAbsolute(timestamp);
  },

  /**
   * 内部：绝对时间格式化
   * @private
   */
  _formatAbsolute: (timestamp) => {
    const d = new Date(timestamp);
    const pad = (n) => String(n).padStart(2, '0');
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
      ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes());
  }
};
