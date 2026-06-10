/**
 * 视图层：Giong 频率评级面板（giong panel）
 * 职责：渲染"资料页"中的"Giong标签页"，包含 12/24/36 期窗口频率评级 + 未推荐区域 + 综合分析 + 区域变动追踪
 * 依赖方向：被 business-main.js / event.js 调用
 * 拆分记录：2026-06-09 从 view-zodiac-prediction.js 拆分
 *          2026-06-09 拆分综合分析子标签页（大小/单双/五行/波色）到独立文件
 *            - view-zodiac-giong-size.js    ：大小分析子标签页
 *            - view-zodiac-giong-oddeven.js ：单双分析子标签页
 *            - view-zodiac-giong-wuxing.js  ：五行分析子标签页
 *            - view-zodiac-giong-color.js   ：波色分析子标签页
 */
const ViewZodiacGiong = {

  /**
   * 缓存最近一次频率评级结果，供事件层使用（弹出统计时按生肖定位）
   */
  _cachedFreqResult: null,

  /**
   * 频率评级主面板（12/24/36 期窗口的滑动 swiper）
   */
  renderFrequencyRating: function(freqResult) {
    var grid = document.getElementById('giongFreqGrid');
    if (!grid) return;

    ViewZodiacGiong._cachedFreqResult = freqResult;

    if (!freqResult) {
      grid.innerHTML = '<div class="empty-tip">数据不足（需至少12期历史数据）</div>';
      return;
    }

    var periods = [
      { key: 'p12', label: '12期窗口' },
      { key: 'p24', label: '24期窗口' },
      { key: 'p36', label: '36期窗口' }
    ];

    var zoneOrder = ['封顶区', '降权区', '过热区', '热号区', '活跃区', '穿插区', '冷号区'];

    var html = '';
    html += '<div class="freq-panels-container" id="freqPanelsContainer">';

    periods.forEach(function(period) {
      var data = freqResult[period.key];
      if (!data) {
        html += '<div class="freq-panel" data-freq-panel="' + period.key + '" style="display:none;">';
        html += '<div class="empty-tip">数据不足</div></div>';
        return;
      }

      var grouped = {};
      zoneOrder.forEach(function(z) { grouped[z] = []; });
      data.forEach(function(item) {
        grouped[item.zone].push(item);
      });

      var display = period.key === 'p12' ? '' : ' style="display:none;"';
      html += '<div class="freq-panel" data-freq-panel="' + period.key + '"' + display + '>';

      zoneOrder.forEach(function(zone) {
        var items = grouped[zone];
        if (!items || !items.length) return;

        html += '<div class="zone-section">';
        html += '<div class="zone-section-header">';
        html += '<span class="freq-zone-tag ' + ViewCommon.getZoneClass(zone, '') + '">' + zone + '</span>';
        html += '<span class="zone-count-badge">' + items.length + '个</span>';
        html += '</div>';
        html += '<div class="zone-card-list">';
        items.forEach(function(item) {
          var badgeClass = ViewCommon.getZoneClass(item.zone, '');

          var droppedArrow = '';
          if (item.willDrop) {
            droppedArrow = '<span class="drop-arrow">▼</span>';
          } else if (item.willDowngrade) {
            droppedArrow = '<span class="drop-arrow drop-arrow-yellow">▼</span>';
          }
          html += '<div class="zone-zod-card" data-action="showZodiacStat" data-zodiac="' + item.zodiac + '">';
          html += '<div class="zod-card-count-badge ' + badgeClass + '">' + item.count + droppedArrow + '</div>';
          html += '<div class="zod-card-name">' + item.zodiac + '</div>';
          html += '<div class="zod-card-stats">';
          html += '<span class="zod-card-miss">' + item.miss + '期</span>';
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';
      });

      html += '</div>';
    });

    html += '</div>';

    html += '<div class="freq-tabs-bar" id="freqTabsBar">';
    periods.forEach(function(period, idx) {
      var activeClass = idx === 0 ? ' active' : '';
      html += '<button class="freq-tab-btn' + activeClass + '" data-freq-key="' + period.key + '" data-action="switchFreqTab">' + period.label + '</button>';
    });
    html += '</div>';

    grid.innerHTML = html;
  },

  /**
   * 最近一期某生肖出现后，最可能的跟随生肖
   */
  renderLatestFollowStats: function(latestData) {
    var container = document.getElementById('latestFollowStatsPanel');
    if (!container) return;

    if (!latestData) {
      container.innerHTML = '';
      return;
    }

    var html = '';
    html += '<div class="latest-follow-card">';
    html += '<div class="latest-follow-header">';
    html += '<div class="latest-follow-subtitle">第' + latestData.expect + '期 <strong>' + latestData.zodiac + '</strong> 出现后的跟随情况</div>';
    html += '</div>';

    if (latestData.topFollowers && latestData.topFollowers.length > 0) {
      html += '<div class="latest-follow-content">';
      html += '<div class="latest-follow-chain">';
      html += '<span class="latest-zodiac">' + latestData.zodiac + '</span>';

      latestData.topFollowers.forEach(function(item, idx) {
        html += '<span class="follow-arrow">→</span>';
        html += '<span class="follow-zodiac">' + item.zodiac + '</span>';
      });

      html += '</div>';

      html += '<div class="latest-follow-stats">';
      latestData.topFollowers.forEach(function(item) {
        html += '<div class="latest-follow-item">';
        html += '<div class="latest-follow-name">' + item.zodiac + '</div>';
        html += '<div class="latest-follow-count">' + item.count + '次</div>';
        html += '<div class="latest-follow-percent">' + item.percentage + '%</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    } else {
      html += '<div class="latest-follow-empty">暂无跟随数据</div>';
    }

    html += '</div>';

    container.innerHTML = html;
  },

  /**
   * 区域综合推荐（在 Giong 面板的"区域推荐"区域）
   */
  renderZoneRecommend: function(zodiacList, nextExpect) {
    var container = document.getElementById('giongRecommendPanel');
    if (!container) return;

    if (!zodiacList || !zodiacList.length) {
      container.innerHTML = '';
      return;
    }

    var title = '区域综合推荐';
    if (nextExpect) title = '第' + nextExpect + '期推荐';

    var html = '<div class="giong-header-row">';
    html += '<div class="analysis-section-title">' + title + '</div>';
    html += '<button class="db-copy-btn" data-action="copyZodiacTop6" type="button" aria-label="复制 Giong 推荐生肖"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>';
    html += '</div>';
    html += '<div class="zodiac-static-grid">';
    zodiacList.forEach(function(item, idx) {
      var zodiac = Array.isArray(item) ? item[0] : item;
      var rankNum = idx + 1;
      var cardClass = '';
      if (rankNum === 1) cardClass = 'card-rank-1';
      else if (rankNum === 2) cardClass = 'card-rank-2';
      else if (rankNum === 3) cardClass = 'card-rank-3';
      else cardClass = 'card-rank-other';

      var emoji = ZodiacPrediction.getZodiacEmoji(zodiac);

      html += ViewCommon.renderZodiacCardHtml(zodiac, rankNum, cardClass, emoji);
    });
    html += '</div>';
    container.innerHTML = html;
  },

  /**
   * 区域回测追踪
   */
  renderZoneBacktest: function(summary) {
    var container = document.getElementById('giongBacktestPanel');
    if (!container) return;

    if (!summary || !summary.total) {
      container.innerHTML = '<div class="empty-tip">暂无回测数据</div>';
      return;
    }

    var hitClass = ViewCommon.getRateClass(summary.hitRate);

    var html = '<div class="backtest-summary">';
    html += '<div class="backtest-summary-title">区域回测追踪（前6名）</div>';
    html += '<div class="backtest-summary-row">';
    html += '<div class="backtest-stat">';
    html += '<span class="backtest-stat-label">回测期数</span>';
    html += '<span class="backtest-stat-value">' + summary.total + '期</span>';
    html += '</div>';
    html += '<div class="backtest-stat">';
    html += '<span class="backtest-stat-label">命中次数</span>';
    html += '<span class="backtest-stat-value">' + summary.hits + '次</span>';
    html += '</div>';
    html += '<div class="backtest-stat">';
    html += '<span class="backtest-stat-label">命中率</span>';
    html += '<span class="backtest-stat-value ' + hitClass + '">' + summary.hitRate + '%</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="backtest-breakdown">';
    html += '<span class="backtest-breakdown-item">🥇No.1：' + summary.top1Hits + '次</span>';
    html += '<span class="backtest-breakdown-item">🥈No.2：' + summary.top2Hits + '次</span>';
    html += '<span class="backtest-breakdown-item">🥉No.3：' + summary.top3Hits + '次</span>';
    html += '</div>';
    html += '</div>';

    html += '<div class="backtest-records backtest-records-inline">';
    var recentRecords = summary.records.slice(0, 30);
    recentRecords.forEach(function(r) {
      var hitText = r.hit ? '准' : '错';
      var hitRowClass = r.hit ? 'backtest-hit' : 'backtest-miss';
      var top6Html;
      if (r.hit && r.hitRank >= 1 && r.hitRank <= r.top6.length) {
        var hitIdx = r.hitRank - 1;
        top6Html = r.top6.map(function(z, i) {
          if (i === hitIdx) return '<span class="backtest-record-zodiac-hit">' + z + '</span>';
          return z;
        }).join('');
      } else {
        top6Html = r.top6.join('');
      }
      var actualNumRaw = r.actualTe !== undefined ? r.actualTe : (r.actualNumber !== undefined ? r.actualNumber : '');
      var actualNum = Utils.formatNum(actualNumRaw);
      html += '<div class="backtest-record-row ' + hitRowClass + '">';
      html += '<span class="backtest-record-period">' + r.expect + '期:</span>';
      html += '<span class="backtest-record-predict">【<span class="backtest-record-zodiacs">' + top6Html + '</span>】</span>';
      html += '<span class="backtest-record-result">开:<b>' + r.actualZodiac + '</b>' + actualNum + '<span class="backtest-record-hittext">' + hitText + '</span></span>';
      html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  },

  renderZoneBacktestEmpty: function() {
    var container = document.getElementById('giongBacktestPanel');
    if (!container) return;
    container.innerHTML = '<div class="empty-tip">计算中…</div>';
  },

  initFreqSwiper: function() {
    ViewCommon._createSwiper({
      wrapperId: 'freqSwiperWrapper', cardSelector: '.freq-card',
      dotsId: 'freqSwiperDots', dotClass: 'freq-swiper-dot',
      updateRef: 'ViewZodiacGiong.freqSwiperUpdate',
      dataAttr: ['data-freq-current', '0']
    });
  },

  /**
   * 综合分析（大小/单双/五行/波色 切换面板）
   * 子标签页内容由 view-zodiac-giong-size.js 等子文件挂载到 ViewZodiacGiong
   */
  renderCombinedAnalysis: function(sizeData, oddEvenData, wuxingData, colorData) {
    var container = document.getElementById('combinedAnalysisPanel');
    if (!container) return;

    if (!sizeData && !oddEvenData && !wuxingData && !colorData) {
      container.innerHTML = '';
      return;
    }

    var html = '';
    html += '<div class="combined-analysis-card">';

    html += '<div class="combined-tabs">';
    html += '<div class="combined-tab active" data-tab="size">大小</div>';
    html += '<div class="combined-tab" data-tab="oddeven">单双</div>';
    html += '<div class="combined-tab" data-tab="wuxing">五行</div>';
    html += '<div class="combined-tab" data-tab="color">波色</div>';
    html += '</div>';

    html += '<div class="combined-content">';

    html += '<div class="combined-panel active" id="panel-size">';
    html += ViewZodiacGiong._renderSizeContent(sizeData);
    html += '</div>';

    html += '<div class="combined-panel" id="panel-oddeven">';
    html += ViewZodiacGiong._renderOddEvenContent(oddEvenData);
    html += '</div>';

    html += '<div class="combined-panel" id="panel-wuxing">';
    html += ViewZodiacGiong._renderWuxingContent(wuxingData);
    html += '</div>';

    html += '<div class="combined-panel" id="panel-color">';
    html += ViewZodiacGiong._renderColorContent(colorData);
    html += '</div>';

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;

    container.querySelectorAll('.combined-tab').forEach(function(tab) {
      tab.addEventListener('click', function() {
        container.querySelectorAll('.combined-tab').forEach(function(t) { t.classList.remove('active'); });
        container.querySelectorAll('.combined-panel').forEach(function(p) { p.classList.remove('active'); });
        tab.classList.add('active');
        var panelId = 'panel-' + tab.getAttribute('data-tab');
        document.getElementById(panelId).classList.add('active');
      });
    });
  },

  /**
   * 切换频率面板标签（12期/24期/36期）
   */
  switchFreqTabUI: function(freqKey) {
    document.querySelectorAll('.freq-tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.freqKey === freqKey);
    });
    document.querySelectorAll('.freq-panel').forEach(function(panel) {
      panel.style.display = panel.dataset.freqPanel === freqKey ? '' : 'none';
    });
  },

  /**
   * 区域变动追踪（不同窗口大小下生肖区域的变化）
   * 2026-06-09 从 view-zodiac-prediction.js 拆分时丢失的旧版本完整实现
   * 旧版本（55a01d3）行为：
   *   - 动态注入容器到 giongFreqGrid 下方
   *   - 数据不足时显示"数据不足"空状态卡片
   *   - 头部：区域变动追踪（X期）+ 变动最多 topZone/topCount
   *   - 区域统计条（sourceZoneCount 柱状图）
   *   - 变动记录列表（expect/zodiac/miss/prevZone→curZone，默认2期可展开）
   *   - 展开/折叠按钮（持久化用户偏好）
   * 数据源：ZodiacPrediction.calcZoneChangeTracking → { records, sourceZoneCount, topZone, topCount, windowSize }
   */
  renderZoneChangeTracking: function(changeData) {
    // 确保容器存在，动态注入到 giongFreqGrid 下方
    var container = document.getElementById('giongZoneChangePanel');
    if (!container) {
      container = document.createElement('div');
      container.id = 'giongZoneChangePanel';
      var freqGrid = document.getElementById('giongFreqGrid');
      if (freqGrid && freqGrid.parentNode) {
        freqGrid.parentNode.appendChild(container);
      }
    }

    if (!changeData || !changeData.records || !changeData.records.length) {
      // 数据不足时显示空状态
      var wsLabel = (changeData && changeData.windowSize === 24) ? '24期' : (changeData && changeData.windowSize === 36 ? '36期' : '12期');
      container.innerHTML =
        '<div class="zone-change-card zone-change-empty">' +
          '<div class="zone-change-header">' +
            '<span class="zone-change-title">区域变动追踪（' + wsLabel + '）</span>' +
          '</div>' +
          '<div class="zone-change-empty-tip">数据不足（需至少' + (changeData && changeData.windowSize || 12) + '期）</div>' +
        '</div>';
      return;
    }

    var html = '';
    html += '<div class="zone-change-card">';

    // 头部
    var wsLabel = (changeData.windowSize === 24) ? '24期' : (changeData.windowSize === 36 ? '36期' : '12期');
    html += '<div class="zone-change-header">';
    html += '<span class="zone-change-title">区域变动追踪（' + wsLabel + '）</span>';
    if (changeData.topZone && changeData.topCount > 0) {
      html += '<span class="zone-change-top-info">';
      html += '变动最多：<span class="freq-zone-tag ' + ViewCommon.getZoneClass(changeData.topZone, '') + '">' + changeData.topZone + '</span>';
      html += '<span class="zone-change-top-count">×' + changeData.topCount + '</span>';
      html += '</span>';
    }
    html += '</div>';

    // 区域统计条
    html += '<div class="zone-change-stats">';
    var statZones = [];
    Object.keys(changeData.sourceZoneCount).forEach(function(z) {
      statZones.push({ zone: z, count: changeData.sourceZoneCount[z] });
    });
    statZones.sort(function(a, b) { return b.count - a.count; });
    var total = statZones.reduce(function(s, item) { return s + item.count; }, 0);
    statZones.forEach(function(item) {
      if (item.count === 0) return;
      var pct = total > 0 ? Math.round(item.count / total * 100) : 0;
      html += '<div class="zone-change-stat-item">';
      html += '<span class="zone-change-stat-name">' + item.zone + '</span>';
      html += '<div class="zone-change-bar-track">';
      html += '<div class="zone-change-bar-fill ' + ViewCommon.getZoneClass(item.zone, '') + '" style="width:' + pct + '%;"></div>';
      html += '</div>';
      html += '<span class="zone-change-stat-val">' + item.count + '次</span>';
      html += '</div>';
    });
    html += '</div>';

    // 变动记录列表（默认只显示2期，可展开/折叠）
    var preferExpanded = Storage.getZoneChangeExpanded();
    var listClass = preferExpanded ? 'zone-change-list expanded' : 'zone-change-list';
    html += '<div class="' + listClass + '">';
    var visibleCount = 2;
    changeData.records.forEach(function(r, idx) {
      var changeClass = r.changed ? 'zone-changed' : 'zone-unchanged';
      var arrow = r.changed ? '↗' : '→';
      // 始终给超过 visibleCount 的项加 zone-change-hidden class，
      // 由 CSS (.zone-change-list.expanded .zone-change-hidden { display: flex })
      // 统一控制展开/折叠。
      // 修复：当用户上次选择"展开"后刷新页面，!preferExpanded=false 会导致
      // 所有项都不带 zone-change-hidden class，点击"收起"按钮时虽然 CSS 切了
      // expanded class，但没有任何项需要被隐藏，看起来"无法收起"。
      var hiddenClass = (idx >= visibleCount) ? ' zone-change-hidden' : '';
      html += '<div class="zone-change-item ' + changeClass + hiddenClass + '">';
      html += '<span class="zone-change-expect">' + r.expect + '期</span>';
      html += '<span class="zone-change-zodiac">' + r.zodiac + '</span>';
      // 遗漏间隔：-1=首次出现，>=1=距离上次出现的期数
      var missText = r.missInterval === -1 ? '首现' : '隔' + r.missInterval + '期';
      html += '<span class="zone-change-miss">' + missText + '</span>';
      html += '<span class="zone-change-zone-tag ' + ViewCommon.getZoneClass(r.prevZone, '') + '">' + r.prevZone + '</span>';
      html += '<span class="zone-change-arrow">' + arrow + '</span>';
      html += '<span class="zone-change-zone-tag ' + ViewCommon.getZoneClass(r.curZone, '') + '">' + r.curZone + '</span>';
      html += '</div>';
    });
    // 展开/折叠按钮（超过2条时显示）
    if (changeData.records.length > visibleCount) {
      var toggleLabel = preferExpanded ? '收起' : '展开更多（共' + changeData.records.length + '期）';
      var toggleIconChar = preferExpanded ? '▲' : '▼';
      html += '<div class="zone-change-toggle" data-action="toggleZoneChangeList">';
      html += '<span class="zone-change-toggle-text">' + toggleLabel + '</span>';
      html += '<span class="zone-change-toggle-icon">' + toggleIconChar + '</span>';
      html += '</div>';
    }
    html += '</div>';

    html += '</div>';

    container.innerHTML = html;
  },

  /**
   * 多窗口区域变动追踪（12/24/36 期组合展示：每行 期号 生肖 区域12-区域24-区域36）
   * 数据源：ZodiacPrediction.calcZoneChangeTracking(historyData, [12|24|36])
   * 容器：动态注入到 #giongZoneChangePanel 之后
   * 行为：按期号对齐三组数据，每行展示三窗口的【变动前 prevZone】所属区域拼接
   *       不展示 curZone、变动箭头、miss 等字段
   */
  renderZoneChangeTrackingMulti: function(p12Data, p24Data, p36Data) {
    var host = document.getElementById('giongZoneChangePanel');
    if (!host) return;

    var container = document.getElementById('giongZoneChangePanelMulti');
    if (!container) {
      container = document.createElement('div');
      container.id = 'giongZoneChangePanelMulti';
      if (host.parentNode) {
        host.parentNode.insertBefore(container, host.nextSibling);
      }
    }

    // 按期号把三组数据索引化，方便按 expect 对齐
    var map12 = {}, map24 = {}, map36 = {};
    if (p12Data && p12Data.records) {
      p12Data.records.forEach(function(r) { map12[r.expect] = r; });
    }
    if (p24Data && p24Data.records) {
      p24Data.records.forEach(function(r) { map24[r.expect] = r; });
    }
    if (p36Data && p36Data.records) {
      p36Data.records.forEach(function(r) { map36[r.expect] = r; });
    }

    // 以 p12 的 records 顺序为基准（按 expect 降序），三期窗口均覆盖同一批期号
    var baseRecords = (p12Data && p12Data.records) || [];
    if (!baseRecords.length && p24Data && p24Data.records) baseRecords = p24Data.records;
    if (!baseRecords.length && p36Data && p36Data.records) baseRecords = p36Data.records;

    var html = '<div class="zone-change-card zone-change-multi-card">';
    html += '<div class="zone-change-header">';
    html += '<span class="zone-change-title">区域变动追踪（多窗口组合）</span>';
    html += '<span class="zone-change-top-info">每期：12/24/36期窗口【变动前】所属区域</span>';
    html += '</div>';

    if (!baseRecords.length) {
      html += '<div class="zone-change-empty-tip">数据不足（需至少13期历史数据）</div>';
      html += '</div>';
      container.innerHTML = html;
      return;
    }

    // ===== 三窗口独立的区域变动统计（复用业务层 calcZoneChangeTracking 返回的 sourceZoneCount / topZone / topCount）=====
    var statsList = [
      { ws: 12, label: '12期窗口', data: p12Data },
      { ws: 24, label: '24期窗口', data: p24Data },
      { ws: 36, label: '36期窗口', data: p36Data }
    ];
    html += '<div class="zone-change-combo-stats-grid">';
    statsList.forEach(function(s) {
      html += '<div class="zone-change-combo-stats-col">';
      html += '<div class="zone-change-combo-stats-title">' + s.label + '·变动最多</div>';

      if (s.data && s.data.records && s.data.records.length) {
        var totalCount = s.data.records.length;

        // 顶部：变动最多区域
        if (s.data.topZone && s.data.topCount > 0) {
          html += '<div class="zone-change-combo-stats-top">';
          html += '<span class="zone-change-zone-tag ' + ViewCommon.getZoneClass(s.data.topZone, '') + '">' + s.data.topZone + '</span>';
          html += '<span class="zone-change-combo-stats-topcount">×' + s.data.topCount + '</span>';
          html += '</div>';
        }

        // 各区域统计条（按次数降序，跳过 0 次）
        var sortedZones = [];
        var zoneCount = s.data.sourceZoneCount || {};
        Object.keys(zoneCount).forEach(function(z) {
          sortedZones.push({ zone: z, count: zoneCount[z] });
        });
        sortedZones.sort(function(a, b) { return b.count - a.count; });

        html += '<div class="zone-change-combo-stats-bars">';
        sortedZones.forEach(function(item) {
          if (item.count === 0) return;
          var pct = totalCount > 0 ? Math.round(item.count / totalCount * 100) : 0;
          html += '<div class="zone-change-stat-item">';
          html += '<span class="zone-change-stat-name">' + item.zone + '</span>';
          html += '<div class="zone-change-bar-track">';
          html += '<div class="zone-change-bar-fill ' + ViewCommon.getZoneClass(item.zone, '') + '" style="width:' + pct + '%;"></div>';
          html += '</div>';
          html += '<span class="zone-change-stat-val">' + item.count + '次</span>';
          html += '</div>';
        });
        html += '</div>';
      } else {
        html += '<div class="zone-change-empty-tip">数据不足</div>';
      }

      html += '</div>';
    });
    html += '</div>';

    html += '<div class="zone-change-combo-list">';
    var comboVisibleCount = 2;
    baseRecords.forEach(function(r, idx) {
      var rec12 = map12[r.expect];
      var rec24 = map24[r.expect];
      var rec36 = map36[r.expect];

      // 记录【变动前】的区域 prevZone（即该期开出前所在窗口的所属区域）
      var z12 = rec12 ? rec12.prevZone : '-';
      var z24 = rec24 ? rec24.prevZone : '-';
      var z36 = rec36 ? rec36.prevZone : '-';

      // 默认只显示前 2 期，超出部分加 zone-change-hidden 由 CSS 折叠
      var hiddenClass = (idx >= comboVisibleCount) ? ' zone-change-hidden' : '';

      html += '<div class="zone-change-combo-item' + hiddenClass + '">';
      html += '<span class="zone-change-expect">' + r.expect + '期</span>';
      html += '<span class="zone-change-zodiac">' + r.zodiac + '</span>';
      html += '<span class="zone-change-combo-zones">';
      html += '<span class="zone-change-zone-tag ' + ViewCommon.getZoneClass(z12, '') + '">' + z12 + '</span>';
      html += '<span class="zone-change-combo-sep">-</span>';
      html += '<span class="zone-change-zone-tag ' + ViewCommon.getZoneClass(z24, '') + '">' + z24 + '</span>';
      html += '<span class="zone-change-combo-sep">-</span>';
      html += '<span class="zone-change-zone-tag ' + ViewCommon.getZoneClass(z36, '') + '">' + z36 + '</span>';
      html += '</span>';
      html += '</div>';
    });
    // 超过 2 条时显示展开/折叠按钮
    if (baseRecords.length > comboVisibleCount) {
      html += '<div class="zone-change-toggle" data-action="toggleZoneChangeComboList">';
      html += '<span class="zone-change-toggle-text">展开更多（共' + baseRecords.length + '期）</span>';
      html += '<span class="zone-change-toggle-icon">▼</span>';
      html += '</div>';
    }
    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  // 频率评级 swiper 全局引用（由 ViewCommon._createSwiper 写入）
  freqSwiperUpdate: null
};