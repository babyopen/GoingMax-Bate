/**
 * 核心层 - 通用字符串与格式化工具（2026-06-24 新增）
 *
 * 职责：将 core/utils.js 中"字符串转义 / 格式化 / 名称生成"相关的工具抽取为独立模块
 *
 * 抽取自：
 *   - core/utils.js:232-240  escapeHtml
 *   - core/utils.js:251-266  ensureUniqueName
 *   - core/utils.js:275-286  nextDefaultName
 *   - core/utils.js:723-728  formatNum
 *
 * 设计要点：
 *   - 纯函数，零项目特定依赖，可跨项目直接复用
 *   - formatNum 已参数化 min/max，默认 1-49
 *   - HTML 转义防 XSS，跨项目安全可用
 *
 * 依赖方向：被 business/* / views/* / event.js 等任何模块调用
 * 跨项目复用：直接复制此文件即可，零依赖
 */
const CommonString = {

  // ============================================================
  // 1) HTML 转义（防 XSS）
  // ============================================================

  /**
   * HTML 实体转义（防止 XSS 注入）
   * 用于将用户输入的字符串安全地插入到 innerHTML 上下文中
   * @param {any} str - 要转义的字符串
   * @returns {string} 转义后的字符串
   */
  escapeHtml: (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * HTML 属性转义（更严格，禁用引号）
   * @param {any} str - 要转义的字符串
   * @returns {string} 转义后的字符串
   */
  escapeAttr: (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  },

  /**
   * 反向转义 HTML 实体（用于显示原始用户输入）
   * @param {string} str - 已转义的字符串
   * @returns {string} 原始字符串
   */
  unescapeHtml: (str) => {
    if (str === null || str === undefined) return '';
    return String(str)
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
  },

  // ============================================================
  // 2) 数字格式化
  // ============================================================

  /**
   * 号码格式化：1 → '01'（两位字符串）
   * @param {number|string} num - 号码
   * @param {Object} [opts] - 配置
   * @param {number} [opts.min=1] - 最小值（不在范围内返回 '00'）
   * @param {number} [opts.max=49] - 最大值
   * @param {number} [opts.width=2] - 目标位数
   * @returns {string} 格式化后字符串
   */
  formatNum: (num, opts) => {
    opts = opts || {};
    var min = (typeof opts.min === 'number') ? opts.min : 1;
    var max = (typeof opts.max === 'number') ? opts.max : 49;
    var width = (typeof opts.width === 'number') ? opts.width : 2;
    var n = Number(num);
    if (!Number.isInteger(n) || n < min || n > max) return '00';
    return String(n).padStart(width, '0');
  },

  /**
   * 补零到指定位数
   * @param {number|string} num - 数字
   * @param {number} [width=2] - 目标位数
   * @returns {string} 补零后的字符串
   */
  padZero: (num, width) => {
    var w = (typeof width === 'number') ? width : 2;
    return String(num).padStart(w, '0');
  },

  /**
   * 千分位格式化（1000 → '1,000'）
   * @param {number} num - 数字
   * @returns {string} 千分位字符串
   */
  thousands: (num) => {
    return String(num).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  },

  /**
   * 数字转中文大写金额（仅基础单位：元 / 角 / 分）
   * @param {number} num - 金额
   * @returns {string} 中文大写
   */
  toChineseMoney: (num) => {
    var digits = ['零', '壹', '贰', '叁', '肆', '伍', '陆', '柒', '捌', '玖'];
    var units = ['', '拾', '佰', '仟'];
    var bigUnits = ['', '万', '亿', '兆'];
    var fraction = ['角', '分'];

    if (typeof num !== 'number' || isNaN(num)) return '';

    var numStr = num.toFixed(2);
    var parts = numStr.split('.');
    var intPart = parts[0];
    var decPart = parts[1];

    var result = '';
    var zeroFlag = false; // 是否需要补零

    // 整数部分处理
    for (var i = 0; i < intPart.length; i++) {
      var digit = parseInt(intPart.charAt(i));
      var pos = intPart.length - i - 1;
      var bigUnitIdx = Math.floor(pos / 4);

      if (digit === 0) {
        zeroFlag = true;
      } else {
        if (zeroFlag) {
          result += '零';
          zeroFlag = false;
        }
        result += digits[digit] + units[pos % 4];
      }

      // 大单位
      if (pos % 4 === 0 && bigUnitIdx > 0) {
        result += bigUnits[bigUnitIdx];
      }
    }

    if (result === '') result = '零';

    // 小数部分
    var jiao = parseInt(decPart.charAt(0));
    var fen = parseInt(decPart.charAt(1));

    if (jiao === 0 && fen === 0) {
      result += '元整';
    } else {
      result += '元';
      if (jiao > 0) result += digits[jiao] + fraction[0];
      if (fen > 0) result += digits[fen] + fraction[1];
    }

    return result;
  },

  // ============================================================
  // 3) 名称生成（唯一性）
  // ============================================================

  /**
   * 生成不与已存在项重名的名称
   * - 若 baseName 不冲突，原样返回
   * - 若冲突则自动追加 " (2)"、" (3)"… 后缀
   * @param {string} baseName - 期望的名称
   * @param {Array<{name:string}>} existingList - 已存在项列表
   * @param {number} [excludeIndex=-1] - 排除的索引（重命名时排除自身）
   * @returns {string} 不重名的名称
   */
  ensureUniqueName: (baseName, existingList, excludeIndex) => {
    var excludeIdx = (typeof excludeIndex === 'number') ? excludeIndex : -1;
    var names = new Set(
      (existingList || [])
        .filter(function(_, i) { return i !== excludeIdx; })
        .map(function(s) { return s.name; })
    );
    if (!names.has(baseName)) return baseName;
    var i = 2;
    var candidate = baseName + ' (' + i + ')';
    while (names.has(candidate)) {
      i++;
      candidate = baseName + ' (' + i + ')';
      if (i > 999) break; // 防御性截断
    }
    return candidate;
  },

  /**
   * 计算默认名称："前缀N" 其中 N = 最大编号 + 1
   * 处理用户删除中间项后 length+1 冲突的情况
   * @param {Array<{name:string}>} existingList - 已存在项列表
   * @param {string} [prefix='方案'] - 名前缀
   * @returns {string} 不冲突的默认名称
   */
  nextDefaultName: (existingList, prefix) => {
    var p = (typeof prefix === 'string') ? prefix : '方案';
    var re = new RegExp('^' + p + '(\\d+)$');
    var max = 0;
    (existingList || []).forEach(function(s) {
      var m = re.exec(s.name);
      if (m) {
        var n = parseInt(m[1], 10);
        if (n > max) max = n;
      }
    });
    return p + (max + 1);
  },

  // ============================================================
  // 4) 字符串操作
  // ============================================================

  /**
   * 截断字符串（按字符长度，可指定省略号）
   * @param {string} str - 字符串
   * @param {number} maxLen - 最大长度
   * @param {string} [ellipsis='...'] - 省略号
   * @returns {string} 截断后的字符串
   */
  truncate: (str, maxLen, ellipsis) => {
    var e = (typeof ellipsis === 'string') ? ellipsis : '...';
    if (typeof str !== 'string') return '';
    if (str.length <= maxLen) return str;
    return str.substring(0, maxLen) + e;
  },

  /**
   * 字符串首字母大写
   * @param {string} str - 字符串
   * @returns {string} 首字母大写
   */
  capitalize: (str) => {
    if (typeof str !== 'string' || str.length === 0) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  },

  /**
   * 驼峰转中划线（camelCase → kebab-case）
   * @param {string} str - 驼峰字符串
   * @returns {string} 中划线字符串
   */
  camelToKebab: (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/([A-Z])/g, '-$1').toLowerCase();
  },

  /**
   * 中划线转驼峰（kebab-case → camelCase）
   * @param {string} str - 中划线字符串
   * @returns {string} 驼峰字符串
   */
  kebabToCamel: (str) => {
    if (typeof str !== 'string') return '';
    return str.replace(/-([a-z])/g, function(_, c) { return c.toUpperCase(); });
  }
};