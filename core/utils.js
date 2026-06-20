const Utils = {
  // ============================================================
  // 缓存机制（2026-06-09 性能优化）
  // ============================================================

  /**
   * 通用缓存 Map（带 TTL）
   * 用于缓存计算密集型函数的结果
   */
  _cache: new Map(),

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

  /**
   * 创建带 LRU 缓存的记忆化函数（v2.0.8 新增）
   * 与 memoize 区别：带容量上限，长期运行避免内存无限增长
   * @param {Function} fn - 要缓存的原函数
   * @param {number} [maxSize=500] - LRU 最大条目数
   * @param {Function} [keyFn] - 自定义 key 生成函数，默认 JSON.stringify(args)
   * @returns {Function} 带 LRU 缓存的函数
   */
  memoizeLRU: (fn, maxSize, keyFn) => {
    var cache = Utils.createLRU(maxSize || 500);
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

  /**
   * 节流函数（优化高频事件）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 节流延迟(ms)
   * @returns {Function} 节流后的函数
   */
  throttle: (fn, delay) => {
    let timer = null;
    return function(...args) {
      if(!timer){
        timer = setTimeout(() => {
          fn.apply(this, args);
          timer = null;
        }, delay);
      }
    }
  },

  /**
   * 防抖函数（优化高频点击）
   * @param {Function} fn - 要执行的函数
   * @param {number} delay - 防抖延迟(ms)
   * @returns {Function} 防抖后的函数
   */
  debounce: (fn, delay) => {
    let timer = null;
    return function(...args) {
      clearTimeout(timer);
      timer = setTimeout(() => fn.apply(this, args), delay);
    }
  },

  /**
   * 2026-06-13 新增：防反弹的延迟单次执行器
   * 适用场景：底部导航栏重复点击展开/收起快捷导航栏
   *   - 需要 setTimeout 50ms 延迟避开 handleClickOutside 立即收起
   *   - 但期间用户可能点 nav-tab / navToggle 关闭 quickNav
   *   - 如果不取消，setTimeout 触发后会"反弹"展开
   * 解决：
   *   - 每次 trigger() 自动 clearTimeout 上一次 pending
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
   *   const h = Utils.delayedToggle(() => toggleQuickNav(), 50);
   *   h.trigger();  // 排队 50ms 后切换
   *   h.cancel();   // 主动取消
   */
  delayedToggle: (fn, delay = 50) => {
    let timer = null;
    const handle = {
      trigger: function() {
        if (timer) clearTimeout(timer);
        timer = setTimeout(function() {
          timer = null;
          fn();
        }, delay);
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

  /**
   * 深拷贝对象
   * @param {any} obj - 要拷贝的对象
   * @returns {any} 拷贝后的对象
   */
  deepClone: (obj) => {
    try {
      if(typeof obj !== 'object' || obj === null) {
        return obj;
      }
      if(typeof structuredClone === 'function') {
        return structuredClone(obj);
      }
      return JSON.parse(JSON.stringify(obj));
    } catch(e) {
      console.error('深拷贝失败', e);
      return obj;
    }
  },

  /**
   * 标签值类型转换（解决数字/字符串匹配问题）
   * @param {string|number} value - 标签值
   * @param {string} group - 分组名
   * @returns {string|number} 转换后的值
   */
  formatTagValue: (value, group) => {
    return CONFIG.NUMBER_GROUPS.includes(group) ? Number(value) : value;
  },

  /**
   * 获取安全区顶部高度
   * @returns {number} 安全区高度(px)
   */
  getSafeTop: () => {
    return parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--safe-top')) || 0;
  },

  /**
   * 校验筛选方案格式
   * @param {any} item - 要校验的方案对象
   * @returns {boolean} 是否合法
   */
  validateFilterItem: (item) => {
    return item &&
      typeof item === 'object' &&
      typeof item.name === 'string' &&
      item.selected && typeof item.selected === 'object' &&
      Array.isArray(item.excluded);
  },

  /**
   * HTML 实体转义（防止 XSS 注入）
   * 用于将用户输入的字符串安全地插入到 innerHTML 上下文中
   * @param {any} str - 要转义的字符串
   * @returns {string} 转义后的字符串
   */
  escapeHtml: (str) => {
    if(str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * 生成不与已存在方案重名的方案名
   * - 若 baseName 不冲突，原样返回
   * - 若冲突则自动追加 " (2)"、" (3)"… 后缀
   * @param {string} baseName - 期望的方案名
   * @param {Array<{name:string}>} existingList - 已有方案列表
   * @param {number} [excludeIndex=-1] - 排除的索引（重命名时排除自身）
   * @returns {string} 不重名的方案名
   */
  ensureUniqueName: (baseName, existingList, excludeIndex = -1) => {
    const names = new Set(
      (existingList || [])
        .filter((_, i) => i !== excludeIndex)
        .map(s => s.name)
    );
    if(!names.has(baseName)) return baseName;
    let i = 2;
    let candidate = `${baseName} (${i})`;
    while(names.has(candidate)){
      i++;
      candidate = `${baseName} (${i})`;
      if(i > 999) break; // 防御性截断
    }
    return candidate;
  },

  /**
   * 计算默认方案名："方案N" 其中 N = 最大编号 + 1
   * 处理用户删除中间方案后 length+1 冲突的情况
   * @param {Array<{name:string}>} existingList - 已有方案列表
   * @param {string} [prefix='方案'] - 名前缀
   * @returns {string} 不冲突的默认方案名
   */
  nextDefaultName: (existingList, prefix = '方案') => {
    const re = new RegExp(`^${prefix}(\\d+)$`);
    let max = 0;
    (existingList || []).forEach(s => {
      const m = re.exec(s.name);
      if(m){
        const n = parseInt(m[1], 10);
        if(n > max) max = n;
      }
    });
    return `${prefix}${max + 1}`;
  },

  /**
   * 生成DocumentFragment优化DOM渲染
   * @param {Array} list - 要渲染的列表
   * @param {Function} renderItem - 单个元素渲染函数
   * @returns {DocumentFragment} 生成的文档片段
   */
  createFragment: (list, renderItem) => {
    const fragment = document.createDocumentFragment();
    list.forEach((item, index) => {
      const el = renderItem(item, index);
      if(el) fragment.appendChild(el);
    });
    return fragment;
  },

  calcMiss: (lastIdx, total, latestExpect, list) => {
    if(lastIdx === -1) return total;
    const appearItem = list[lastIdx];
    const appearExpect = Number(appearItem?.expect || 0);
    return latestExpect - appearExpect;
  },

  getRangeCategory: (te) => {
    if(te <= 9) return '1-9';
    if(te <= 19) return '10-19';
    if(te <= 29) return '20-29';
    if(te <= 39) return '30-39';
    return '40-49';
  },

  /**
   * 获取数组前N个元素
   * @param {Array} arr - 数组
   * @param {number} n - 数量
   * @returns {Array} 前N个元素
   */
  takeFirst: (arr, n) => {
    const result = [];
    for(let i = 0; i < Math.min(n, arr.length); i++) {
      result.push(arr[i]);
    }
    return result;
  },

  /**
   * 统一定时器管理器（防止内存泄漏）
   * @namespace TimerManager
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
    setTimeout: (name, fn, delay) => {
      Utils.TimerManager.clearTimeout(name);
      const timer = setTimeout(() => {
        Utils.TimerManager._timers.delete(name);
        fn();
      }, delay);
      Utils.TimerManager._timers.set(name, timer);
      return timer;
    },

    /**
     * 清除指定定时器
     * @param {string} name - 定时器名称
     */
    clearTimeout: (name) => {
      if (Utils.TimerManager._timers.has(name)) {
        clearTimeout(Utils.TimerManager._timers.get(name));
        Utils.TimerManager._timers.delete(name);
      }
    },

    /**
     * 设置间隔定时器（自动管理生命周期）
     * @param {string} name - 定时器名称
     * @param {Function} fn - 回调函数
     * @param {number} interval - 间隔时间(ms)
     * @returns {number} 定时器ID
     */
    setInterval: (name, fn, interval) => {
      Utils.TimerManager.clearInterval(name);
      const timer = setInterval(fn, interval);
      Utils.TimerManager._intervals.set(name, timer);
      return timer;
    },

    /**
     * 清除指定间隔定时器
     * @param {string} name - 定时器名称
     */
    clearInterval: (name) => {
      if (Utils.TimerManager._intervals.has(name)) {
        clearInterval(Utils.TimerManager._intervals.get(name));
        Utils.TimerManager._intervals.delete(name);
      }
    },

    /**
     * 清除所有定时器（页面卸载时调用）
     */
    clearAll: () => {
      Utils.TimerManager._timers.forEach((timer) => clearTimeout(timer));
      Utils.TimerManager._intervals.forEach((timer) => clearInterval(timer));
      Utils.TimerManager._timers.clear();
      Utils.TimerManager._intervals.clear();
    },

    /**
     * 获取当前活跃定时器数量（调试用）
     * @returns {{ timeouts: number, intervals: number }}
     */
    getStats: () => ({
      timeouts: Utils.TimerManager._timers.size,
      intervals: Utils.TimerManager._intervals.size
    })
  },

  /**
   * 数据验证工具（防止无效输入导致异常）
   * @namespace Validator
   */
  Validator: {
    /**
     * 验证历史数据数组格式
     * @param {Array} data - 历史数据数组
     * @returns {{ valid: boolean, error: string|null, data: Array }}
     */
    validateHistoryData: (data) => {
      if (!Array.isArray(data)) {
        return { valid: false, error: '历史数据必须是数组', data: [] };
      }
      if (data.length === 0) {
        return { valid: false, error: '历史数据为空', data: [] };
      }

      const validated = data.filter(item => {
        if (!item || typeof item !== 'object') return false;
        const expect = item.expect;
        const openCode = item.openCode;
        if (!expect && expect !== 0) return false;
        if (!openCode || typeof openCode !== 'string') return false;
        const codes = openCode.split(',');
        return codes.length === 7 && codes.every(c => !isNaN(Number(c)));
      });

      if (validated.length === 0) {
        return { valid: false, error: '无有效历史数据记录', data: [] };
      }

      return { valid: true, error: null, data: validated };
    },

    /**
     * 验证号码范围（1-49）
     * @param {number} num - 号码
     * @returns {{ valid: boolean, error: string|null, value: number }}
     */
    validateNumber: (num) => {
      const n = Number(num);
      if (isNaN(n)) {
        return { valid: false, error: '不是有效数字', value: 0 };
      }
      if (!Number.isInteger(n)) {
        return { valid: false, error: '必须为整数', value: n };
      }
      if (n < 1 || n > 49) {
        return { valid: false, error: '号码必须在1-49之间', value: n };
      }
      return { valid: true, error: null, value: n };
    },

    /**
     * 验证生肖名称
     * @param {string} zodiac - 生肖名
     * @returns {{ valid: boolean, error: string|null, value: string }}
     */
    validateZodiac: (zodiac) => {
      if (!zodiac || typeof zodiac !== 'string') {
        return { valid: false, error: '生肖不能为空', value: '' };
      }
      const validZodiacs = CONFIG.ANALYSIS.ZODIAC_ALL;
      if (!validZodiacs.includes(zodiac)) {
        return { valid: false, error: `无效生肖: ${zodiac}`, value: zodiac };
      }
      return { valid: true, error: null, value: zodiac };
    },

    /**
     * 验证期数参数
     * @param {number} period - 期数
     * @param {number} [min=1] - 最小值
     * @param {number} [max=500] - 最大值
     * @returns {{ valid: boolean, error: string|null, value: number }}
     */
    validatePeriod: (period, min = 1, max = 500) => {
      const p = Number(period);
      if (isNaN(p) || p < min || p > max) {
        return { valid: false, error: `期数必须在${min}-${max}之间`, value: p || min };
      }
      return { valid: true, error: null, value: p };
    },

    /**
     * 安全执行函数（带输入验证和错误处理）
     * @param {Function} fn - 要执行的函数
     * @param {*} args - 参数
     * @param {string} context - 错误上下文描述
     * @returns {{ success: boolean, result: *, error: Error|null }}
     */
    safeExecute: (fn, args, context = '未知操作') => {
      try {
        const result = fn(args);
        return { success: true, result, error: null };
      } catch(e) {
        console.error(`[${context}] 执行失败:`, e);
        return { success: false, result: null, error: e };
      }
    }
  },

  /**
   * 特码信息计算器（消除Business和ZodiacPrediction中的重复代码）
   * @namespace SpecialCalculator
   */
  SpecialCalculator: {
    /**
     * 内部缓存：使用 LRU 策略，最多缓存 500 条记录（避免内存无限增长）
     * @private
     */
    _cache: null,

    /**
     * 获取缓存实例（懒加载）
     * @private
     */
    _getCache: function() {
      if (!Utils.SpecialCalculator._cache) {
        Utils.SpecialCalculator._cache = Utils.createLRU(500);
      }
      return Utils.SpecialCalculator._cache;
    },

    /**
     * 清空 SpecialCalculator 缓存（在历史数据刷新时调用）
     */
    clearCache: function() {
      if (Utils.SpecialCalculator._cache) {
        Utils.SpecialCalculator._cache.clear();
      }
    },

    /**
     * 从历史数据项中提取特码完整信息（带缓存优化）
     * @param {Object} item - 历史数据单项
     * @returns {Object} 特码信息对象
     */
    getSpecial: (item) => {
      if (!item || typeof item !== 'object') {
        return {
          te: 0, tail: 0, head: 0,
          wave: 'red', colorName: '红', zod: '-',
          odd: false, big: false,
          wuxing: '金', animal: '野兽',
          fullZodArr: Array(12).fill('-')
        };
      }

      // 性能优化：使用 LRU 缓存，key 基于 expect + openCode
      var cacheKey = (item.expect || '') + '_' + (item.openCode || '');
      var cache = Utils.SpecialCalculator._getCache();
      var cached = cache.get(cacheKey);
      if (cached) return cached;

      const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
      const zodArr = Utils.parseZodiacArr(item);
      const te = Math.max(0, Number(codeArr[6]));

      const colorName = Utils.getColorName(te);
      const wuxing = Utils.getWuxing(te);

      const result = {
        te,
        tail: te % 10,
        head: Math.floor(te / 10),
        wave: CONFIG.COLOR_NAME_TO_EN[colorName] || 'red',
        colorName,
        zod: zodArr[6] || '-',
        odd: te % 2 === 1,
        big: te >= 25,
        wuxing,
        animal: CONFIG.ANALYSIS.HOME_ZODIAC.indexOf(zodArr[6]) !== -1 ? '家禽' : '野兽',
        fullZodArr: zodArr
      };

      cache.set(cacheKey, result);
      return result;
    },

    /**
     * 批量提取特码信息（用于列表处理，自动利用缓存）
     * @param {Array} items - 历史数据数组
     * @returns {Array} 特码信息数组
     */
    batchGetSpecial: (items) => {
      if (!Array.isArray(items)) return [];
      return items.map(item => Utils.SpecialCalculator.getSpecial(item));
    }
  },

  /**
   * 解析历史数据项的 zodiac 字段为生肖数组（8 处共用，2026-06-09 重构合并）
   * 处理繁体/简体生肖映射（CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP）
   * @param {Object} item - 历史数据单项 { zodiac: '馬,牛,虎,...' }
   * @returns {string[]} 12 个生肖字符串数组（默认 ',' 占位）
   */
  parseZodiacArr: (item) => {
    const raw = (item && item.zodiac || ',,,,,,,,,,,,').split(',');
    const map = (typeof CONFIG !== 'undefined' && CONFIG.ANALYSIS && CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP) || {};
    return raw.map(z => map[z] || z);
  },

  /**
   * 解析 openCode 字段为号码数组（兼容占位字符串）
   * @param {Object} item - 历史数据单项 { openCode: '1,2,3,4,5,6,7' }
   * @returns {number[]} 7 个号码数组（默认 0）
   */
  parseOpenCodeArr: (item) => {
    const raw = (item && item.openCode || '0,0,0,0,0,0,0').split(',');
    return raw.map(n => Number(n));
  },

  /**
   * 解析 openCode 为字符串数组（2026-06-21 通用化抽取）
   * 替代业务层重复的 `(item.openCode || '0,0,0,0,0,0,0').split(',')`
   * 与 parseOpenCodeArr 区别：本方法返回字符串数组（保留原始位值）
   * @param {Object} item - 历史数据单项 { openCode: '1,2,3,4,5,6,7' }
   * @returns {string[]} 7 个字符串数组（默认 '0'）
   */
  parseCodeArr: (item) => {
    return (item && item.openCode || '0,0,0,0,0,0,0').split(',');
  },

  /**
   * 通用剪贴板复制（兼容降级，3 处共用，2026-06-09 重构合并）
   * 1. 优先 navigator.clipboard.writeText（HTTPS / localhost）
   * 2. 降级 document.execCommand('copy') + 隐藏 textarea
   * 3. 失败回调 fallback（可传入 fn(text) 让用户手动选择）
   * @param {string} text - 要复制的文本
   * @param {Object} [opts]
   * @param {string} [opts.successMsg] - 成功 Toast 文案（默认 '已复制'）
   * @param {string} [opts.errorMsg] - 失败 Toast 文案（默认 '复制失败，请手动复制'）
   * @param {Function} [opts.fallback] - 失败回调函数（用于打开 modal 让用户手动复制）
   * @returns {Promise<boolean>} 是否成功
   */
  copyToClipboard: async (text, opts) => {
    opts = opts || {};
    const successMsg = opts.successMsg || '已复制';
    const errorMsg = opts.errorMsg || '复制失败，请手动复制';
    const fallback = opts.fallback;

    // 优先：navigator.clipboard API
    if (navigator.clipboard && navigator.clipboard.writeText) {
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
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.top = '0';
      textarea.style.left = '0';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      const ok = document.execCommand('copy');
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

  /**
   * 号码 → 颜色名 反查（8+ 处共用，2026-06-09 重构合并）
   * @param {number} num - 号码 (1-49)
   * @returns {string} '红' / '蓝' / '绿'（默认 '红'）
   */
  getColorName: (num) => {
    if (typeof CONFIG === 'undefined' || !CONFIG.COLOR_MAP) return '红';
    const color = Object.keys(CONFIG.COLOR_MAP).find(c => CONFIG.COLOR_MAP[c].includes(num));
    return color || '红';
  },

  /**
   * 号码 → 五行 反查（8+ 处共用，2026-06-09 重构合并）
   * @param {number} num - 号码 (1-49)
   * @returns {string} '金' / '木' / '水' / '火' / '土'（默认 '金'）
   */
  getWuxing: (num) => {
    if (typeof CONFIG === 'undefined' || !CONFIG.ELEMENT_MAP) return '金';
    const element = Object.keys(CONFIG.ELEMENT_MAP).find(e => CONFIG.ELEMENT_MAP[e].includes(num));
    return element || '金';
  },

  /**
   * 号码格式化：1 → '01'（全局统一，2026-06-09 新增）
   * @param {number|string} num - 号码
   * @returns {string} 两位字符串，如 '01'；异常值返回 '00'
   */
  formatNum: (num) => {
    const n = Number(num);
    // 仅接受 1-49 的有效整数号码
    if (!Number.isInteger(n) || n < 1 || n > 49) return '00';
    return String(n).padStart(2, '0');
  },

  /**
   * 按 12 生肖固定顺序拼接选中的生肖列表（2026-06-21 通用化抽取）
   * 替代业务层重复的 `CONFIG.ANALYSIS.ZODIAC_ALL.filter(z => selected.indexOf(z) !== -1).join(sep)`
   * @param {Array<string>} selected - 选中的生肖数组（顺序任意）
   * @param {string} [separator=' '] - 分隔符（默认空格）
   * @returns {string} 按固定生肖顺序拼接的字符串
   */
  formatZodiacList: (selected, separator) => {
    if (!Array.isArray(selected) || selected.length === 0) return '';
    var sep = (separator === undefined || separator === null) ? ' ' : separator;
    var zodiacOrder = (typeof CONFIG !== 'undefined' && CONFIG.ANALYSIS && CONFIG.ANALYSIS.ZODIAC_ALL) || [];
    return zodiacOrder.filter(function(z) { return selected.indexOf(z) !== -1; }).join(sep);
  },

  /**
   * 从计数对象中取 Top N 并格式化（2026-06-21 通用化抽取）
   * 替代业务层重复的 `Object.entries(obj).sort((a, b) => b[1] - a[1]).slice(0, n).map(formatter).join(sep)`
   * @param {Object} obj - 计数对象，如 {红:5, 蓝:3}
   * @param {number} n - 取前 N 项
   * @param {Function} [formatter] - 格式化函数，默认 `e => e[0]`（返回 key）
   * @param {string} [separator=''] - 拼接分隔符（默认无）
   * @returns {string} 格式化后的字符串
   */
  getTopN: (obj, n, formatter, separator) => {
    if (!obj || typeof obj !== 'object') return '';
    var fmt = (typeof formatter === 'function') ? formatter : function(e) { return e[0]; };
    var sep = (separator === undefined || separator === null) ? '' : separator;
    var n2 = Number(n) || 0;
    return Object.keys(obj)
      .map(function(k) { return [k, obj[k]]; })
      .sort(function(a, b) { return b[1] - a[1]; })
      .slice(0, n2)
      .map(fmt)
      .join(sep);
  },

  // ============================================================
  // 通用工具（兼容路径：消除 view-filter / state / event 中的重复代码）
  // ============================================================

  /**
   * 批量输入分隔符正则常量
   * 支持中英文逗号、空格、换行、点、斜杠、反斜杠、连号、分号、多种引号、方括号、中日文方括号
   */
  SPLIT_TOKEN_REGEX: /[,，\s\n.。\/／\\\-、；;'""''\[\]【】]+/,

  /**
   * 号码范围检查（1-49，符合本项目彩种规则）
   * @param {number} n - 待检查的号码
   * @returns {boolean}
   */
  isValidLotteryNum: (n) => {
    return typeof n === 'number' && !isNaN(n) && n >= 1 && n <= 49;
  },

  /**
   * 合并多个数组并去重（保持首次出现顺序）
   * @param {...Array} arrays - 要合并的多个数组
   * @returns {Array} 去重后的新数组
   */
  mergeUnique: (...arrays) => {
    const seen = new Set();
    const result = [];
    arrays.forEach(arr => {
      if (!Array.isArray(arr)) return;
      arr.forEach(item => {
        if (item == null) return;
        const key = typeof item === 'object' ? item : String(item);
        if (!seen.has(key)) { seen.add(key); result.push(item); }
      });
    });
    return result;
  },

  /**
   * 多分组字符串分割（兼容 "a,b,c" 格式与单值）
   * @param {string} str - data-group 值（可能含逗号）
   * @returns {string[]} 分组数组
   */
  splitGroups: (str) => {
    if (!str) return [];
    return String(str).split(',').map(s => s.trim()).filter(Boolean);
  },

  /**
   * 获取指定分组下所有标签的值（消除 querySelectorAll + formatTagValue 重复 6+ 次）
   * @param {string} group - 分组名
   * @returns {Array} 标签值数组
   */
  getTagValues: (group) => {
    const tags = document.querySelectorAll(`.tag[data-group="${group}"]`);
    return [...tags].map(tag => Utils.formatTagValue(tag.dataset.value, group));
  }
};
