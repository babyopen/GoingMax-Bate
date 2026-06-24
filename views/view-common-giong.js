/**
 * 视图层 - Giong 综合分析通用渲染工具（2026-06-24 新增）
 *
 * 职责：抽取 4 个 giong 子标签页（大小 / 单双 / 五行 / 波色）中的重复渲染逻辑：
 *   - 二分类大面板渲染（renderLatestBinaryStats）
 *   - 多分类大面板渲染（renderLatestMultiStats）
 *   - 回测追踪弹窗（showAnalysisBacktestModal）
 *   - 综合分析小面板（renderCombinedAnalysisContent）— 与 view-common.js 互补
 *
 * 拆分记录：
 *   - 2026-06-24 从 views/zodiac/view-zodiac-giong-{size,oddeven,wuxing,color}.js
 *     4 个文件中抽取 4 组重复函数（共 12 个）→ 4 个通用方法。
 *   - 原文件保留，每个文件中的具体方法改为 wrapper 调用通用函数。
 *
 * 设计要点：
 *   - 所有差异点通过 config 传入（字段名 / CSS class / 分类数组 / 颜色配置 / 弹窗 ID）
 *   - 调用 ViewCommon.showBacktestModal 显示回测弹窗
 *   - 调用 ViewCommon.renderCombinedAnalysisContent 显示综合分析小面板
 *   - 不写死 DOM 元素
 *
 * 依赖方向：被 views/zodiac/view-zodiac-giong-{size,oddeven,wuxing,color}.js 调用
 * 依赖底层：ViewCommon.showBacktestModal（views/view-common.js）
 */
