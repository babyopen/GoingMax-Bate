/**
 * 视图层：通用渲染工具（2026-06-08 重构提取）
 * 职责：抽取多个视图层文件中重复的 tab 切换/面板切换逻辑
 * 依赖方向：被各 view-*.js 调用
 * 红线：只做 DOM 操作、不做业务计算、不绑定事件
 */
const ViewCommon = {

  /**
   * 区域名 → CSS class 映射表（4 处共用，2026-06-09 重构合并；2026-06-10 新增 6 期短期窗口映射）
   */
  ZONE_CLASS_MAP: Object.freeze({
    '封顶区': 'zone-peak',
    '降权区': 'zone-high',
    '过热区': 'zone-ovht',
    '热号区': 'zone-mid',
    '活跃区': 'zone-active',
    '穿插区': 'zone-low',
    '冷号区': 'zone-wait',
    // V1.1 新增：6 期短期窗口区域（与同语义区域配色一致：同区域同色）
    '短过热': 'zone-peak',   // ≥3次，极罕见 → 同「封顶区」色
    '短热号': 'zone-mid',    // 2次，短期热 → 同「热号区」色
    '短穿插': 'zone-low',    // 1次，偶尔穿插 → 同「穿插区」色
    '短冷号': 'zone-wait'    // 0次，完全冷 → 同「冷号区」色
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

  // ============================================================
  // DOM 元素缓存机制（2026-06-09 性能优化）
  // ============================================================

  /**
   * DOM 元素缓存 Map（全局共享）
   * 避免重复调用 document.getElementById，提升 DOM 查询性能
   */
  _domCache: new Map(),

  /**
   * 获取缓存的 DOM 元素（性能优化：避免重复查询）
   * @param {string} id - 元素 ID
   * @returns {HTMLElement|null}
   */
  $: function(id) {
    if (!ViewCommon._domCache.has(id)) {
      var el = document.getElementById(id);
      if (el) ViewCommon._domCache.set(id, el);
    }
    return ViewCommon._domCache.get(id) || null;
  },

  /**
   * 批量获取 DOM 元素并返回对象
   * @param {string[]} ids - 元素 ID 数组
   * @returns {Object} id → 元素 的映射对象
   */
  $batch: function(ids) {
    var result = {};
    ids.forEach(function(id) {
      result[id] = ViewCommon.$(id);
    });
    return result;
  },

  /**
   * 清除指定 ID 的 DOM 缓存
   * @param {string} [id] - 元素 ID，不传则清空所有
   */
  clearDomCache: function(id) {
    if (id) {
      ViewCommon._domCache.delete(id);
    } else {
      ViewCommon._domCache.clear();
    }
  },

  // ============================================================
  // HTML 字符串数组拼接优化（2026-06-09 性能优化）
  // ============================================================

  /**
   * 创建 HTML 数组构建器（使用数组 join 替代字符串 + 拼接，性能更好）
   * @returns {{parts: string[], push: Function, toString: Function}}
   */
  createHtmlBuilder: function() {
    var parts = [];
    return {
      parts: parts,
      push: function(str) { parts.push(str); return this; },
      toString: function() { return parts.join(''); }
    };
  },

  /**
   * 渲染生肖静态卡片 HTML（4 处共用，2026-06-09 重构提取，原 ViewZodiacPrediction._renderZodiacCardHtml）
   * @param {string} zodiac 生肖名
   * @param {number} rank 排名
   * @param {string} cardClass 卡片 class（如 card-rank-1 / card-rank-other）
   * @param {string} emoji emoji
   * @param {string} [extraHtml] 可选的额外子元素 HTML（如评分）
   * @returns {string} 卡片 HTML
   */
  renderZodiacCardHtml: function(zodiac, rank, cardClass, emoji, extraHtml) {
    var html = '<div class="zodiac-static-card ' + cardClass + '">';
    html += '<div class="zodiac-static-rank">' + rank + '</div>';
    html += '<div class="zodiac-static-emoji">' + emoji + '</div>';
    html += '<div class="zodiac-static-name">' + zodiac + '</div>';
    if (extraHtml) html += extraHtml;
    html += '</div>';
    return html;
  },

  /**
   * 切换 4 个顶级 panel（main / predict / giong / ultimate）
   * 2026-06-09 从 view-zodiac-prediction.js 提取
   */
  switchZodiacPanel: function(tab) {
    ViewCommon.switchTabUI({
      tabSelector: '.zodiac-tab-btn',
      tabDataAttr: 'zodiacTab',
      panelMap: {
        main: 'zodiacMainPanel',
        predict: 'zodiacPredictPanel',
        giong: 'zodiacGiongPanel',
        ultimate: 'zodiacUltimatePanel'
      },
      navBtnSelector: '.nav-tab[data-page="random"]'
    }, tab);
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
    Object.keys(panelMap).forEach(function(key) {
      var panel = document.getElementById(panelMap[key]);
      if (panel) panel.classList.toggle('active', key === tab);
    });
  },

  /**
   * 滑动卡片初始化（touch/mouse 通用）
   * 共用：ViewZodiacPredict.initPredSwiper / ViewZodiacGiong.initFreqSwiper
   * 2026-06-09 从 view-zodiac-predict.js 提取
   */
  _createSwiper: function(config) {
    var w = document.getElementById(config.wrapperId);
    if (!w) return;
    if (w.dataset.swiperInit) return;
    w.dataset.swiperInit = '1';
    var cards = w.querySelectorAll(config.cardSelector);
    if (!cards || !cards.length) return;
    var idx = config.initialIndex || 0;
    var total = cards.length;
    var sx = 0, cx = 0, dragging = false, lastT = 0, lastX = 0, lastY = 0;
    var animating = false;
    var animTimer = null;

    function getWidth() {
      return w.offsetWidth || 0;
    }

    function setTransform(offsetPercent, animate) {
      if (animate) {
        w.style.transition = 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
      } else {
        w.style.transition = 'none';
      }
      w.style.transform = 'translate3d(' + offsetPercent + '%, 0, 0)';
    }

    function updateDots() {
      var dc = document.getElementById(config.dotsId);
      if (dc) {
        var dots = dc.querySelectorAll('.' + config.dotClass);
        dots.forEach(function(d, di) { d.classList.toggle('active', di === idx); });
      }
    }

    function slide(i, animate) {
      if (i < 0) i = 0;
      if (i >= total) i = total - 1;
      idx = i;
      animating = true;
      if (animTimer) clearTimeout(animTimer);
      setTransform(-i * 100, animate !== false);
      updateDots();
      animTimer = setTimeout(function() { animating = false; }, 320);
    }

    function start(e) {
      if (e.type === 'mousedown' && e.pointerType === 'touch') return;
      var touch = e.type === 'mousedown' ? null : (e.touches && e.touches[0]);
      if (!touch && e.type !== 'mousedown') return;
      var ww = getWidth();
      if (!ww) return;
      dragging = true;
      w.style.transition = 'none';
      if (animTimer) clearTimeout(animTimer);
      animating = false;
      sx = touch ? touch.clientX : e.clientX;
      cx = sx;
      lastX = sx;
      lastY = touch ? touch.clientY : 0;
      lastT = Date.now();
    }

    var moveHandler = function(e) {
      if (!dragging) return;
      var touch = e.type === 'mousemove' ? null : (e.touches && e.touches[0]);
      if (!touch && e.type !== 'mousemove') return;
      var nowX = touch ? touch.clientX : e.clientX;
      var nowY = touch ? touch.clientY : lastY;

      var dx = Math.abs(nowX - lastX);
      var dy = Math.abs(nowY - lastY);

      if (e.type === 'touchmove' && e.cancelable !== false && dx > 2 && dx > dy) {
        e.preventDefault();
      }

      cx = nowX;
      lastX = nowX;
      lastY = nowY;
      lastT = Date.now();
      var d = sx - cx;
      var ww = getWidth();
      if (!ww) return;
      var offsetPercent = -(idx * 100) - (d / ww * 100);
      w.style.transform = 'translate3d(' + offsetPercent + '%, 0, 0)';
    };

    function end(e) {
      if (!dragging) return;
      dragging = false;
      if (e.type === 'touchend' && e.changedTouches && e.changedTouches.length) {
        cx = e.changedTouches[0].clientX;
      }
      var d = sx - cx;
      var ad = Math.abs(d);
      var now = Date.now();
      var elapsed = Math.max(now - lastT, 16);
      var vel = ad / elapsed;
      var ww = getWidth();
      if (!ww) { slide(idx, true); return; }
      var cardW = ww / total;
      var swipeThreshold = cardW * 0.04;
      var velThreshold = 0.12;

      if (ad > swipeThreshold || (ad > cardW * 0.02 && vel > velThreshold)) {
        if (d > 0 && idx < total - 1) {
          idx++;
        } else if (d < 0 && idx > 0) {
          idx--;
        }
      }

      slide(idx, true);
    }

    w.addEventListener('touchstart', start, { passive: true });
    w.addEventListener('touchmove', moveHandler, { passive: false });
    w.addEventListener('touchend', end, { passive: true });
    w.addEventListener('touchcancel', end, { passive: true });
    w.addEventListener('mousedown', start);
    w.addEventListener('mousemove', moveHandler);
    w.addEventListener('mouseup', end);
    w.addEventListener('mouseleave', end);

    // 性能优化：提供清理方法，避免内存泄漏
    var cleanup = function() {
      w.removeEventListener('touchstart', start);
      w.removeEventListener('touchmove', moveHandler);
      w.removeEventListener('touchend', end);
      w.removeEventListener('touchcancel', end);
      w.removeEventListener('mousedown', start);
      w.removeEventListener('mousemove', moveHandler);
      w.removeEventListener('mouseup', end);
      w.removeEventListener('mouseleave', end);
      if (animTimer) clearTimeout(animTimer);
      delete w.dataset.swiperInit;
    };
    w._cleanupSwiper = cleanup;

    if (config.dataAttr) w.setAttribute(config.dataAttr[0], config.dataAttr[1]);
    var updateRef = config.updateRef;
    if (updateRef) {
      if (updateRef.indexOf('.') !== -1) {
        var parts = updateRef.split('.');
        var target = window;
        for (var i = 0; i < parts.length - 1; i++) target = target[parts[i]];
        target[parts[parts.length - 1]] = slide;
      } else {
        window[updateRef] = slide;
      }
    }
    setTimeout(function() { slide(idx, false); }, 50);
  },

  // ============================================================
  // 通用回测弹窗模板（2026-06-09 提取，消除 4 个子标签页重复）
  // ============================================================

  /**
   * 显示回测弹窗（通用模板，大小/单双/五行/波色共用）
   * @param {Object} config
   * @param {string} config.modalId - 弹窗 ID
   * @param {string} config.title - 弹窗标题
   * @param {string} config.closeBtnId - 关闭按钮 ID
   * @param {string} [config.highlightColor] - 主题色（如 '#30D158', '#BF5AF2'）
   * @param {Object} config.backtestData - 回测数据
   *   - totalTests: 总期数
   *   - totalHits: 命中数
   *   - totalHitRate: 命中率
   *   - currentStreak: 当前连中
   *   - recentTests: 最近测试期数
   *   - recentHits: 最近命中数
   *   - recentHitRate: 最近命中率
   *   - details: 明细数组 [{ expect, isHit, predicted, actual, value }]
   * @param {Object} [config.labels] - 标签配置
   *   - predicted: '预测'
   *   - actual: '实际'
   * @param {Function} [config.formatValue] - 值格式化函数
   * @param {string} [config.footerNote] - 底部说明文案
   */
  showBacktestModal: function(config) {
    var existingModal = document.getElementById(config.modalId);
    if (existingModal) existingModal.remove();

    var overlay = document.createElement('div');
    overlay.id = config.modalId;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;opacity:0;animation:fadeIn 0.25s ease forwards;';

    var bd = config.backtestData;
    var hl = config.highlightColor || 'var(--primary)';
    var labels = config.labels || { predicted: '预测', actual: '实际' };

    var html = '';
    html += '<div style="background:var(--card);border-radius:16px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.3);transform:scale(0.95);animation:scaleIn 0.25s ease forwards;">';

    // 标题
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0;">' + config.title + '</h3>';
    html += '<button id="' + config.closeBtnId + '" style="background:none;border:none;font-size:24px;color:var(--sub-text);cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>';
    html += '</div>';

    // 统计概览
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">';
    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">总测试</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--text);">' + bd.totalTests + '</div>';
    html += '</div>';
    html += '<div style="background:' + hl + '1f;padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中</div>';
    html += '<div style="font-size:20px;font-weight:700;color:' + hl + ';">' + bd.totalHits + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(10,132,255,0.12);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中率</div>';
    html += '<div style="font-size:20px;font-weight:700;color:' + hl + ';">' + bd.totalHitRate + '%</div>';
    html += '</div>';
    html += '</div>';

    // 连中
    if (bd.currentStreak > 0) {
      html += '<div style="background:linear-gradient(135deg, ' + hl + '26, ' + hl + '14);border-left:3px solid ' + hl + ';padding:10px 12px;border-radius:8px;margin-bottom:16px;">';
      html += '<div style="font-size:12px;color:var(--sub-text);">当前连中</div>';
      html += '<div style="font-size:22px;font-weight:700;color:' + hl + ';">' + bd.currentStreak + ' 期 🔥</div>';
      html += '</div>';
    }

    // 详情列表
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px;">最近 ' + bd.recentTests + ' 期详情</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';

    (bd.details || []).forEach(function(item) {
      var hitBg = item.isHit ? hl + '1f' : 'rgba(255,69,58,0.12)';
      var hitColor = item.isHit ? hl : '#FF453A';
      var hitIcon = item.isHit ? '✓' : '✗';
      var fmtVal = config.formatValue ? config.formatValue(item) : { pred: item.predicted, actual: item.actual };

      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:' + hitBg + ';color:' + hitColor + ';">';
      html += '<span style="font-size:12px;font-weight:600;">' + item.expect + '期</span>';
      html += '<span style="font-size:14px;font-weight:700;">' + item.value + '</span>';
      html += '<span style="font-size:12px;font-weight:600;">' + labels.predicted + ':' + fmtVal.pred + '</span>';
      html += '<span style="font-size:12px;font-weight:600;">' + labels.actual + ':' + fmtVal.actual + '</span>';
      html += '<span style="font-size:16px;font-weight:700;">' + hitIcon + '</span>';
      html += '</div>';
    });

    html += '</div></div>';

    // 底部说明
    var note = config.footerNote ||
      '• 最近 ' + bd.recentTests + ' 期命中 <strong>' + bd.recentHits + '</strong> 次 (' + bd.recentHitRate + '%)<br>' +
      '• 数据仅供参考，不构成投资建议';

    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-top:12px;">';
    html += '<div style="font-size:11px;color:var(--sub-text);line-height:1.5;">' + note + '</div>';
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 关闭逻辑
    var closeHandler = function() {
      overlay.style.animation = 'fadeOut 0.2s ease forwards';
      // 性能优化：清理内部 swiper（如果存在）
      var innerSwiper = overlay.querySelector('[data-swiper-init]');
      if (innerSwiper && typeof innerSwiper._cleanupSwiper === 'function') {
        innerSwiper._cleanupSwiper();
      }
      setTimeout(function() { overlay.remove(); }, 200);
    };
    var closeBtn = document.getElementById(config.closeBtnId);
    if (closeBtn) closeBtn.addEventListener('click', closeHandler);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeHandler(); });

    // 注入动画样式
    if (!document.getElementById('backtestModalAnimations')) {
      var styleSheet = document.createElement('style');
      styleSheet.id = 'backtestModalAnimations';
      styleSheet.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{transform:scale(0.95)}to{transform:scale(1)}}@keyframes fadeOut{from{opacity:1}to{opacity:0}}';
      document.head.appendChild(styleSheet);
    }
  },

  // ============================================================
  // 通用综合分析渲染模板（2026-06-09 提取，消除 4 个子标签页重复）
  // ============================================================

  /**
   * 渲染综合分析内容（大小/单双/五行/波色共用）
   * @param {Object} config
   * @param {Array} config.sequence - 序列数据 [{ value, type }] 或 [{ wuxing/color/size/type }]
   * @param {Object} [config.stats] - 统计数据对象 { '金': count, '木': count } 或数组
   * @param {number} [config.total] - 总期数，用于计算百分比
   * @param {Array} [config.patterns] - 规律特征 [{ type, count }]
   * @param {Object} [config.trend] - 趋势预测 { prediction, confidence, reason }
   * @param {string} config.trendAction - 趋势点击 action
   * @param {string} [config.typePrefix] - CSS class 前缀（如 'size-', 'oddeven-'）
   * @param {string} [config.valueKey] - 序列数据项中取值的 key（如 'wuxing', 'color'）
   * @param {Object} [config.colors] - 值到颜色的映射 { '金': '#FFD700', '木': '#22C55E' }
   * @returns {string} HTML
   */
  renderCombinedAnalysisContent: function(config) {
    if (!config || !config.sequence || config.sequence.length === 0) {
      return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';
    }

    var prefix = config.typePrefix || '';
    var valueKey = config.valueKey || 'value';
    var colors = config.colors || {};
    var html = '';

    // 序列
    html += '<div class="combined-sequence-row">';
    var reversedSeq = config.sequence.slice().reverse();
    reversedSeq.forEach(function(item) {
      var val = item[valueKey] || item.value || '';
      var color = colors[val] || '#999';
      html += '<span class="combined-seq-item ' + prefix + '-item" style="background:' + color + ';color:#fff;">' + val + '</span>';
    });
    html += '</div>';

    // 统计（支持对象格式）
    if (config.stats && typeof config.stats === 'object') {
      var statKeys = Object.keys(config.stats);
      if (statKeys.length > 0) {
        html += '<div class="combined-stats-grid">';
        statKeys.forEach(function(key) {
          var count = config.stats[key] || 0;
          var total = config.total || 1;
          var percent = total > 0 ? Math.round((count / total) * 100) : 0;
          var color = colors[key] || '#999';
          html += '<div class="' + prefix + '-stat"><span class="' + prefix + '-name" style="color:' + color + '">' + key + '</span><span class="' + prefix + '-count">' + count + '</span><span class="' + prefix + '-bar-bg"><span class="' + prefix + '-bar-fill" style="width:' + percent + '%;background:' + color + ';"></span></span><span class="' + prefix + '-pct">' + percent + '%</span></div>';
        });
        html += '</div>';
      }
    }

    // 规律
    if (config.patterns && config.patterns.length > 0) {
      html += '<div class="combined-patterns">';
      config.patterns.forEach(function(p) {
        var pColor = colors[p.type.charAt(0)] || '#666';
        html += '<span class="pattern-tag" style="background:' + pColor + ';color:#fff;">' + p.type + p.count + '</span>';
      });
      html += '</div>';
    }

    // 趋势
    if (config.trend && config.trend.prediction !== '-') {
      var predColor = colors[config.trend.prediction] || '#999';
      html += '<div class="combined-trend" data-action="' + config.trendAction + '" style="cursor:pointer;">';
      html += '<span class="trend-predict ' + prefix + '-predict" style="background:' + predColor + ';color:#fff;">' + config.trend.prediction + '</span>';
      html += '<span class="trend-conf">' + config.trend.confidence + '%</span>';
      if (config.trend.reason) html += '<span class="trend-reason">' + config.trend.reason + '</span>';
      html += '</div>';
    }

    return html;
  }
};