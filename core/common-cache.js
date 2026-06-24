/**
 * 核心层 - 通用缓存工具（2026-06-24 新增）
 *
 * 职责：将 core/utils.js 中与"缓存 / 高频优化 / 定时器管理"相关的工具
 *      抽取为独立模块，便于跨项目直接复用：
 *   - LRU 缓存（createLRU）
 *   - 函数记忆化（memoize / memoizeLRU）
 *   - 高频事件节流 / 防抖（throttle / debounce / delayedToggle）
 *   - 定时器管理（TimerManager）
 *
 * 拆分记录：
 *   - 2026-06-24 从 core/utils.js 中抽取 7 组函数（createLRU / memoize / memoizeLRU /
 *     throttle / debounce / delayedToggle / TimerManager）至独立文件。
 *   - core/utils.js 保留原函数作为兜底，调用方继续用 Utils.* 也可，改用 CommonCache.* 也可。
 *
 * 设计要点：
 *   - 纯函数 + 工具集，无项目特定依赖，可跨项目直接复用
 *   - 零 DOM / 零状态 / 零存储 / 零全局副作用（除 TimerManager 内部状态外）
 *   - 内部状态隔离：每个 LRU / memoize / TimerManager 实例互不影响
 *
 * 依赖方向：被 business/* / event.js / data/* 等任何模块调用
 * 跨项目复用：直接复制此文件即可，无任何项目特定依赖
 */
