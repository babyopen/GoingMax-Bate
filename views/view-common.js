/**
 * 视图层：通用渲染工具（2026-06-08 重构提取）
 * 职责：抽取多个视图层文件中重复的 tab 切换/面板切换逻辑
 * 依赖方向：被各 view-*.js 调用
 * 红线：只做 DOM 操作、不做业务计算、不绑定事件
 */
const ViewCommon = {

  /**
   * 区域名 → CSS class 映射表（4 处共用，2026-06-09 重构合并）
   */
  ZONE_CLASS_MAP: Object.freeze({
    '封顶区': 'zone-peak',
    '降权区': 'zone-high',
    '过热区': 'zone-ovht',
    '热号区': 'zone-mid',
    '活跃区': 'zone-active',
    '穿插区': 'zone-low',
    '冷号区': 'zone-wait'
  }),

  /**
   * 获取区域对应的 CSS class
   * @param {string} zone - 区域名（如 '封顶区'）
   * @param {string} [fallback='zone-wait'] - 未匹配时的兜底 class
   * @returns {string}
   */
  getZoneClass: function(zone, fallback) {
    return ViewCommon.ZONE_CLASS_MAP[zone] || fallback || 'zone-wait';
  },

  /**
   * 命中率 → CSS class 映射（3 处共用，2026-06-09 重构合并）
   * @param {number} rate - 命中率（0-100）
   * @param {number} [high=70] - 高分阈值
   * @param {number} [mid=40] - 中分阈值
   * @returns {string} 'backtest-rate-high' / 'backtest-rate-mid' / 'backtest-rate-low'
   */
  getRateClass: function(rate, high, mid) {
    if (high === undefined) high = 70;
    if (mid === undefined) mid = 40;
    if (rate >= high) return 'backtest-rate-high';
    if (rate >= mid) return 'backtest-rate-mid';
    return 'backtest-rate-low';
  },

  /**
   * 通用 tab 切换（仅 DOM 操作）
   * @param {Object} config
   * @param {string} config.tabSelector - tab 按钮的选择器（如 '.analysis-tab-btn'）
   * @param {string} config.tabDataAttr - tab 按钮的 data 属性名驼峰形式（如 'analysisTab'）
   * @param {Object} config.panelMap - tab 名 → 面板 ID 映射（如 {history:'historyPanel'}）
   * @param {string} [config.navBtnSelector] - 快捷导航里同源子 tab 的选择器（可选）
   * @param {string} tab - 要切换的 tab 名
   */
  switchTabUI: function(config, tab) {
    var panelMap = config.panelMap || {};
    var tabs = Object.keys(panelMap);
    // 非法值兜底：使用第一个合法 tab
    if (tabs.indexOf(tab) < 0) tab = tabs[0];

    // 顶部 tab 按钮
    if (config.tabSelector && config.tabDataAttr) {
      document.querySelectorAll(config.tabSelector).forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset[config.tabDataAttr] === tab);
      });
    }

    // 快捷导航里同源子 tab 按钮（如有）
    if (config.navBtnSelector) {
      document.querySelectorAll(config.navBtnSelector).forEach(function(btn) {
        btn.classList.toggle('active', btn.dataset.tabName === tab);
      });
    }

    // 面板切换（通过 ID 精确控制）
    var targetPanelId = panelMap[tab];
    Object.keys(panelMap).forEach(function(key) {
      var panel = document.getElementById(panelMap[key]);
      if (panel) panel.classList.toggle('active', key === tab);
    });
  }
};