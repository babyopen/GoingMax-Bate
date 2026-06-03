const ViewZodiacPrediction = {
  renderPrediction: function(predictionData) {
    var grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return;

    if (!predictionData || !predictionData.cards) {
      grid.innerHTML = '<div class="empty-tip">暂无开奖数据，无法生成预测</div>';
      return;
    }

    var allCards = predictionData.cards;
    if (!allCards || allCards.length < 12) {
      grid.innerHTML = '<div class="empty-tip">数据不足，无法生成完整预测</div>';
      return;
    }

    var html = '';

    html += '<div class="freq-panels-container">';

    var top6Cards = allCards.slice(0, 6);
    var bottom6Cards = allCards.slice(6, 12);

    html += '<div class="freq-panel zodiac-pred-panel" data-pred-panel="top6">';
    html += '<div class="zodiac-pred-grid">';
    top6Cards.forEach(function(card, idx) {
      var rankNum = idx + 1;
      var cardClass = '';
      if (rankNum === 1) cardClass = 'card-rank-1';
      else if (rankNum === 2) cardClass = 'card-rank-2';
      else if (rankNum === 3) cardClass = 'card-rank-3';
      else cardClass = 'card-rank-other';

      var emoji = ZodiacPrediction.getZodiacEmoji(card.zodiac);

      html += '<div class="zodiac-static-card ' + cardClass + '">';
      html += '<div class="zodiac-static-rank">' + rankNum + '</div>';
      html += '<div class="zodiac-static-emoji">' + emoji + '</div>';
      html += '<div class="zodiac-static-name">' + card.zodiac + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="freq-panel zodiac-pred-panel" data-pred-panel="bottom6" style="display:none;">';
    html += '<div class="zodiac-pred-grid">';
    bottom6Cards.forEach(function(card, idx) {
      var rankNum = idx + 7;
      var cardClass = 'card-rank-other';

      var emoji = ZodiacPrediction.getZodiacEmoji(card.zodiac);

      html += '<div class="zodiac-static-card ' + cardClass + '">';
      html += '<div class="zodiac-static-rank">' + rankNum + '</div>';
      html += '<div class="zodiac-static-emoji">' + emoji + '</div>';
      html += '<div class="zodiac-static-name">' + card.zodiac + '</div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '</div>';

    html += '<div class="freq-tabs-bar zodiac-pred-tabs">';
    html += '<button class="freq-tab-btn active" data-pred-tab="top6" data-action="switchPredTab">推荐前6名</button>';
    html += '<button class="freq-tab-btn" data-pred-tab="bottom6" data-action="switchPredTab">推荐后6名</button>';
    html += '</div>';

    grid.innerHTML = html;
  },

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

    if (config.dataAttr) w.setAttribute(config.dataAttr[0], config.dataAttr[1]);
    ViewZodiacPrediction[config.updateRef] = slide;
    setTimeout(function() { slide(idx, false); }, 50);
  },

  initPredSwiper: function() {
    ViewZodiacPrediction._createSwiper({
      wrapperId: 'zodiacPredSwiperWrapper', cardSelector: '.zodiac-pred-card',
      dotsId: 'zodiacPredSwiperDots', dotClass: 'freq-swiper-dot', updateRef: 'predSwiperUpdate'
    });
  },

  renderEmpty: function() {
    var grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-tip">暂无开奖数据，请先刷新历史数据</div>';
  },

  showLoading: function() {
    var grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-tip">正在计算预测...</div>';
  },

  renderBacktest: function(summary) {
    var container = document.getElementById('zodiacBacktestContainer');
    if (!container) return;

    if (!summary || !summary.total) {
      container.innerHTML = '';
      return;
    }

    var hitClass = summary.hitRate >= 70 ? 'backtest-rate-high' : (summary.hitRate >= 40 ? 'backtest-rate-mid' : 'backtest-rate-low');

    var html = '<div class="backtest-summary">';
    html += '<div class="backtest-summary-title">回测追踪（前6名）</div>';
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

    html += '<div class="backtest-records">';
    var recentRecords = summary.records.slice(0, 10);
    recentRecords.forEach(function(r) {
      var hitIcon = r.hit ? '✅' : '❌';
      var hitText = r.hit ? '第' + r.hitRank + '名命中' : '未命中';
      var hitRowClass = r.hit ? 'backtest-hit' : 'backtest-miss';
      var top6Text = r.top6.join(' ');
      html += '<div class="backtest-record-row ' + hitRowClass + '">';
      html += '<div class="backtest-record-period">' + r.expect + '期</div>';
      html += '<div class="backtest-record-predict">预测：' + top6Text + '</div>';
      html += '<div class="backtest-record-result">实际：<b>' + r.actualZodiac + '</b> ' + hitIcon + ' ' + hitText + '</div>';
      html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  },

  renderBacktestEmpty: function() {
    var container = document.getElementById('zodiacBacktestContainer');
    if (!container) return;
    container.innerHTML = '<div class="empty-tip">运行中…</div>';
  },

  renderStrategyPanel: function(tuned) {
    var panel = document.getElementById('zodiacStrategyPanel');
    if (!panel) return;

    if (!tuned) {
      panel.innerHTML = '';
      return;
    }

    var strategyClass;
    if (tuned.strategy === '强追热') strategyClass = 'strategy-hot';
    else if (tuned.strategy === '追冷搏反弹') strategyClass = 'strategy-cold';
    else strategyClass = 'strategy-balanced';

    var dims = [
      { key: 'base', label: '热度', max: 30 },
      { key: 'shape', label: '形态', max: 20 },
      { key: 'interval', label: '间隔', max: 20 },
      { key: 'trend', label: '趋势', max: 15 },
      { key: 'momentum', label: '动量', max: 15 }
    ];

    var html = '<div class="strategy-panel">';
    html += '<div class="strategy-panel-title">动态策略调整</div>';
    html += '<div class="strategy-mode-row">';
    html += '<span class="strategy-mode-label">当前模式：</span>';
    html += '<span class="strategy-mode-value ' + strategyClass + '">' + tuned.strategy + '</span>';
    html += '</div>';
    html += '<div class="strategy-heat-row">';
    html += '<span>热号命中 ' + tuned.hotHitRatio + '%</span>';
    html += '<span>冷号命中 ' + tuned.coldHitRatio + '%</span>';
    html += '</div>';
    html += '<div class="strategy-weights">';
    html += '<div class="strategy-weights-title">维度权重（基于回测优化）</div>';
    html += '<div class="strategy-weight-bars">';
    dims.forEach(function(d) {
      var pct = tuned.dimensionEff[d.key] || 0;
      var w = tuned.detail[d.key] || 0;
      var barClass = pct >= 80 ? 'bar-high' : (pct >= 50 ? 'bar-mid' : 'bar-low');
      html += '<div class="strategy-weight-item">';
      html += '<div class="strategy-weight-header"><span>' + d.label + '</span><span>' + w + '%</span></div>';
      html += '<div class="strategy-weight-track"><div class="strategy-weight-fill ' + barClass + '" style="width:' + pct + '%"></div></div>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';
    html += '</div>';

    panel.innerHTML = html;
  },

  switchTabUI: function(tab) {
    document.querySelectorAll('.zodiac-tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.zodiacTab === tab);
    });
    document.querySelectorAll('.zodiac-tab-panel').forEach(function(panel) {
      var panelId = panel.id;
      var panelMap = { predict: 'zodiacPredictPanel', giong: 'zodiacGiongPanel', ultimate: 'zodiacUltimatePanel' };
      panel.classList.toggle('active', panelId === panelMap[tab]);
    });
  },

  renderFrequencyRating: function(freqResult) {
    var grid = document.getElementById('giongFreqGrid');
    if (!grid) return;
    
    ViewZodiacPrediction._cachedFreqResult = freqResult;

    if (!freqResult) {
      grid.innerHTML = '<div class="empty-tip">数据不足（需至少12期历史数据）</div>';
      return;
    }

    var periods = [
      { key: 'p12', label: '12期窗口' },
      { key: 'p24', label: '24期窗口' },
      { key: 'p36', label: '36期窗口' }
    ];

    var zoneColors = {
      '封顶区': 'zone-peak',
      '降权区': 'zone-high',
      '过热区': 'zone-ovht',
      '热号区': 'zone-mid',
      '活跃区': 'zone-active',
      '穿插区': 'zone-low',
      '冷号区': 'zone-wait'
    };

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
        html += '<span class="freq-zone-tag ' + (zoneColors[zone] || '') + '">' + zone + '</span>';
        html += '<span class="zone-count-badge">' + items.length + '个</span>';
        html += '</div>';
        html += '<div class="zone-card-list">';
        items.forEach(function(item) {
          var badgeClass = zoneColors[item.zone] || '';

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

  renderLatestSizeStats: function(sizeData) {
    var container = document.getElementById('latestSizeStatsPanel');
    if (!container) return;

    if (!sizeData) {
      container.innerHTML = '';
      return;
    }

    var html = '';
    html += '<div class="size-analysis-card">';
    html += '<div class="size-analysis-header">';
    html += '<div class="size-analysis-title">最近' + sizeData.period + '期大小分析</div>';
    html += '</div>';

    html += '<div class="size-analysis-content">';

    html += '<div class="size-sequence-row">';
    var reversedSequence = sizeData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var sizeClass = item.size === '大' ? 'size-big' : 'size-small';
      html += '<span class="size-seq-item ' + sizeClass + '">' + item.size + '</span>';
    });
    html += '</div>';

    html += '<div class="size-stats-grid">';
    html += '<div class="size-stat-item size-stat-big">';
    html += '<div class="size-stat-label">大 (25-49)</div>';
    html += '<div class="size-stat-value">' + sizeData.bigCount + '期</div>';
    html += '<div class="size-stat-percent">' + sizeData.bigPercent + '%</div>';
    html += '</div>';
    html += '<div class="size-stat-item size-stat-small">';
    html += '<div class="size-stat-label">小 (1-24)</div>';
    html += '<div class="size-stat-value">' + sizeData.smallCount + '期</div>';
    html += '<div class="size-stat-percent">' + sizeData.smallPercent + '%</div>';
    html += '</div>';
    html += '</div>';

    if (sizeData.patterns && sizeData.patterns.length > 0) {
      html += '<div class="size-patterns-section">';
      html += '<div class="size-patterns-title">规律特征</div>';
      html += '<div class="size-patterns-list">';
      sizeData.patterns.forEach(function(pattern) {
        html += '<div class="size-pattern-tag ' + (pattern.type.indexOf('连') !== -1 ? 'pattern-streak' : 'pattern-alternate') + '">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (sizeData.trend && sizeData.trend.prediction !== '-') {
      html += '<div class="size-trend-section" data-action="showSizeBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="size-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="size-trend-prediction">';
      var trendClass = sizeData.trend.prediction === '大' ? 'trend-big' : 'trend-small';
      html += '<span class="trend-result ' + trendClass + '">' + sizeData.trend.prediction + '</span>';
      html += '<span class="trend-confidence">' + sizeData.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (sizeData.trend.reason) {
        html += '<div class="size-trend-reason">' + sizeData.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  renderLatestOddEvenStats: function(oddEvenData) {
    var container = document.getElementById('latestOddEvenStatsPanel');
    if (!container) return;

    if (!oddEvenData) {
      container.innerHTML = '';
      return;
    }

    var html = '';
    html += '<div class="oddeven-analysis-card">';
    html += '<div class="oddeven-analysis-header">';
    html += '<div class="oddeven-analysis-title">最近' + oddEvenData.period + '期单双分析</div>';
    html += '</div>';

    html += '<div class="oddeven-analysis-content">';

    html += '<div class="oddeven-sequence-row">';
    var reversedSequence = oddEvenData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var typeClass = item.type === '单' ? 'type-odd' : 'type-even';
      html += '<span class="oddeven-seq-item ' + typeClass + '">' + item.type + '</span>';
    });
    html += '</div>';

    html += '<div class="oddeven-stats-grid">';
    html += '<div class="oddeven-stat-item oddeven-stat-odd">';
    html += '<div class="oddeven-stat-label">单 (奇数)</div>';
    html += '<div class="oddeven-stat-value">' + oddEvenData.oddCount + '期</div>';
    html += '<div class="oddeven-stat-percent">' + oddEvenData.oddPercent + '%</div>';
    html += '</div>';
    html += '<div class="oddeven-stat-item oddeven-stat-even">';
    html += '<div class="oddeven-stat-label">双 (偶数)</div>';
    html += '<div class="oddeven-stat-value">' + oddEvenData.evenCount + '期</div>';
    html += '<div class="oddeven-stat-percent">' + oddEvenData.evenPercent + '%</div>';
    html += '</div>';
    html += '</div>';

    if (oddEvenData.patterns && oddEvenData.patterns.length > 0) {
      html += '<div class="oddeven-patterns-section">';
      html += '<div class="oddeven-patterns-title">规律特征</div>';
      html += '<div class="oddeven-patterns-list">';
      oddEvenData.patterns.forEach(function(pattern) {
        html += '<div class="oddeven-pattern-tag ' + (pattern.type.indexOf('连') !== -1 ? 'pattern-streak-oddeven' : 'pattern-alternate-oddeven') + '">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (oddEvenData.trend && oddEvenData.trend.prediction !== '-') {
      html += '<div class="oddeven-trend-section" data-action="showOddEvenBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="oddeven-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="oddeven-trend-prediction">';
      var trendClass = oddEvenData.trend.prediction === '单' ? 'trend-odd' : 'trend-even';
      html += '<span class="trend-result ' + trendClass + '">' + oddEvenData.trend.prediction + '</span>';
      html += '<span class="trend-confidence">' + oddEvenData.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (oddEvenData.trend.reason) {
        html += '<div class="oddeven-trend-reason">' + oddEvenData.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  showSizeBacktestModal: function(backtestData) {
    var existingModal = document.getElementById('sizeBacktestModal');
    if (existingModal) {
      existingModal.remove();
    }

    var overlay = document.createElement('div');
    overlay.id = 'sizeBacktestModal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;opacity:0;animation:fadeIn 0.25s ease forwards;';

    var html = '';
    html += '<div style="background:var(--card);border-radius:16px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.3);transform:scale(0.95);animation:scaleIn 0.25s ease forwards;">';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0;">📊 大小回测追踪</h3>';
    html += '<button id="closeSizeBacktestBtn" style="background:none;border:none;font-size:24px;color:var(--sub-text);cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">';
    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">总测试</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--text);">' + backtestData.totalTests + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(48,209,88,0.12);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#30D158;">' + backtestData.totalHits + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(10,132,255,0.12);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中率</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--primary);">' + backtestData.totalHitRate + '%</div>';
    html += '</div>';
    html += '</div>';

    if (backtestData.currentStreak > 0) {
      html += '<div style="background:linear-gradient(135deg, rgba(255,159,10,0.15), rgba(255,159,10,0.08));border-left:3px solid #FF9F0A;padding:10px 12px;border-radius:8px;margin-bottom:16px;">';
      html += '<div style="font-size:12px;color:var(--sub-text);">当前连中</div>';
      html += '<div style="font-size:22px;font-weight:700;color:#FF9F0A;">' + backtestData.currentStreak + ' 期 🔥</div>';
      html += '</div>';
    }

    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px;">最近 ' + backtestData.recentTests + ' 期详情</div>';

    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    backtestData.details.forEach(function(item) {
      var hitClass = item.isHit ? 'background:rgba(48,209,88,0.12);color:#30D158;' : 'background:rgba(255,69,58,0.12);color:#FF453A;';
      var hitIcon = item.isHit ? '✓' : '✗';
      var predClass = item.predictedSize === '大' ? 'color:#cf1322;' : 'color:#096dd9;';
      var actualClass = item.actualSize === '大' ? 'color:#cf1322;' : 'color:#096dd9;';

      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;' + hitClass + '">';
      html += '<span style="font-size:12px;font-weight:600;">' + item.expect + '期</span>';
      html += '<span style="font-size:14px;font-weight:700;">' + item.actualNumber + '</span>';
      html += '<span style="font-size:12px;font-weight:600;' + predClass + '">预测:' + item.predictedSize + '</span>';
      html += '<span style="font-size:12px;font-weight:600;' + actualClass + '">实际:' + item.actualSize + '</span>';
      html += '<span style="font-size:16px;font-weight:700;">' + hitIcon + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-top:12px;">';
    html += '<div style="font-size:11px;color:var(--sub-text);line-height:1.5;">';
    html += '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>';
    html += '• 基于大小趋势预测算法回测<br>';
    html += '• 数据仅供参考，不构成投资建议';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;

    document.body.appendChild(overlay);

    var closeBtn = document.getElementById('closeSizeBacktestBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      });
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      }
    });

    if (!document.getElementById('sizeBacktestAnimations')) {
      var styleSheet = document.createElement('style');
      styleSheet.id = 'sizeBacktestAnimations';
      styleSheet.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{transform:scale(0.95)}to{transform:scale(1)}}@keyframes fadeOut{from{opacity:1}to{opacity:0}}';
      document.head.appendChild(styleSheet);
    }
  },

  showOddEvenBacktestModal: function(backtestData) {
    var existingModal = document.getElementById('oddEvenBacktestModal');
    if (existingModal) {
      existingModal.remove();
    }

    var overlay = document.createElement('div');
    overlay.id = 'oddEvenBacktestModal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;opacity:0;animation:fadeIn 0.25s ease forwards;';

    var html = '';
    html += '<div style="background:var(--card);border-radius:16px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.3);transform:scale(0.95);animation:scaleIn 0.25s ease forwards;">';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0;">📊 单双回测追踪</h3>';
    html += '<button id="closeOddEvenBacktestBtn" style="background:none;border:none;font-size:24px;color:var(--sub-text);cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">';
    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">总测试</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--text);">' + backtestData.totalTests + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(191,90,242,0.12);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#BF5AF2;">' + backtestData.totalHits + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(10,132,255,0.12);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中率</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--primary);">' + backtestData.totalHitRate + '%</div>';
    html += '</div>';
    html += '</div>';

    if (backtestData.currentStreak > 0) {
      html += '<div style="background:linear-gradient(135deg, rgba(191,90,242,0.15), rgba(191,90,242,0.08));border-left:3px solid #BF5AF2;padding:10px 12px;border-radius:8px;margin-bottom:16px;">';
      html += '<div style="font-size:12px;color:var(--sub-text);">当前连中</div>';
      html += '<div style="font-size:22px;font-weight:700;color:#BF5AF2;">' + backtestData.currentStreak + ' 期 🔥</div>';
      html += '</div>';
    }

    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px;">最近 ' + backtestData.recentTests + ' 期详情</div>';

    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    backtestData.details.forEach(function(item) {
      var hitClass = item.isHit ? 'background:rgba(191,90,242,0.12);color:#BF5AF2;' : 'background:rgba(255,69,58,0.12);color:#FF453A;';
      var hitIcon = item.isHit ? '✓' : '✗';
      var predClass = item.predictedType === '单' ? 'color:#9333EA;' : 'color:#EA580C;';
      var actualClass = item.actualType === '单' ? 'color:#9333EA;' : 'color:#EA580C;';

      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;' + hitClass + '">';
      html += '<span style="font-size:12px;font-weight:600;">' + item.expect + '期</span>';
      html += '<span style="font-size:14px;font-weight:700;">' + item.actualNumber + '</span>';
      html += '<span style="font-size:12px;font-weight:600;' + predClass + '">预测:' + item.predictedType + '</span>';
      html += '<span style="font-size:12px;font-weight:600;' + actualClass + '">实际:' + item.actualType + '</span>';
      html += '<span style="font-size:16px;font-weight:700;">' + hitIcon + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-top:12px;">';
    html += '<div style="font-size:11px;color:var(--sub-text);line-height:1.5;">';
    html += '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>';
    html += '• 基于单双趋势预测算法回测<br>';
    html += '• 数据仅供参考，不构成投资建议';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;

    document.body.appendChild(overlay);

    var closeBtn = document.getElementById('closeOddEvenBacktestBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      });
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      }
    });
  },

  renderLatestWuxingStats: function(wuxingData) {
    var container = document.getElementById('latestWuxingStatsPanel');
    if (!container) return;

    if (!wuxingData) {
      container.innerHTML = '';
      return;
    }

    var wuxingColors = {
      '金': { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', text: '#B8860B', light: 'rgba(255,215,0,0.12)' },
      '木': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D', light: 'rgba(34,197,94,0.12)' },
      '水': { bg: 'linear-gradient(135deg, #0EA5E9, #06B6D4)', text: '#0369A1', light: 'rgba(14,165,233,0.12)' },
      '火': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C', light: 'rgba(239,68,68,0.12)' },
      '土': { bg: 'linear-gradient(135deg, #A78BFA, #8B5CF6)', text: '#7C3AED', light: 'rgba(167,139,250,0.12)' }
    };

    var html = '';
    html += '<div class="wuxing-analysis-card">';
    html += '<div class="wuxing-analysis-header">';
    html += '<div class="wuxing-analysis-title">最近' + wuxingData.period + '期五行分析</div>';
    html += '</div>';

    html += '<div class="wuxing-analysis-content">';

    html += '<div class="wuxing-sequence-row">';
    var reversedSequence = wuxingData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var wxColor = wuxingColors[item.wuxing] || wuxingColors['金'];
      html += '<span class="wuxing-seq-item" style="background:' + wxColor.bg + ';color:#fff;">' + item.wuxing + '</span>';
    });
    html += '</div>';

    html += '<div class="wuxing-stats-grid">';
    var wuxingOrder = ['金', '木', '水', '火', '土'];
    wuxingOrder.forEach(function(wx) {
      var count = wuxingData.count[wx] || 0;
      var percent = Math.round((count / wuxingData.period) * 100);
      var wxColor = wuxingColors[wx];
      html += '<div class="wuxing-stat-item">';
      html += '<div class="wuxing-stat-header" style="color:' + wxColor.text + ';border-left:3px solid ' + wxColor.text + ';">';
      html += '<span class="wuxing-stat-name">' + wx + '</span>';
      html += '<span class="wuxing-stat-count">' + count + '期</span>';
      html += '</div>';
      html += '<div class="wuxing-stat-bar-bg">';
      html += '<div class="wuxing-stat-bar-fill" style="width:' + percent + '%;background:' + wxColor.bg + ';"></div>';
      html += '</div>';
      html += '<div class="wuxing-stat-percent" style="color:' + wxColor.text + ';">' + percent + '%</div>';
      html += '</div>';
    });
    html += '</div>';

    if (wuxingData.patterns && wuxingData.patterns.length > 0) {
      html += '<div class="wuxing-patterns-section">';
      html += '<div class="wuxing-patterns-title">规律特征</div>';
      html += '<div class="wuxing-patterns-list">';
      wuxingData.patterns.forEach(function(pattern) {
        var patternWx = pattern.type.charAt(0);
        var wxColor = wuxingColors[patternWx] || { bg: '#666' };
        html += '<div class="wuxing-pattern-tag" style="background:' + wxColor.bg + ';">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (wuxingData.trend && wuxingData.trend.prediction !== '-') {
      var predWx = wuxingData.trend.prediction;
      var predColor = wuxingColors[predWx] || wuxingColors['金'];
      html += '<div class="wuxing-trend-section" data-action="showWuxingBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="wuxing-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="wuxing-trend-prediction">';
      html += '<span class="trend-result" style="background:' + predColor.bg + ';font-size:18px;font-weight:700;padding:4px 16px;border-radius:6px;color:#fff;">' + predWx + '</span>';
      html += '<span class="trend-confidence">' + wuxingData.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (wuxingData.trend.reason) {
        html += '<div class="wuxing-trend-reason">' + wuxingData.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  showWuxingBacktestModal: function(backtestData) {
    var existingModal = document.getElementById('wuxingBacktestModal');
    if (existingModal) {
      existingModal.remove();
    }

    var overlay = document.createElement('div');
    overlay.id = 'wuxingBacktestModal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;opacity:0;animation:fadeIn 0.25s ease forwards;';

    var html = '';
    html += '<div style="background:var(--card);border-radius:16px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.3);transform:scale(0.95);animation:scaleIn 0.25s ease forwards;">';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0;">📊 五行回测追踪</h3>';
    html += '<button id="closeWuxingBacktestBtn" style="background:none;border:none;font-size:24px;color:var(--sub-text);cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">';
    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">总测试</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--text);">' + backtestData.totalTests + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(167,139,250,0.12);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中</div>';
    html += '<div style="font-size:20px;font-weight:700;color:#A78BFA;">' + backtestData.totalHits + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(10,132,255,0.12);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中率</div>';
    html += '<div style="font-size:20px;font-weight:700;color:var(--primary);">' + backtestData.totalHitRate + '%</div>';
    html += '</div>';
    html += '</div>';

    if (backtestData.currentStreak > 0) {
      html += '<div style="background:linear-gradient(135deg, rgba(167,139,250,0.15), rgba(167,139,250,0.08));border-left:3px solid #A78BFA;padding:10px 12px;border-radius:8px;margin-bottom:16px;">';
      html += '<div style="font-size:12px;color:var(--sub-text);">当前连中</div>';
      html += '<div style="font-size:22px;font-weight:700;color:#A78BFA;">' + backtestData.currentStreak + ' 期 🔥</div>';
      html += '</div>';
    }

    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px;">最近 ' + backtestData.recentTests + ' 期详情</div>';

    html += '<div style="display:flex;flex-direction:column;gap:6px;">';
    backtestData.details.forEach(function(item) {
      var hitClass = item.isHit ? 'background:rgba(167,139,250,0.12);color:#A78BFA;' : 'background:rgba(255,69,58,0.12);color:#FF453A;';
      var hitIcon = item.isHit ? '✓' : '✗';
      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;' + hitClass + '">';
      html += '<span style="font-size:12px;font-weight:600;">' + item.expect + '期</span>';
      html += '<span style="font-size:14px;font-weight:700;">' + item.actualNumber + '</span>';
      html += '<span style="font-size:12px;font-weight:600;">预测:' + item.predictedWuxing + '</span>';
      html += '<span style="font-size:12px;font-weight:600;">实际:' + item.actualWuxing + '</span>';
      html += '<span style="font-size:16px;font-weight:700;">' + hitIcon + '</span>';
      html += '</div>';
    });
    html += '</div>';
    html += '</div>';

    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-top:12px;">';
    html += '<div style="font-size:11px;color:var(--sub-text);line-height:1.5;">';
    html += '• 最近 ' + backtestData.recentTests + ' 期命中 <strong>' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>';
    html += '• 基于五行趋势预测算法回测<br>';
    html += '• 数据仅供参考，不构成投资建议';
    html += '</div>';
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;

    document.body.appendChild(overlay);

    var closeBtn = document.getElementById('closeWuxingBacktestBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      });
    }

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      }
    });
  },



  renderZoneRecommend: function(zodiacList, nextExpect) {
    var container = document.getElementById('giongRecommendPanel');
    if (!container) return;

    if (!zodiacList || !zodiacList.length) {
      container.innerHTML = '';
      return;
    }

    var title = '区域综合推荐';
    if (nextExpect) title = '第' + nextExpect + '期推荐';

    var html = '<div class="analysis-section-title">' + title + '</div>';
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

      html += '<div class="zodiac-static-card ' + cardClass + '">';
      html += '<div class="zodiac-static-rank">' + rankNum + '</div>';
      html += '<div class="zodiac-static-emoji">' + emoji + '</div>';
      html += '<div class="zodiac-static-name">' + zodiac + '</div>';
      html += '</div>';
    });
    html += '</div>';
    container.innerHTML = html;
  },

  renderZoneBacktest: function(summary) {
    var container = document.getElementById('giongBacktestPanel');
    if (!container) return;

    if (!summary || !summary.total) {
      container.innerHTML = '<div class="empty-tip">暂无回测数据</div>';
      return;
    }

    var hitClass = summary.hitRate >= 70 ? 'backtest-rate-high' : (summary.hitRate >= 40 ? 'backtest-rate-mid' : 'backtest-rate-low');

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

    html += '<div class="backtest-records">';
    var recentRecords = summary.records.slice(0, 8);
    recentRecords.forEach(function(r) {
      var hitIcon = r.hit ? '✅' : '❌';
      var hitText = r.hit ? '第' + r.hitRank + '名命中' : '未命中';
      var hitRowClass = r.hit ? 'backtest-hit' : 'backtest-miss';
      var top6Text = r.top6.join(' ');
      html += '<div class="backtest-record-row ' + hitRowClass + '">';
      html += '<div class="backtest-record-period">' + r.expect + '期</div>';
      html += '<div class="backtest-record-predict">预测：' + top6Text + '</div>';
      html += '<div class="backtest-record-result">实际：<b>' + r.actualZodiac + '</b> ' + hitIcon + ' ' + hitText + '</div>';
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

  renderUltimateAlgorithm: function(data) {
    var resultContainer = document.getElementById('ultimateResultContainer');
    var expectDisplay = document.getElementById('ultimateExpectDisplay');

    if (expectDisplay) {
      if (data && data.nextExpect) {
        expectDisplay.textContent = '第' + data.nextExpect + '期';
      } else {
        expectDisplay.textContent = '';
      }
    }

    if (!data) {
      if (resultContainer) resultContainer.innerHTML = '<div class="empty-tip">暂无历史数据，请先刷新数据</div>';
      return;
    }

    if (data.insufficient) {
      if (resultContainer) resultContainer.innerHTML = '<div class="empty-tip">数据不足，无法生成推荐</div>';
      return;
    }

    var report = data.report;
    if (!report) {
      if (resultContainer) resultContainer.innerHTML = '<div class="empty-tip">算法计算异常</div>';
      return;
    }

    if (report.currentStage === '数据不足无法判断') {
      var adviceText = report.cycleStatus && report.cycleStatus.advice ? report.cycleStatus.advice : '历史数据不足，无法准确判断周期';
      if (resultContainer) resultContainer.innerHTML = '<div class="empty-tip">' + adviceText + '</div>';
      return;
    }

    var stageNames = {
      'V1稳定运行期': 'V1冷号周期',
      'V2稳定运行期': 'V2热号周期',
      '过渡混沌期': '过渡混沌期',
      '数据不足无法判断': '数据不足'
    };

    var riskNames = {
      '低风险': '✅ 低风险',
      '中风险': '⚠️ 中风险',
      '极高风险': '🚨 极高风险',
      '未知风险': '❓ 未知风险'
    };

    var html = '';
    html += '<div class="db-result-container">';

    var adaptiveInfo = data.adaptiveInfo || {};
    var mainCount = adaptiveInfo.mainCount || 5;
    var backupCount = adaptiveInfo.backupCount || 3;
    var isAdaptive = adaptiveInfo.isAdaptive || false;

    if (report.currentStage === '过渡混沌期') {
      html += '<div class="db-main-section">';
      html += '<div class="db-section-label">过渡期推荐</div>';
      if (isAdaptive) {
        html += '<div class="adaptive-badge">自适应模式</div>';
      }
      html += '<div class="db-number-grid" id="ultimateMainGrid">';
      if (data.numbers) {
        data.numbers.forEach(function(item, idx) {
          var rank = idx + 1;
          var rankClass = rank === 1 ? 'card-rank-1' : (rank === 2 ? 'card-rank-2' : (rank === 3 ? 'card-rank-3' : 'card-rank-other'));
          var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
          html += '<div class="db-card-item ' + rankClass + '">';
          html += '<div class="db-rank-badge">' + rank + '</div>';
          html += '<div class="db-card-emoji">' + emoji + '</div>';
          html += '<div class="db-card-name">' + item.zodiac + '</div>';
          html += '</div>';
        });
      }
      html += '</div></div>';

      if (data.alternative && data.alternative.length) {
        html += '<div class="db-divider"></div>';
        html += '<div class="db-backup-section">';
        html += '<div class="db-section-label">备选 ' + data.alternative.length + ' 码</div>';
        html += '<div class="db-number-grid" id="ultimateBackupGrid">';
        data.alternative.forEach(function(item, idx) {
          var rank = idx + 1;
          var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
          html += '<div class="db-card-item">';
          html += '<div class="db-rank-badge">' + rank + '</div>';
          html += '<div class="db-card-emoji">' + emoji + '</div>';
          html += '<div class="db-card-name">' + item.zodiac + '</div>';
          html += '</div>';
        });
        html += '</div></div></div>';
      }
    } else {
      html += '<div class="db-main-section">';
      html += '<div class="db-section-label">主推 4 码</div>';
      if (isAdaptive) {
        html += '<div class="adaptive-badge">自适应模式</div>';
      }
      html += '<div class="db-number-grid" id="ultimateMainGrid">';
      if (data.numbers) {
        data.numbers.forEach(function(item, idx) {
          var rank = idx + 1;
          var rankClass = rank === 1 ? 'card-rank-1' : (rank === 2 ? 'card-rank-2' : (rank === 3 ? 'card-rank-3' : 'card-rank-other'));
          var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
          html += '<div class="db-card-item ' + rankClass + '">';
          html += '<div class="db-rank-badge">' + rank + '</div>';
          html += '<div class="db-card-emoji">' + emoji + '</div>';
          html += '<div class="db-card-name">' + item.zodiac + '</div>';
          html += '</div>';
        });
      }
      html += '</div></div>';

      if (data.alternative && data.alternative.length) {
        html += '<div class="db-divider"></div>';
        html += '<div class="db-backup-section">';
        html += '<div class="db-section-label">备选 ' + data.alternative.length + ' 码</div>';
        html += '<div class="db-number-grid" id="ultimateBackupGrid">';
        data.alternative.forEach(function(item, idx) {
          var rank = idx + 1;
          var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
          html += '<div class="db-card-item">';
          html += '<div class="db-rank-badge">' + rank + '</div>';
          html += '<div class="db-card-emoji">' + emoji + '</div>';
          html += '<div class="db-card-name">' + item.zodiac + '</div>';
          html += '</div>';
        });
        html += '</div></div></div>';
      }
    }

    html += '</div>';

    html += '<div class="db-miss-container">';
    html += '<div class="db-miss-section-label">周期状态</div>';
    html += '<div class="db-miss-grid">';

    var stageInfo = report.cycleStatus;
    html += '<div class="db-miss-item" style="grid-column: span 2;">';
    html += '<div class="db-miss-zodiac">' + (stageNames[report.currentStage] || report.currentStage) + '</div>';
    html += '<div class="db-miss-count"><span>风险等级</span></div>';
    html += '<span class="db-miss-tag ' + (report.riskLevel === '低风险' ? 'miss-hot' : (report.riskLevel === '极高风险' ? 'miss-deep' : 'miss-warm')) + '">' + (riskNames[report.riskLevel] || report.riskLevel) + '</span>';
    html += '</div>';

    if (stageInfo && stageInfo.v1MainCount !== undefined) {
      html += '<div class="db-miss-item">';
      html += '<div class="db-miss-zodiac">V1出号</div>';
      html += '<div class="db-miss-count">' + stageInfo.v1MainCount + '次</div>';
      html += '</div>';
      html += '<div class="db-miss-item">';
      html += '<div class="db-miss-zodiac">V2出号</div>';
      html += '<div class="db-miss-count">' + stageInfo.v2MainCount + '次</div>';
      html += '</div>';
    }

    html += '</div></div>';

    if (resultContainer) resultContainer.innerHTML = html;
  },

  /**
   * 渲染未推荐生肖卡片（综合 v1/v2/终极 三方推荐后剩下的生肖）
   * 挂载到 #ultimateResultContainer 所在 .card-body 末尾
   * @param {Array} unrecommended - 未推荐生肖列表 [{zodiac, emoji}, ...]
   */
  renderUnrecommendedZodiacs: function(unrecommended) {
    // 找到终极算法卡的 .card-body（不修改 index.html 已有的 DOM，动态挂载）
    var ultimateResultContainer = document.getElementById('ultimateResultContainer');
    if (!ultimateResultContainer) return;
    var cardBody = ultimateResultContainer.parentNode; // .card-body
    if (!cardBody) return;

    // 复用同一个容器，避免重复创建
    var panel = document.getElementById('unrecommendedZodiacPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'unrecommendedZodiacPanel';
      cardBody.appendChild(panel);
    }

    if (!unrecommended || !unrecommended.length) {
      // 全部被推荐或无数据
      panel.innerHTML =
        '<div class="unrec-card unrec-empty">' +
          '<div class="unrec-title">综合未推荐生肖</div>' +
          '<div class="unrec-empty-tip">全部生肖均被推荐（或数据不足）</div>' +
        '</div>';
      return;
    }

    var html = '<div class="unrec-card">';
    html += '<div class="unrec-title">综合未推荐生肖（' + unrecommended.length + '个）</div>';
    html += '<div class="unrec-grid">';
    unrecommended.forEach(function(item) {
      var emoji = item.emoji || ZodiacPrediction.getZodiacEmoji(item.zodiac);
      html += '<div class="unrec-item">';
      html += '<span class="unrec-emoji">' + emoji + '</span>';
      html += '<span class="unrec-name">' + item.zodiac + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
    panel.innerHTML = html;
  },

  renderUltimateBacktest: function(summary, currentBackupCount) {
    var container = document.getElementById('ultimateBacktestContainer');
    if (!container) return;

    if (!summary || !summary.total) {
      container.innerHTML = '';
      return;
    }

    var hitClass = summary.hitRate >= 70 ? 'backtest-rate-high' : (summary.hitRate >= 40 ? 'backtest-rate-mid' : 'backtest-rate-low');
    var totalHitClass = summary.totalHitRate >= 60 ? 'backtest-rate-high' : (summary.totalHitRate >= 35 ? 'backtest-rate-mid' : 'backtest-rate-low');
    var adaptiveState = BusinessUltimate.getAdaptiveState();

    var actualMainCount = 4;
    var actualBackupCount = currentBackupCount || adaptiveState.currentBackupCount || 3;

    var html = '<div class="backtest-summary">';
    html += '<div class="backtest-summary-title">终极算法回测追踪</div>';

    html += '<div class="backtest-adaptive-info">';
    html += '<span class="adaptive-badge-small">🔄 自适应模式</span>';
    html += '<span>当前推荐: 主推' + actualMainCount + ' + 备选' + actualBackupCount + '</span>';
    html += '</div>';

    var detailHtml = '';

    detailHtml += '<div class="backtest-section-group">';
    detailHtml += '<div class="backtest-section-title">主推 4 码</div>';
    detailHtml += '<div class="backtest-summary-row">';
    detailHtml += '<div class="backtest-stat">';
    detailHtml += '<span class="backtest-stat-label">命中</span>';
    detailHtml += '<span class="backtest-stat-value">' + summary.hits + '次</span>';
    detailHtml += '</div>';
    detailHtml += '<div class="backtest-stat">';
    detailHtml += '<span class="backtest-stat-label">命中率</span>';
    detailHtml += '<span class="backtest-stat-value ' + hitClass + '">' + summary.hitRate + '%</span>';
    detailHtml += '</div>';
    detailHtml += '</div>';
    detailHtml += '<div class="backtest-breakdown">';
    detailHtml += '<span class="backtest-breakdown-item">🥇No.1：' + summary.top1Hits + '次</span>';
    detailHtml += '<span class="backtest-breakdown-item">🥈No.2：' + summary.top2Hits + '次</span>';
    detailHtml += '<span class="backtest-breakdown-item">🥉No.3：' + summary.top3Hits + '次</span>';
    detailHtml += '</div>';
    detailHtml += '</div>';

    if (summary.backupHits !== undefined) {
      detailHtml += '<div class="backtest-section-group">';
      detailHtml += '<div class="backtest-section-title">备选区 (补救)</div>';
      detailHtml += '<div class="backtest-summary-row">';
      detailHtml += '<div class="backtest-stat">';
      detailHtml += '<span class="backtest-stat-label">补救命中</span>';
      detailHtml += '<span class="backtest-stat-value">' + summary.backupHits + '次</span>';
      detailHtml += '</div>';
      detailHtml += '<div class="backtest-stat">';
      detailHtml += '<span class="backtest-stat-label">补救率</span>';
      detailHtml += '<span class="backtest-stat-value backtest-rate-mid">' + summary.backupHitRate + '%</span>';
      detailHtml += '</div>';
      detailHtml += '</div>';
      if (summary.backupTop1Hits > 0) {
        detailHtml += '<div class="backtest-breakdown">';
        detailHtml += '<span class="backtest-breakdown-item">备选No.1：' + summary.backupTop1Hits + '次</span>';
        detailHtml += '</div>';
      }
      detailHtml += '</div>';
    }

    if (summary.missTotalNotInRecommend !== undefined || summary.missInBlackList !== undefined) {
      var totalMiss = summary.total - (summary.totalHits || summary.hits);
      detailHtml += '<div class="backtest-miss-analysis">';
      detailHtml += '<div class="backtest-miss-title">未命中原因分析（基于主推+备选）：</div>';
      if (totalMiss > 0) {
        var missBlackPct = Math.round((summary.missInBlackList || 0) / totalMiss * 100);
        var missNotRecPct = Math.round((summary.missTotalNotInRecommend || 0) / totalMiss * 100);
        detailHtml += '<div class="backtest-miss-row"><span>因降权错失:</span><span>' + (summary.missInBlackList || 0) + '次 (' + missBlackPct + '%)</span></div>';
        detailHtml += '<div class="backtest-miss-row"><span>完全未推荐:</span><span>' + (summary.missTotalNotInRecommend || 0) + '次 (' + missNotRecPct + '%)</span></div>';
      } else {
        detailHtml += '<div class="backtest-miss-row"><span>✅ 全部命中！</span><span></span></div>';
      }
      detailHtml += '</div>';
    }

    if (summary.totalHits !== undefined) {
      html += '<div class="backtest-section-group backtest-total-highlight" data-action="showBacktestDetail" style="cursor:pointer;">';
      html += '<div class="backtest-section-title">📊 总计 (主推+备选) <span style="font-size:11px;color:#999;margin-left:8px;">点击查看详情 ▼</span></div>';
      html += '<div class="backtest-summary-row">';
      html += '<div class="backtest-stat">';
      html += '<span class="backtest-stat-label">总命中</span>';
      html += '<span class="backtest-stat-value">' + summary.totalHits + '次</span>';
      html += '</div>';
      html += '<div class="backtest-stat">';
      html += '<span class="backtest-stat-label">总命中率</span>';
      html += '<span class="backtest-stat-value ' + totalHitClass + '">' + summary.totalHitRate + '%</span>';
      html += '</div>';
      html += '</div>';
      html += '<div class="backtest-breakdown">';
      html += '<span class="backtest-breakdown-item">🥇总No.1：' + (summary.totalTop1Hits || 0) + '次</span>';
      html += '<span class="backtest-breakdown-item">🥈总前2：' + (summary.totalTop2Hits || 0) + '次</span>';
      html += '<span class="backtest-breakdown-item">🥉总前3：' + (summary.totalTop3Hits || 0) + '次</span>';
      html += '</div>';
      html += '</div>';
    }

    html += '</div>';

    html += '<div id="backtestDetailModal" class="backtest-detail-modal" style="display:none;">';
    html += '<div class="backtest-modal-overlay" data-action="closeBacktestDetail"></div>';
    html += '<div class="backtest-modal-content">';
    html += '<div class="backtest-modal-header">';
    html += '<h3>回测详情分析</h3>';
    html += '<span class="backtest-modal-close" data-action="closeBacktestDetail">✕</span>';
    html += '</div>';
    html += '<div class="backtest-modal-body">';
    html += detailHtml;
    html += '</div>';
    html += '</div>';
    html += '</div>';

    html += '</div>';

    html += '<div class="backtest-records">';
    var recentRecords = summary.records.slice(0, 15);
    recentRecords.forEach(function(r) {
      var hitIcon = '❌';
      var hitText = '未命中';
      var hitRowClass = 'backtest-miss';

      if (r.hit) {
        hitIcon = '✅';
        hitText = '主推第' + r.hitRank + '名';
        hitRowClass = 'backtest-hit';
      } else if (r.backupHit) {
        hitIcon = '🔶';
        hitText = '备选第' + r.backupHitRank + '名 (总第' + r.totalHitRank + ')';
        hitRowClass = 'backtest-backup-hit';
      }

      var topNText = r.topN.join(' ');
      var backupText = r.backupTopN && r.backupTopN.length > 0 ? ' 备选: ' + r.backupTopN.join(' ') : '';

      var stageTag = r.stage ? '<span class="backtest-stage-tag">' + r.stage.replace('稳定运行期', '').replace('过渡混沌期', '过渡') + '</span>' : '';
      var blackInfo = r.blackListCount > 0 ? '<span class="backtest-black-info">降权' + r.blackListCount + '个</span>' : '';

      html += '<div class="backtest-record-row ' + hitRowClass + '">';
      html += '<div class="backtest-record-period">' + r.expect + '期 ' + stageTag + '</div>';
      html += '<div class="backtest-record-predict">主推：' + topNText + backupText + ' ' + blackInfo + '</div>';
      html += '<div class="backtest-record-result">实际：<b>' + r.actualZodiac + '</b> ' + hitIcon + ' ' + hitText + '</div>';
      html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  },

  renderUltimateBacktestEmpty: function() {
    var container = document.getElementById('ultimateBacktestContainer');
    if (!container) return;
    container.innerHTML = '<div class="empty-tip">回测计算中…</div>';
  },

  initFreqSwiper: function() {
    ViewZodiacPrediction._createSwiper({
      wrapperId: 'freqSwiperWrapper', cardSelector: '.freq-card',
      dotsId: 'freqSwiperDots', dotClass: 'freq-swiper-dot',
      updateRef: 'freqSwiperUpdate', dataAttr: ['data-freq-current', '0']
    });
  },

  renderLatestColorStats: function(colorData) {
    var container = document.getElementById('latestColorStatsPanel');
    if (!container) return;

    if (!colorData) {
      container.innerHTML = '';
      return;
    }

    var colorColors = {
      '红': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C', light: 'rgba(239,68,68,0.12)' },
      '蓝': { bg: 'linear-gradient(135deg, #3B82F6, #2563EB)', text: '#1D4ED8', light: 'rgba(59,130,246,0.12)' },
      '绿': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D', light: 'rgba(34,197,94,0.12)' }
    };

    var html = '';
    html += '<div class="color-analysis-card">';
    html += '<div class="color-analysis-header">';
    html += '<div class="color-analysis-title">最近' + colorData.period + '期波色分析</div>';
    html += '</div>';

    html += '<div class="color-analysis-content">';

    html += '<div class="color-sequence-row">';
    var reversedSequence = colorData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var clColor = colorColors[item.color] || colorColors['红'];
      html += '<span class="color-seq-item" style="background:' + clColor.bg + ';color:#fff;">' + item.color + '</span>';
    });
    html += '</div>';

    html += '<div class="color-stats-grid">';
    var colorOrder = ['红', '蓝', '绿'];
    colorOrder.forEach(function(cl) {
      var count = colorData.count[cl] || 0;
      var percent = colorData.period > 0 ? Math.round((count / colorData.period) * 100) : 0;
      var clColor = colorColors[cl];
      html += '<div class="color-stat-item">';
      html += '<div class="color-stat-header" style="color:' + clColor.text + ';border-left:3px solid ' + clColor.text + ';">';
      html += '<span class="color-stat-name">' + cl + '</span>';
      html += '<span class="color-stat-count">' + count + '期</span>';
      html += '</div>';
      html += '<div class="color-stat-bar-bg">';
      html += '<div class="color-stat-bar-fill" style="width:' + percent + '%;background:' + clColor.bg + ';"></div>';
      html += '</div>';
      html += '<div class="color-stat-percent" style="color:' + clColor.text + ';">' + percent + '%</div>';
      html += '</div>';
    });
    html += '</div>';

    if (colorData.patterns && colorData.patterns.length > 0) {
      html += '<div class="color-patterns-section">';
      html += '<div class="color-patterns-title">规律特征</div>';
      html += '<div class="color-patterns-list">';
      colorData.patterns.forEach(function(pattern) {
        var patternCl = pattern.type.charAt(0);
        var clColor = colorColors[patternCl] || { bg: '#666' };
        html += '<div class="color-pattern-tag" style="background:' + clColor.bg + ';">';
        html += pattern.type;
        if (pattern.count > 1) {
          html += '<span class="pattern-count">' + pattern.count + '次</span>';
        }
        html += '</div>';
      });
      html += '</div>';
      html += '</div>';
    }

    if (colorData.trend && colorData.trend.prediction !== '-') {
      var predCl = colorData.trend.prediction;
      var predColor = colorColors[predCl] || colorColors['红'];
      html += '<div class="color-trend-section" data-action="showColorBacktest" style="cursor:pointer;transition:opacity 0.2s;" title="点击查看回测追踪">';
      html += '<div class="color-trend-label">趋势预测 <span style="font-size:10px;opacity:0.6;">📊 点击查看</span></div>';
      html += '<div class="color-trend-prediction">';
      html += '<span class="trend-result" style="background:' + predColor.bg + ';font-size:18px;font-weight:700;padding:4px 16px;border-radius:6px;color:#fff;">' + predCl + '</span>';
      html += '<span class="trend-confidence">' + colorData.trend.confidence + '%可信度</span>';
      html += '</div>';
      if (colorData.trend.reason) {
        html += '<div class="color-trend-reason">' + colorData.trend.reason + '</div>';
      }
      html += '</div>';
    }

    html += '</div>';
    html += '</div>';

    container.innerHTML = html;
  },

  showColorBacktestModal: function(backtestData) {
    var existingModal = document.getElementById('colorBacktestModal');
    if (existingModal) {
      existingModal.remove();
    }

    var overlay = document.createElement('div');
    overlay.id = 'colorBacktestModal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;opacity:0;animation:fadeIn 0.25s ease forwards;';

    var colorColors = {
      '红': { bg: '#EF4444', text: '#fff' },
      '蓝': { bg: '#3B82F6', text: '#fff' },
      '绿': { bg: '#22C55E', text: '#fff' }
    };

    var html = '';
    html += '<div style="background:var(--card);border-radius:16px;width:100%;max-width:400px;max-height:80vh;overflow-y:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.3);transform:scale(0.95);animation:scaleIn 0.25s ease forwards;">';

    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0;">📊 波色回测追踪</h3>';
    html += '<button id="closeColorBacktestBtn" style="background:none;border:none;font-size:24px;color:var(--sub-text);cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>';
    html += '</div>';

    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">';
    html += '<div style="background:rgba(239,68,68,0.1);padding:10px;border-radius:8px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">总测试</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--text);">' + backtestData.totalTests + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(34,197,94,0.1);padding:10px;border-radius:8px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#16a34a;">' + backtestData.totalHits + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(59,130,246,0.1);padding:10px;border-radius:8px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中率</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#2563eb;">' + backtestData.totalHitRate + '%</div>';
    html += '</div>';
    html += '</div>';

    html += '<div style="display:flex;gap:10px;margin-bottom:16px;padding:12px;background:rgba(255,255,255,0.04);border-radius:8px;">';
    html += '<div style="flex:1;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);">近10期</div>';
    html += '<div style="font-size:16px;font-weight:700;color:var(--text);">' + backtestData.recentHitRate + '%</div>';
    html += '</div>';
    html += '<div style="flex:1;text-align:center;border-left:1px solid var(--border);">';
    html += '<div style="font-size:11px;color:var(--sub-text);">连续命中</div>';
    html += '<div style="font-size:16px;font-weight:700;color:#16a34a;">' + backtestData.currentStreak + '</div>';
    html += '</div>';
    html += '</div>';

    html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px;">详细记录</div>';
    html += '<div style="max-height:300px;overflow-y:auto;">';
    backtestData.details.forEach(function(detail) {
      var actualClColor = colorColors[detail.actualColor] || { bg: '#666', text: '#fff' };
      var predClColor = colorColors[detail.predictedColor] || { bg: '#666', text: '#fff' };
      var hitBg = detail.isHit ? 'rgba(34,197,94,0.12)' : 'rgba(239,68,68,0.08)';
      var hitText = detail.isHit ? '#16a34a' : '#dc2626';
      var hitLabel = detail.isHit ? '✓ 命中' : '✗ 未中';

      html += '<div style="display:flex;align-items:center;gap:8px;padding:8px;margin-bottom:6px;background:var(--bg-secondary);border-radius:6px;">';
      html += '<div style="flex:1;font-size:12px;color:var(--sub-text);">' + detail.expect + '</div>';
      html += '<div style="font-size:14px;font-weight:700;color:var(--text);min-width:28px;text-align:center;">' + detail.actualNumber + '</div>';
      html += '<span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;background:' + actualClColor.bg + ';color:' + actualClColor.text + ';">' + detail.actualColor + '</span>';
      html += '<span style="font-size:10px;color:var(--sub-text);">→</span>';
      html += '<span style="font-size:12px;font-weight:600;padding:2px 8px;border-radius:4px;background:' + predClColor.bg + ';color:' + predClColor.text + ';">' + detail.predictedColor + '</span>';
      html += '<span style="font-size:11px;font-weight:600;padding:2px 6px;border-radius:4px;background:' + hitBg + ';color:' + hitText + ';">' + hitLabel + '</span>';
      html += '</div>';
    });
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    document.getElementById('closeColorBacktestBtn').addEventListener('click', function() {
      overlay.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(function() { overlay.remove(); }, 200);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      }
    });
  },

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
    html += ViewZodiacPrediction._renderSizeContent(sizeData);
    html += '</div>';

    html += '<div class="combined-panel" id="panel-oddeven">';
    html += ViewZodiacPrediction._renderOddEvenContent(oddEvenData);
    html += '</div>';

    html += '<div class="combined-panel" id="panel-wuxing">';
    html += ViewZodiacPrediction._renderWuxingContent(wuxingData);
    html += '</div>';

    html += '<div class="combined-panel" id="panel-color">';
    html += ViewZodiacPrediction._renderColorContent(colorData);
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

  _renderSizeContent: function(sizeData) {
    if (!sizeData) return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';

    var html = '';
    html += '<div class="combined-sequence-row">';
    var reversedSequence = sizeData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var sizeClass = item.size === '大' ? 'size-big' : 'size-small';
      html += '<span class="combined-seq-item ' + sizeClass + '">' + item.size + '</span>';
    });
    html += '</div>';

    html += '<div class="combined-stats-row">';
    html += '<div class="combined-stat"><span class="stat-label stat-big">大</span><span class="stat-value">' + (sizeData.bigCount || 0) + '</span><span class="stat-percent">' + (sizeData.bigPercent || 0) + '%</span></div>';
    html += '<div class="combined-stat"><span class="stat-label stat-small">小</span><span class="stat-value">' + (sizeData.smallCount || 0) + '</span><span class="stat-percent">' + (sizeData.smallPercent || 0) + '%</span></div>';
    html += '</div>';

    if (sizeData.patterns && sizeData.patterns.length > 0) {
      html += '<div class="combined-patterns">';
      sizeData.patterns.forEach(function(p) { html += '<span class="pattern-tag">' + p.type.replace('大小', '') + p.count + '</span>'; });
      html += '</div>';
    }

    if (sizeData.trend && sizeData.trend.prediction !== '-') {
      var trendClass = sizeData.trend.prediction === '大' ? 'trend-big' : 'trend-small';
      html += '<div class="combined-trend" data-action="showSizeBacktest" style="cursor:pointer;">';
      html += '<span class="trend-predict ' + trendClass + '">' + sizeData.trend.prediction + '</span>';
      html += '<span class="trend-conf">' + sizeData.trend.confidence + '%</span>';
      if (sizeData.trend.reason) html += '<span class="trend-reason">' + sizeData.trend.reason + '</span>';
      html += '</div>';
    }

    return html;
  },

  _renderOddEvenContent: function(oddEvenData) {
    if (!oddEvenData) return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';

    var html = '';
    html += '<div class="combined-sequence-row">';
    var reversedSequence = oddEvenData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var typeClass = item.type === '单' ? 'type-odd' : 'type-even';
      html += '<span class="combined-seq-item oddeven-' + typeClass + '">' + item.type + '</span>';
    });
    html += '</div>';

    html += '<div class="combined-stats-row">';
    html += '<div class="combined-stat"><span class="stat-label stat-odd">单</span><span class="stat-value">' + (oddEvenData.oddCount || 0) + '</span><span class="stat-percent">' + (oddEvenData.oddPercent || 0) + '%</span></div>';
    html += '<div class="combined-stat"><span class="stat-label stat-even">双</span><span class="stat-value">' + (oddEvenData.evenCount || 0) + '</span><span class="stat-percent">' + (oddEvenData.evenPercent || 0) + '%</span></div>';
    html += '</div>';

    if (oddEvenData.patterns && oddEvenData.patterns.length > 0) {
      html += '<div class="combined-patterns">';
      oddEvenData.patterns.forEach(function(p) { html += '<span class="pattern-tag">' + p.type.replace('单双', '') + p.count + '</span>'; });
      html += '</div>';
    }

    if (oddEvenData.trend && oddEvenData.trend.prediction !== '-') {
      var trendClass = oddEvenData.trend.prediction === '单' ? 'trend-odd' : 'trend-even';
      html += '<div class="combined-trend" data-action="showOddEvenBacktest" style="cursor:pointer;">';
      html += '<span class="trend-predict ' + trendClass + '">' + oddEvenData.trend.prediction + '</span>';
      html += '<span class="trend-conf">' + oddEvenData.trend.confidence + '%</span>';
      if (oddEvenData.trend.reason) html += '<span class="trend-reason">' + oddEvenData.trend.reason + '</span>';
      html += '</div>';
    }

    return html;
  },

  _renderWuxingContent: function(wuxingData) {
    if (!wuxingData) return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';

    var wuxingColors = { '金': '#FFD700', '木': '#22C55E', '水': '#0EA5E9', '火': '#EF4444', '土': '#A78BFA' };

    var html = '';
    html += '<div class="combined-sequence-row">';
    var reversedSequence = wuxingData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var wxColor = wuxingColors[item.wuxing] || '#999';
      html += '<span class="combined-seq-item wx-item" style="background:' + wxColor + ';color:#fff;">' + item.wuxing + '</span>';
    });
    html += '</div>';

    html += '<div class="combined-stats-grid">';
    ['金','木','水','火','土'].forEach(function(wx) {
      var count = wuxingData.count[wx] || 0;
      var percent = wuxingData.period > 0 ? Math.round((count / wuxingData.period) * 100) : 0;
      var color = wuxingColors[wx];
      html += '<div class="wx-stat"><span class="wx-name" style="color:' + color + '">' + wx + '</span><span class="wx-count">' + count + '</span><span class="wx-bar-bg"><span class="wx-bar-fill" style="width:' + percent + '%;background:' + color + ';"></span></span><span class="wx-pct">' + percent + '%</span></div>';
    });
    html += '</div>';

    if (wuxingData.patterns && wuxingData.patterns.length > 0) {
      html += '<div class="combined-patterns">';
      wuxingData.patterns.forEach(function(p) { 
        var pColor = wuxingColors[p.type.charAt(0)] || '#666';
        html += '<span class="pattern-tag" style="background:' + pColor + ';color:#fff;">' + p.type + p.count + '</span>'; 
      });
      html += '</div>';
    }

    if (wuxingData.trend && wuxingData.trend.prediction !== '-') {
      var predColor = wuxingColors[wuxingData.trend.prediction] || '#999';
      html += '<div class="combined-trend" data-action="showWuxingBacktest" style="cursor:pointer;">';
      html += '<span class="trend-predict wx-predict" style="background:' + predColor + ';color:#fff;">' + wuxingData.trend.prediction + '</span>';
      html += '<span class="trend-conf">' + wuxingData.trend.confidence + '%</span>';
      if (wuxingData.trend.reason) html += '<span class="trend-reason">' + wuxingData.trend.reason + '</span>';
      html += '</div>';
    }

    return html;
  },

  _renderColorContent: function(colorData) {
    if (!colorData) return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';

    var colorColors = { '红': '#EF4444', '蓝': '#3B82F6', '绿': '#22C55E' };

    var html = '';
    html += '<div class="combined-sequence-row">';
    var reversedSequence = colorData.sequence.slice().reverse();
    reversedSequence.forEach(function(item) {
      var clColor = colorColors[item.color] || '#999';
      html += '<span class="combined-seq-item cl-item" style="background:' + clColor + ';color:#fff;">' + item.color + '</span>';
    });
    html += '</div>';

    html += '<div class="combined-stats-grid">';
    ['红','蓝','绿'].forEach(function(cl) {
      var count = colorData.count[cl] || 0;
      var percent = colorData.period > 0 ? Math.round((count / colorData.period) * 100) : 0;
      var color = colorColors[cl];
      html += '<div class="cl-stat"><span class="cl-name" style="color:' + color + '">' + cl + '</span><span class="cl-count">' + count + '</span><span class="cl-bar-bg"><span class="cl-bar-fill" style="width:' + percent + '%;background:' + color + ';"></span></span><span class="cl-pct">' + percent + '%</span></div>';
    });
    html += '</div>';

    if (colorData.patterns && colorData.patterns.length > 0) {
      html += '<div class="combined-patterns">';
      colorData.patterns.forEach(function(p) { 
        var pColor = colorColors[p.type.charAt(0)] || '#666';
        html += '<span class="pattern-tag" style="background:' + pColor + ';color:#fff;">' + p.type + p.count + '</span>'; 
      });
      html += '</div>';
    }

    if (colorData.trend && colorData.trend.prediction !== '-') {
      var predColor = colorColors[colorData.trend.prediction] || '#999';
      html += '<div class="combined-trend" data-action="showColorBacktest" style="cursor:pointer;">';
      html += '<span class="trend-predict cl-predict" style="background:' + predColor + ';color:#fff;">' + colorData.trend.prediction + '</span>';
      html += '<span class="trend-conf">' + colorData.trend.confidence + '%</span>';
      if (colorData.trend.reason) html += '<span class="trend-reason">' + colorData.trend.reason + '</span>';
      html += '</div>';
    }

    return html;
  },

  predSwiperUpdate: null,
  freqSwiperUpdate: null,

  /**
   * 切换频率面板标签（符合分层规范：视图层负责DOM渲染）
   * @param {string} freqKey - 频率key
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
   * 切换预测面板标签（符合分层规范：视图层负责DOM渲染）
   * @param {string} predTab - 预测tab
   */
  switchPredTabUI: function(predTab) {
    document.querySelectorAll('#zodiacPredictionGrid .freq-tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.predTab === predTab);
    });
    document.querySelectorAll('#zodiacPredictionGrid .freq-panel').forEach(function(panel) {
      panel.style.display = panel.dataset.predPanel === predTab ? '' : 'none';
    });
  },

  /**
   * 切换回测详情弹窗显示状态（符合分层规范：视图层负责DOM渲染）
   * @param {boolean} show - 是否显示
   */
  toggleBacktestDetailModal: function(show) {
    var modal = document.getElementById('backtestDetailModal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
  },

  /**
   * 渲染区域变动追踪卡片
   * 显示每期开出生肖来自哪个区域，以及区域变动统计
   * @param {Object} changeData - calcZoneChangeTracking 返回的数据
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

    var zoneColors = {
      '封顶区': 'zone-peak',
      '降权区': 'zone-high',
      '过热区': 'zone-ovht',
      '热号区': 'zone-mid',
      '活跃区': 'zone-active',
      '穿插区': 'zone-low',
      '冷号区': 'zone-wait'
    };

    var html = '';
    html += '<div class="zone-change-card">';

    // 头部
    var wsLabel = (changeData.windowSize === 24) ? '24期' : (changeData.windowSize === 36 ? '36期' : '12期');
    html += '<div class="zone-change-header">';
    html += '<span class="zone-change-title">区域变动追踪（' + wsLabel + '）</span>';
    if (changeData.topZone && changeData.topCount > 0) {
      html += '<span class="zone-change-top-info">';
      html += '变动最多：<span class="freq-zone-tag ' + (zoneColors[changeData.topZone] || '') + '">' + changeData.topZone + '</span>';
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
      html += '<div class="zone-change-bar-fill ' + (zoneColors[item.zone] || '') + '" style="width:' + pct + '%;"></div>';
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
      var hiddenClass = (idx >= visibleCount && !preferExpanded) ? ' zone-change-hidden' : '';
      html += '<div class="zone-change-item ' + changeClass + hiddenClass + '">';
      html += '<span class="zone-change-expect">' + r.expect + '期</span>';
      html += '<span class="zone-change-zodiac">' + r.zodiac + '</span>';
      // 遗漏间隔
      var missText = r.missInterval > 0 ? '隔' + r.missInterval + '期' : (r.missInterval === -1 ? '首现' : '连开');
      html += '<span class="zone-change-miss">' + missText + '</span>';
      html += '<span class="zone-change-zone-tag ' + (zoneColors[r.prevZone] || '') + '">' + r.prevZone + '</span>';
      html += '<span class="zone-change-arrow">' + arrow + '</span>';
      html += '<span class="zone-change-zone-tag ' + (zoneColors[r.curZone] || '') + '">' + r.curZone + '</span>';
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
  }
};