const CommonCache = {

  // ============================================================
  // 1) LRU 缓存
  // ============================================================

  /**
   * 创建 LRU 缓存（限制最大数量）
   * @param {number} maxSize - 最大缓存数量
   * @returns {{get: Function, set: Function, clear: Function, has: Function, size: number}}
   */
  createLRU: (maxSize) => {
    var cache = new Map();
    return {
      get: function(key) {
        if (!cache.has(key)) return undefined;
        var value = cache.get(key);
        cache.delete(key);
        cache.set(key, value);
        return value;
      },
      set: function(key, value) {
        if (cache.has(key)) cache.delete(key);
        else if (cache.size >= maxSize) {
          var firstKey = cache.keys().next().value;
          cache.delete(firstKey);
        }
        cache.set(key, value);
      },
      clear: function() { cache.clear(); },
      has: function(key) { return cache.has(key); },
      get size() { return cache.size; }
    };
  },

  // ============================================================
  // 2) 函数记忆化
  // ============================================================

  /**
   * 创建带缓存的函数（memoize）
   * @param {Function} fn - 要缓存的原函数
   * @param {Function} [keyFn] - 自定义 key 生成函数，默认使用 JSON.stringify(args)
   * @param {number} [ttl=0] - 缓存过期时间(ms)，0 表示永不过期
   * @returns {Function} 带缓存的函数
   */
  memoize: (fn, keyFn, ttl) => {
    var cache = new Map();
    if (!keyFn) {
      keyFn = function(args) {
        try { return JSON.stringify(args); } catch(e) { return String(args[0]); }
      };
    }
    return function() {
      var key = keyFn(arguments);
      if (cache.has(key)) {
        var entry = cache.get(key);
        if (!ttl || Date.now() - entry.time < ttl) {
          return entry.value;
        }
        cache.delete(key);
      }
      var value = fn.apply(this, arguments);
      cache.set(key, { value: value, time: Date.now() });
      return value;
    };
  },

  /**
   * 创建带 LRU 缓存的记忆化函数
   * 与 memoize 区别：带容量上限，长期运行避免内存无限增长
   * @param {Function} fn - 要缓存的原函数
   * @param {number} [maxSize=500] - LRU 最大条目数
   * @param {Function} [keyFn] - 自定义 key 生成函数，默认 JSON.stringify(args)
   * @returns {Function} 带 LRU 缓存的函数
   */
  memoizeLRU: (fn, maxSize, keyFn) => {
    var cache = CommonCache.createLRU(maxSize || 500);
    if (!keyFn) {
      keyFn = function(args) {
        try { return JSON.stringify(args); } catch(e) { return String(args[0]); }
      };
    }
    return function() {
      var key = keyFn(arguments);
      var cached = cache.get(key);
      if (cached !== undefined) return cached;
      var value = fn.apply(this, arguments);
      cache.set(key, value);
      return value;
    };
  },

  // ============================================================
  // 3) 高频事件节流 / 防抖
  // ============================================================

  /**
   * 节流函数（优化高频事件）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 节流延迟(ms)
   * @returns {Function} 节流后的函数
   */
  throttle: (fn, delay) => {
    var timer = null;
    return function() {
      var args = arguments;
      var context = this;
      if (!timer) {
        timer = setTimeout(function() {
          fn.apply(context, args);
          timer = null;
        }, delay);
      }
    };
  },

  /**
   * 防抖函数（优化高频点击）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 防抖延迟(ms)
   * @returns {Function} 防抖后的函数
   */
  debounce: (fn, delay) => {
    var timer = null;
    return function() {
      var args = arguments;
      var context = this;
      clearTimeout(timer);
      timer = setTimeout(function() { fn.apply(context, args); }, delay);
    };
  },

  /**
   * 防反弹的延迟单次执行器
   * 适用场景：底部导航栏重复点击展开/收起快捷导航栏
   *   - 需要 setTimeout 50ms 延迟避开 handleClickOutside 立即收起
   *   - 但期间用户可能点 nav-tab / navToggle 关闭 quickNav
   *   - 如果不取消，setTimeout 触发后会"反弹"展开
   * 解决：
   *   - 每次 trigger() 自动 clearTimeout 上一次的 pending
   *   - 外部可主动 cancel() 提前取消
   * 与 debounce 的区别：
   *   - debounce：高频触发合并为最后一次执行（合并型）
   *   - delayedToggle：只保留最新一次待执行（替代型 + 可外部取消）
   *
   * @param {Function} fn - 延迟到期执行的函数
   * @param {number} [delay=50] - 延迟毫秒数
   * @returns {{ trigger: Function, cancel: Function, isPending: Function }}
   *   - trigger(): 排队执行 fn（自动取消上一次的 pending）
   *   - cancel(): 主动取消当前 pending
   *   - isPending(): 当前是否有 pending 任务
   *
   * 用法：
   *   var h = CommonCache.delayedToggle(function() { toggleQuickNav(); }, 50);
   *   h.trigger();  // 排队 50ms 后切换
   *   h.cancel();   // 主动取消
   */
  delayedToggle: (fn, delay) => {
    var d = delay || 50;
    var timer = null;
    var handle = {
      trigger: function() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() {
          timer = null;
          fn();
        }, d);
      },
      cancel: function() {
        if (timer) {
          clearTimeout(timer);
          timer = null;
        }
      },
      isPending: function() {
        return timer !== null;
      }
    };
    return handle;
  },

  // ============================================================
  // 4) 定时器管理（防止内存泄漏）
  // ============================================================

  /**
   * 统一定时器管理器
   * 按名称管理 setTimeout / setInterval，页面卸载时可统一清除
   *
   * @namespace TimerManager
   *
   * 用法：
   *   CommonCache.TimerManager.setInterval('countdown', function() { ... }, 1000);
   *   CommonCache.TimerManager.clearInterval('countdown');
   *   // 页面卸载时
   *   CommonCache.TimerManager.clearAll();
   */
  TimerManager: {
    _timers: new Map(),
    _intervals: new Map(),

    /**
     * 设置定时器（自动管理生命周期）
     * @param {string} name - 定时器名称
     * @param {Function} fn - 回调函数
     * @param {number} delay - 延迟时间(ms)
     * @returns {number} 定时器ID
     */
    setTimeout: function(name, fn, delay) {
      this.clearTimeout(name);
      var self = this;
      var timer = setTimeout(function() {
        self._timers.delete(name);
        fn();
      }, delay);
      this._timers.set(name, timer);
      return timer;
    },

    /**
     * 清除指定定时器
     * @param {string} name - 定时器名称
     */
    clearTimeout: function(name) {
      if (this._timers.has(name)) {
        clearTimeout(this._timers.get(name));
        this._timers.delete(name);
      }
    },

    /**
     * 设置间隔定时器（自动管理生命周期）
     * @param {string} name - 定时器名称
     * @param {Function} fn - 回调函数
     * @param {number} interval - 间隔时间(ms)
     * @returns {number} 定时器ID
     */
    setInterval: function(name, fn, interval) {
      this.clearInterval(name);
      var timer = setInterval(fn, interval);
      this._intervals.set(name, timer);
      return timer;
    },

    /**
     * 清除指定间隔定时器
     * @param {string} name - 定时器名称
     */
    clearInterval: function(name) {
      if (this._intervals.has(name)) {
        clearInterval(this._intervals.get(name));
        this._intervals.delete(name);
      }
    },

    /**
     * 清除所有定时器（页面卸载时调用）
     */
    clearAll: function() {
      this._timers.forEach(function(timer) { clearTimeout(timer); });
      this._intervals.forEach(function(timer) { clearInterval(timer); });
      this._timers.clear();
      this._intervals.clear();
    },

    /**
     * 获取当前活跃定时器数量（调试用）
     * @returns {{ timeouts: number, intervals: number }}
     */
    getStats: function() {
      return {
        timeouts: this._timers.size,
        intervals: this._intervals.size
      };
    }
  }
};
