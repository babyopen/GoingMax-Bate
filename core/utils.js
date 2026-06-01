const Utils = {
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
     * 从历史数据项中提取特码完整信息
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

      const codeArr = (item.openCode || '0,0,0,0,0,0,0').split(',');
      const zodArrRaw = (item.zodiac || ',,,,,,,,,,,,').split(',');
      const zodArr = zodArrRaw.map(z => CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[z] || z);
      const te = Math.max(0, Number(codeArr[6]));

      const colorName = Object.keys(CONFIG.COLOR_MAP).find(c =>
        CONFIG.COLOR_MAP[c].includes(te)
      ) || '红';

      const wuxing = Object.keys(CONFIG.ELEMENT_MAP).find(e =>
        CONFIG.ELEMENT_MAP[e].includes(te)
      ) || '金';

      return {
        te,
        tail: te % 10,
        head: Math.floor(te / 10),
        wave: ['red', 'blue', 'green'][['红', '蓝', '绿'].indexOf(colorName)] || 'red',
        colorName,
        zod: zodArr[6] || '-',
        odd: te % 2 === 1,
        big: te >= 25,
        wuxing,
        animal: CONFIG.ANALYSIS.HOME_ZODIAC.indexOf(zodArr[6]) !== -1 ? '家禽' : '野兽',
        fullZodArr: zodArr
      };
    },

    /**
     * 批量提取特码信息（用于列表处理）
     * @param {Array} items - 历史数据数组
     * @returns {Array} 特码信息数组
     */
    batchGetSpecial: (items) => {
      if (!Array.isArray(items)) return [];
      return items.map(item => Utils.SpecialCalculator.getSpecial(item));
    }
  }
};
