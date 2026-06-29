/**
 * 核心层 - 通用平台能力工具（2026-06-24 新增）
 *
 * 职责：将 core/utils.js 中"设备判断 / 安全区 / 剪贴板 / 网络状态"等
 *      与平台/浏览器环境交互的工具抽取为独立模块
 *
 * 抽取自：
 *   - core/utils.js:209-211  getSafeTop
 *   - core/utils.js:650-694  copyToClipboard
 *
 * 设计要点：
 *   - 所有方法都对运行环境的依赖做容错（如 Toast 不存在时不报错）
 *   - copyToClipboard 提供 3 级降级：navigator.clipboard → execCommand → fallback
 *   - getSafeTop 已参数化 CSS 变量名
 *   - 跨项目复制即用，依赖 Toast（可选）
 *
 * 依赖方向：被 business/* / views/* / event.js 等任何模块调用
 * 跨项目复用：直接复制此文件即可（Toast / document 是浏览器原生）
 */
const CommonPlatform = {

  // ============================================================
  // 1) 设备 / 平台判断
  // ============================================================

  /**
   * 是否移动设备
   * @returns {boolean}
   */
  isMobile: () => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
    );
  },

  /**
   * 是否 iOS 设备
   * @returns {boolean}
   */
  isIOS: () => {
    return /iPad|iPhone|iPod/.test(
      (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
    ) && !window.MSStream;
  },

  /**
   * 是否 Android 设备
   * @returns {boolean}
   */
  isAndroid: () => {
    return /Android/i.test(
      (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
    );
  },

  /**
   * 是否微信内置浏览器
   * @returns {boolean}
   */
  isWechat: () => {
    return /MicroMessenger/i.test(
      (typeof navigator !== 'undefined' ? navigator.userAgent : '') || ''
    );
  },

  /**
   * 是否小程序 web-view 环境
   * @returns {boolean}
   */
  isMiniProgram: () => {
    return (typeof window !== 'undefined' && typeof window.__wxjs_environment !== 'undefined') ||
           (typeof navigator !== 'undefined' && /miniProgram/i.test(navigator.userAgent || ''));
  },

  // ============================================================
  // 2) 安全区 / 视口
  // ============================================================

  /**
   * 获取 CSS 变量值
   * @param {string} name - CSS 变量名（含 '--'）
   * @param {Element} [target=documentElement] - 目标元素
   * @returns {number} 解析后的数值（px），无值返回 0
   */
  getCssVar: (name, target) => {
    var el = target || (typeof document !== 'undefined' ? document.documentElement : null);
    if (!el) return 0;
    var raw = getComputedStyle(el).getPropertyValue(name);
    return parseFloat(raw) || 0;
  },

  /**
   * 获取安全区顶部高度
   * @param {string} [cssVar='--safe-top'] - CSS 变量名
   * @returns {number} 安全区高度(px)
   */
  getSafeTop: (cssVar) => {
    return CommonPlatform.getCssVar(cssVar || '--safe-top');
  },

  /**
   * 获取安全区底部高度
   * @param {string} [cssVar='--safe-bottom'] - CSS 变量名
   * @returns {number} 安全区底部高度(px)
   */
  getSafeBottom: (cssVar) => {
    return CommonPlatform.getCssVar(cssVar || '--safe-bottom');
  },

  /**
   * 获取视口尺寸
   * @returns {{width:number, height:number}}
   */
  getViewportSize: () => {
    if (typeof window === 'undefined') return { width: 0, height: 0 };
    return {
      width: window.innerWidth || document.documentElement.clientWidth || 0,
      height: window.innerHeight || document.documentElement.clientHeight || 0
    };
  },

  // ============================================================
  // 3) 剪贴板（带 3 级降级）
  // ============================================================

  /**
   * 复制文本到剪贴板（带 3 级降级 + Toast 提示）
   * 优先级：
   *   1. navigator.clipboard.writeText（HTTPS / localhost）
   *   2. document.execCommand('copy') + 隐藏 textarea
   *   3. fallback 回调（可打开 modal 让用户手动复制）
   *
   * @param {string} text - 要复制的文本
   * @param {Object} [opts]
   * @param {string} [opts.successMsg='已复制'] - 成功 Toast 文案
   * @param {string} [opts.errorMsg='复制失败，请手动复制'] - 失败 Toast 文案
   * @param {Function} [opts.fallback] - 失败回调函数
   *   签名：fallback(text: string)
   * @returns {Promise<boolean>} 是否成功
   */
  copyToClipboard: async (text, opts) => {
    opts = opts || {};
    var successMsg = opts.successMsg || '已复制';
    var errorMsg = opts.errorMsg || '复制失败，请手动复制';
    var fallback = opts.fallback;

    // 优先：navigator.clipboard API
    if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        if (typeof Toast !== 'undefined' && Toast.show) Toast.show(successMsg);
        return true;
      } catch (e) {
        // 降级到 textarea + execCommand
      }
    }

    // 降级：textarea + execCommand
    try {
      var textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      var ok = document.execCommand('copy');
      document.body.removeChild(textarea);
      if (ok) {
        if (typeof Toast !== 'undefined' && Toast.show) Toast.show(successMsg);
        return true;
      }
    } catch (e) {
      // 继续到 fallback
    }

    // 兜底回调
    if (typeof fallback === 'function') {
      fallback(text);
      return false;
    }
    if (typeof Toast !== 'undefined' && Toast.show) Toast.show(errorMsg);
    return false;
  },

  // ============================================================
  // 4) 网络状态
  // ============================================================

  /**
   * 是否联网
   * @returns {boolean} navigator.onLine 状态
   */
  isOnline: () => {
    if (typeof navigator === 'undefined') return true;
    return navigator.onLine !== false;
  },

  /**
   * 监听网络状态变化
   * @param {Function} onOnline - 在线回调
   * @param {Function} onOffline - 离线回调
   * @returns {Function} 取消监听的函数
   */
  watchNetwork: (onOnline, onOffline) => {
    if (typeof window === 'undefined') return function() {};
    var onlineHandler = function() { if (typeof onOnline === 'function') onOnline(); };
    var offlineHandler = function() { if (typeof onOffline === 'function') onOffline(); };
    window.addEventListener('online', onlineHandler);
    window.addEventListener('offline', offlineHandler);
    return function unbind() {
      window.removeEventListener('online', onlineHandler);
      window.removeEventListener('offline', offlineHandler);
    };
  },

  // ============================================================
  // 5) 浏览器能力检测
  // ============================================================

  /**
   * 是否支持 localStorage
   * @returns {boolean}
   */
  hasLocalStorage: () => {
    try {
      var testKey = '__test_' + Date.now();
      localStorage.setItem(testKey, '1');
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * 是否支持 sessionStorage
   * @returns {boolean}
   */
  hasSessionStorage: () => {
    try {
      var testKey = '__test_' + Date.now();
      sessionStorage.setItem(testKey, '1');
      sessionStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  },

  /**
   * 是否支持 Promise
   * @returns {boolean}
   */
  hasPromise: () => {
    return typeof Promise !== 'undefined' && Promise.toString().indexOf('[native code]') !== -1;
  },

  /**
   * 是否支持 async/await
   * @returns {boolean}
   */
  hasAsyncAwait: () => {
    try {
      return (new Function('return (async () => {})()'))() instanceof Promise;
    } catch (e) {
      return false;
    }
  }
};