const ViewCommonGiong = {

  // ============================================================
  // 1) 二分类大面板：最近 N 期 大小 / 单双 分析
  //    替代 ViewZodiacGiongSize.renderLatestSizeStats
  //         ViewZodiacGiongOddEven.renderLatestOddEvenStats
  // ============================================================

  /**
   * 渲染二分类最近 N 期大面板（大小 / 单双 通用）
   *
   * @param {Object} data - 业务层返回的数据（getLatestBinaryStats 返回值）
   * @param {Object} config
   * @param {string} config.containerId      - 容器元素 ID
   * @param {string} config.classPrefix      - CSS class 前缀（'size' / 'oddeven'）
   * @param {string} config.title            - 标题（'大小分析' / '单双分析'）
   * @param {string} config.dataKey          - 序列字段名（'size' / 'type'）
   * @param {string} config.labelA           - 类别 A 标签（'大' / '单'）
   * @param {string} config.labelB           - 类别 B 标签（'小' / '双'）
   * @param {string} config.cssClassA        - 序列项 class A（'size-big' / 'type-odd'）
   * @param {string} config.cssClassB        - 序列项 class B
   * @param {string} config.statClassA       - 统计项 class A
   * @param {string} config.statClassB       - 统计项 class B
   * @param {string} config.statLabelA       - 统计标签 A（'大 (25-49)' / '单 (奇数)'）
   * @param {string} config.statLabelB       - 统计标签 B
   * @param {string} config.patternStreakClass - 规律"连出"标签 class
   * @param {string} config.patternAltClass  - 规律"交替"标签 class
   * @param {string} config.trendAction      - 点击趋势区触发的 data-action
   * @param {string} config.trendClassA      - 趋势结果 class A
   * @param {string} config.trendClassB      - 趋势结果 class B
   * @param {string} config.countKeyA        - 计数键 A（'bigCount' / 'oddCount'）
   * @param {string} config.countKeyB        - 计数键 B
   * @param {string} config.percentKeyA      - 百分比键 A
   * @param {string} config.percentKeyB      - 百分比键 B
   */
  renderLatestBinaryStats: function(data, config) {
    var container = document.getElementById(config.containerId);
    if (!container) return;

    if (!data) {
      container.innerHTML = '';
      return;
    }

    var p = config.classPrefix;
    var html = '';
    html += '<div class="' + p + '-analysis-card">';
    html += '<div class="' + p + '-analysis-header">';
    html += '<div class="' + p + '-analysis-title">最近' + data.period + '期' + config.title + '</div>';
    html += '</div>';

    html += '<div class="' + p + '-analysis-content">';

    // 序列行
    html += '<div class="' + p + '-sequence-row">';
    var reversedSequence = data.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var itemClass = item[config.dataKey] === config.labelA ? config.cssClassA : config.cssClassB;
      html += '<span class="' + p + '-seq-item ' + itemClass + '">' + item[config.dataKey] + '</span>';
    });
    html += '</div>';

    // 统计 grid
    html += '<div class="' + p + '-stats-grid">';
    html += '<div class="' + p + '-stat-item ' + config.statClassA + '">';
    html += '<div class="' + p + '-stat-label">' + config.statLabelA + '</div>';
    html += '<div class="' + p + '-stat-value">' + data[config.countKeyA] + '期</div>';
    html += '<div class="' + p + '-stat-percent">' + data[config.percentKeyA] + '%</div>';
    html += '</div>';
    html += '<div class="' + p + '-stat-item ' + config.statClassB + '">';
    html += '<div class="' + p + '-stat-label">' + config.statLabelB + '</div>';
    html += '<div class="' + p + '-stat-value">' + data[config.countKeyB] + '期</div>';
    html += '<div class="' + p + '-stat-percent">' + data[config.percentKeyB] + '%</div>';
    html += '</div>';
    html += '</div>';

    // 规律特征
    if (data.patterns && data.patterns.length > 0) {
      html += '<div class="' + p + '-patterns-section">';
      html += '<div class="' + p + '-patterns-title">规律特征</div>';
      html += '<div class="' + p + '-patterns-list">';
      data.patterns.forEach(function(pattern) {
        var patternClass = pattern.type.indexOf('连') !== -1 ? config.patternStreakClass : config.patternAltClass;
        html += '<div class="' + p + '-pattern-tag ' + patternClass + '">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    // 趋势预测
    if (data.trend && data.trend.prediction !== '-') {
      var trendClass = data.trend.prediction === config.labelA ? config.trendClassA : config.trendClassB;
      html += '<div class="' + p + '-trend-section" data-action="' + config.trendAction + '" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="' + p + '-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="' + p + '-trend-prediction">';
      html += '<span class="trend-result ' + trendClass + '">' + data.trend.prediction + '</span>';
      html += '<span class="trend-confidence">' + data.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (data.trend.reason) {
        html += '<div class="' + p + '-trend-reason">' + data.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';   // analysis-content
    html += '</div>';   // analysis-card

    container.innerHTML = html;
  },

  // ============================================================
  // 2) 多分类大面板：最近 N 期 五行 / 波色 分析
  //    替代 ViewZodiacGiongWuxing.renderLatestWuxingStats
  //         ViewZodiacGiongColor.renderLatestColorStats
  // ============================================================

  /**
   * 渲染多分类最近 N 期大面板（五行 / 波色 通用）
   *
   * @param {Object} data - 业务层返回的数据（getLatestMultiStats 返回值）
   * @param {Object} config
   * @param {string} config.containerId   - 容器元素 ID
   * @param {string} config.classPrefix   - CSS class 前缀（'wuxing' / 'color'）
   * @param {string} config.title         - 标题（'五行分析' / '波色分析'）
   * @param {string} config.dataKey       - 序列字段名（'wuxing' / 'color'）
   * @param {string[]} config.categories  - 分类数组
   * @param {Object} config.colors        - 颜色配置 { '金': { bg, text, light }, ... }
   * @param {string} config.trendAction   - 点击趋势区触发的 data-action
   * @param {string} [config.fallbackColor] - 颜色缺失时的兜底色
   */
  renderLatestMultiStats: function(data, config) {
    var container = document.getElementById(config.containerId);
    if (!container) return;

    if (!data) {
      container.innerHTML = '';
      return;
    }

    var p = config.classPrefix;
    var fallback = config.fallbackColor || config.colors[config.categories[0]];

    var html = '';
    html += '<div class="' + p + '-analysis-card">';
    html += '<div class="' + p + '-analysis-header">';
    html += '<div class="' + p + '-analysis-title">最近' + data.period + '期' + config.title + '</div>';
    html += '</div>';

    html += '<div class="' + p + '-analysis-content">';

    // 序列行
    html += '<div class="' + p + '-sequence-row">';
    var reversedSequence = data.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var itemColor = config.colors[item[config.dataKey]] || fallback;
      html += '<span class="' + p + '-seq-item" style="background:' + itemColor.bg + ';color:#fff;">' + item[config.dataKey] + '</span>';
    });
    html += '</div>';

    // 统计 grid
    html += '<div class="' + p + '-stats-grid">';
    config.categories.forEach(function(cat) {
      var count = data.count[cat] || 0;
      var percent = data.period > 0 ? Math.round((count / data.period) * 100) : 0;
      var catColor = config.colors[cat];
      html += '<div class="' + p + '-stat-item">';
      html += '<div class="' + p + '-stat-header" style="color:' + catColor.text + ';border-left:3px solid ' + catColor.text + ';">';
      html += '<span class="' + p + '-stat-name">' + cat + '</span>';
      html += '<span class="' + p + '-stat-count">' + count + '期</span>';
      html += '</div>';
      html += '<div class="' + p + '-stat-bar-bg">';
      html += '<div class="' + p + '-stat-bar-fill" style="width:' + percent + '%;background:' + catColor.bg + ';"></div>';
      html += '</div>';
      html += '<div class="' + p + '-stat-percent" style="color:' + catColor.text + ';">' + percent + '%</div>';
      html += '</div>';
    });
    html += '</div>';

    // 规律特征
    if (data.patterns && data.patterns.length > 0) {
      html += '<div class="' + p + '-patterns-section">';
      html += '<div class="' + p + '-patterns-title">规律特征</div>';
      html += '<div class="' + p + '-patterns-list">';
      data.patterns.forEach(function(pattern) {
        var patternCat = pattern.type.charAt(0);
        var patternColor = config.colors[patternCat] || { bg: '#666' };
        html += '<div class="' + p + '-pattern-tag" style="background:' + patternColor.bg + ';">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    // 趋势预测
    if (data.trend && data.trend.prediction !== '-') {
      var predCat = data.trend.prediction;
      var predColor = config.colors[predCat] || fallback;
      html += '<div class="' + p + '-trend-section" data-action="' + config.trendAction + '" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="' + p + '-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="' + p + '-trend-prediction">';
      html += '<span class="trend-result" style="background:' + predColor.bg + ';font-size:18px;font-weight:700;padding:4px 16px;border-radius:6px;color:#fff;">' + predCat + '</span>';
      html += '<span class="trend-confidence">' + data.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (data.trend.reason) {
        html += '<div class="' + p + '-trend-reason">' + data.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';   // analysis-content
    html += '</div>';   // analysis-card

    container.innerHTML = html;
  },

  // ============================================================
  // 3) 回测追踪弹窗
  //    替代 ViewZodiacGiongSize.showSizeBacktestModal
  //         ViewZodiacGiongOddEven.showOddEvenBacktestModal
  //         ViewZodiacGiongWuxing.showWuxingBacktestModal
  //         ViewZodiacGiongColor.showColorBacktestModal
  // ============================================================

  /**
   * 通用回测追踪弹窗（大小 / 单双 / 五行 / 波色 通用）
   * 内部调 ViewCommon.showBacktestModal 显示
   *
   * @param {Object} backtestData - 业务层返回的回测数据
   * @param {Object} config
   * @param {string} config.modalId         - 弹窗元素 ID
   * @param {string} config.title           - 弹窗标题（含 emoji）
   * @param {string} config.closeBtnId      - 关闭按钮 ID
   * @param {string} config.highlightColor  - 主色调
   * @param {string} config.predictedKey    - 明细中预测值的字段名
   *   - 大小：'predictedSize'
   *   - 单双：'predictedType'
   *   - 五行：'predictedWuxing'
   *   - 波色：'predictedColor'
   * @param {string} config.actualKey       - 明细中实际值的字段名
   * @param {string} config.algorithmName   - 算法名称（用于 footerNote 文案）
   * @param {string} config.backtestType    - 回测类型（'大小' / '单双' / '五行' / '波色'）
   */
  showAnalysisBacktestModal: function(backtestData, config) {
    if (typeof ViewCommon === 'undefined' || !ViewCommon.showBacktestModal) return;

    ViewCommon.showBacktestModal({
      modalId: config.modalId,
      title: config.title,
      closeBtnId: config.closeBtnId,
      highlightColor: config.highlightColor,
      backtestData: backtestData,
      labels: { predicted: '预测', actual: '实际' },
      formatValue: function(item) {
        return {
          pred: item[config.predictedKey],
          actual: item[config.actualKey]
        };
      },
      footerNote: '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>' +
        '• 基于' + config.algorithmName + '回测<br>' +
        '• 数据仅供参考，不构成投资建议'
    });
  }
};
