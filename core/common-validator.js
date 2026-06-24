/**
 * 核心层 - 通用数据验证工具（2026-06-24 新增）
 *
 * 职责：将 core/utils.js 中"数据验证 / 安全执行"相关的工具抽取为独立模块
 *
 * 抽取自：
 *   - core/utils.js:218-224  validateFilterItem
 *   - core/utils.js:417-514  Validator 命名空间（6 个方法）
 *
 * 设计要点：
 *   - 纯函数，零项目特定依赖，可跨项目直接复用
 *   - 所有返回值遵循统一格式：{ valid: boolean, error: string|null, value: any }
 *   - 项目特定的"生肖验证"等已参数化，支持跨项目注入
 *
 * 依赖方向：被 business/* / event.js / data/* 等任何模块调用
 * 跨项目复用：直接复制此文件即可，零依赖
 */
const CommonValidator = {

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

  // ============================================================
  // Validator 命名空间（统一返回格式）
  // ============================================================

  Validator: {
    /**
     * 验证历史数据数组格式
     * 跨项目使用：可自定义 validator 函数验证每条记录
     * @param {Array} data - 历史数据数组
     * @param {Function} [itemValidator] - 自定义单条记录验证函数（可选）
     *   函数签名：item => boolean
     *   默认验证：item.expect && item.openCode（7 位数字逗号分隔）
     * @returns {{ valid: boolean, error: string|null, data: Array }}
     */
    validateHistoryData: (data, itemValidator) => {
      if (!Array.isArray(data)) {
        return { valid: false, error: '历史数据必须是数组', data: [] };
      }
      if (data.length === 0) {
        return { valid: false, error: '历史数据为空', data: [] };
      }

      // 默认验证：彩票格式
      var defaultValidator = function(item) {
        if (!item || typeof item !== 'object') return false;
        var expect = item.expect;
        var openCode = item.openCode;
        if (!expect && expect !== 0) return false;
        if (!openCode || typeof openCode !== 'string') return false;
        var codes = openCode.split(',');
        return codes.length === 7 && codes.every(function(c) { return !isNaN(Number(c)); });
      };

      var validator = itemValidator || defaultValidator;
      var validated = data.filter(validator);

      if (validated.length === 0) {
        return { valid: false, error: '无有效历史数据记录', data: [] };
      }

      return { valid: true, error: null, data: validated };
    },

    /**
     * 验证号码范围
     * @param {number} num - 号码
     * @param {Object} [opts] - 配置
     * @param {number} [opts.min=1] - 最小值
     * @param {number} [opts.max=49] - 最大值
     * @returns {{ valid: boolean, error: string|null, value: number }}
     */
    validateNumber: (num, opts) => {
      opts = opts || {};
      var min = (typeof opts.min === 'number') ? opts.min : 1;
      var max = (typeof opts.max === 'number') ? opts.max : 49;
      var n = Number(num);
      if (isNaN(n)) {
        return { valid: false, error: '不是有效数字', value: 0 };
      }
      if (!Number.isInteger(n)) {
        return { valid: false, error: '必须为整数', value: n };
      }
      if (n < min || n > max) {
        return { valid: false, error: '号码必须在' + min + '-' + max + '之间', value: n };
      }
      return { valid: true, error: null, value: n };
    },

    /**
     * 验证枚举值（如生肖 / 状态 / 类型）
     * @param {string} value - 要验证的值
     * @param {Array<string>} validList - 合法值列表
     * @param {string} [fieldName='字段'] - 字段名（错误提示用）
     * @returns {{ valid: boolean, error: string|null, value: string }}
     */
    validateEnum: (value, validList, fieldName) => {
      var fname = fieldName || '字段';
      if (!value || typeof value !== 'string') {
        return { valid: false, error: fname + '不能为空', value: '' };
      }
      if (!Array.isArray(validList) || validList.length === 0) {
        return { valid: false, error: '合法值列表为空', value: value };
      }
      if (!validList.includes(value)) {
        return { valid: false, error: '无效' + fname + ': ' + value, value: value };
      }
      return { valid: true, error: null, value: value };
    },

    /**
     * 验证期数参数（正整数 + 范围）
     * @param {number} period - 期数
     * @param {number} [min=1] - 最小值
     * @param {number} [max=500] - 最大值
     * @returns {{ valid: boolean, error: string|null, value: number }}
     */
    validatePeriod: (period, min, max) => {
      var minVal = (typeof min === 'number') ? min : 1;
      var maxVal = (typeof max === 'number') ? max : 500;
      var p = Number(period);
      if (isNaN(p) || p < minVal || p > maxVal) {
        return { valid: false, error: '期数必须在' + minVal + '-' + maxVal + '之间', value: p || minVal };
      }
      return { valid: true, error: null, value: p };
    },

    /**
     * 安全执行函数（带错误处理，不抛异常）
     * @param {Function} fn - 要执行的函数
     * @param {*} args - 参数
     * @param {string} [context='未知操作'] - 错误上下文描述
     * @returns {{ success: boolean, result: *, error: Error|null }}
     */
    safeExecute: (fn, args, context) => {
      var ctx = context || '未知操作';
      try {
        var result = fn(args);
        return { success: true, result: result, error: null };
      } catch(e) {
        console.error('[' + ctx + '] 执行失败:', e);
        return { success: false, result: null, error: e };
      }
    },

    /**
     * 验证字符串非空
     * @param {string} str - 字符串
     * @param {string} [fieldName='字段'] - 字段名（错误提示用）
     * @returns {{ valid: boolean, error: string|null, value: string }}
     */
    validateRequired: (str, fieldName) => {
      var fname = fieldName || '字段';
      if (str === null || str === undefined || str === '') {
        return { valid: false, error: fname + '不能为空', value: '' };
      }
      return { valid: true, error: null, value: String(str) };
    },

    /**
     * 验证正数
     * @param {number} value - 数值
     * @returns {{ valid: boolean, error: string|null, value: number }}
     */
    validatePositive: (value) => {
      var n = Number(value);
      if (isNaN(n)) {
        return { valid: false, error: '不是有效数字', value: 0 };
      }
      if (n <= 0) {
        return { valid: false, error: '必须为正数', value: n };
      }
      return { valid: true, error: null, value: n };
    },

    /**
     * 验证数组非空
     * @param {Array} arr - 数组
     * @param {string} [fieldName='列表'] - 字段名（错误提示用）
     * @returns {{ valid: boolean, error: string|null, value: Array }}
     */
    validateArray: (arr, fieldName) => {
      var fname = fieldName || '列表';
      if (!Array.isArray(arr)) {
        return { valid: false, error: fname + '必须是数组', value: [] };
      }
      if (arr.length === 0) {
        return { valid: false, error: fname + '不能为空', value: [] };
      }
      return { valid: true, error: null, value: arr };
    }
  }
};