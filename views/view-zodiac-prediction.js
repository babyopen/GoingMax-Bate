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
    html += '<div class="freq-swiper-container zodiac-prediction-swiper">';
    html += '<div class="freq-swiper-wrapper" id="zodiacPredSwiperWrapper">';

    var top6Cards = allCards.slice(0, 6);
    var bottom6Cards = allCards.slice(6, 12);

    html += '<div class="freq-card zodiac-pred-card">';
    html += '<div class="freq-card-title">推荐前6名</div>';
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

    html += '<div class="freq-card zodiac-pred-card">';
    html += '<div class="freq-card-title">推荐后6名</div>';
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
    html += '<div class="freq-swiper-dots" id="zodiacPredSwiperDots">';
    html += '<span class="freq-swiper-dot active" data-pred-index="0" data-action="switchPredCard"></span>';
    html += '<span class="freq-swiper-dot" data-pred-index="1" data-action="switchPredCard"></span>';
    html += '</div>';
    html += '</div>';

    grid.innerHTML = html;

    ViewZodiacPrediction.initPredSwiper();
  },

  _createSwiper: function(config) {
    var w = document.getElementById(config.wrapperId);
    if (!w || !w.offsetWidth) return;
    if (w.dataset.swiperInit) return;
    w.dataset.swiperInit = '1';
    var cards = w.querySelectorAll(config.cardSelector);
    if (!cards || !cards.length) return;
    var idx = config.initialIndex || 0;
    var total = cards.length;
    var sx = 0, cx = 0, dragging = false, lastT = 0;

    function slide(i, anim) {
      if (i < 0) i = 0; if (i >= total) i = total - 1;
      idx = i; w.style.transform = 'translateX(' + (-i * 100) + '%)';
      if (anim !== false) w.style.transition = '';
      var dc = document.getElementById(config.dotsId);
      if (dc) {
        var dots = dc.querySelectorAll('.' + config.dotClass);
        dots.forEach(function(d, di) { d.classList.toggle('active', di === idx); });
      }
    }

    var isTouchDevice = 'ontouchstart' in window;

    function start(e) {
      if (e.type === 'mousedown' && isTouchDevice) return;
      dragging = true; w.style.transition = 'none';
      sx = e.type === 'mousedown' ? e.clientX : e.touches[0].clientX;
      cx = sx; lastT = Date.now();
    }

    function move(e) {
      if (!dragging) return;
      if (e.type === 'touchmove') e.preventDefault();
      cx = e.type === 'mousemove' ? e.clientX : e.touches[0].clientX;
      lastT = Date.now();
      var d = sx - cx;
      w.style.transform = 'translateX(' + (-(idx * 100) - (d / w.offsetWidth * 100)) + '%)';
    }

    function end(e) {
      if (!dragging) return; dragging = false; w.style.transition = '';
      if (e.type === 'touchend' && e.changedTouches && e.changedTouches.length) {
        cx = e.changedTouches[0].clientX;
      }
      var d = sx - cx, ad = Math.abs(d);
      var cardW = w.offsetWidth / total;
      var th = cardW * 0.08, vel = ad / Math.max(Date.now() - lastT, 1);
      if (ad > th || (ad > cardW * 0.04 && vel > 0.3)) {
        if (d > 0 && idx < total - 1) slide(idx + 1);
        else if (d < 0 && idx > 0) slide(idx - 1);
        else slide(idx);
      } else slide(idx);
    }

    w.addEventListener('touchstart', start, { passive: true });
    w.addEventListener('touchmove', move, { passive: false });
    w.addEventListener('touchend', end);
    w.addEventListener('touchcancel', end);
    if (!isTouchDevice) {
      w.addEventListener('mousedown', start);
      w.addEventListener('mousemove', move);
      w.addEventListener('mouseup', end);
      w.addEventListener('mouseleave', end);
    }

    if (config.dataAttr) w.setAttribute(config.dataAttr[0], config.dataAttr[1]);
    ViewZodiacPrediction[config.updateRef] = slide;
    slide(idx);
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
      var panelMap = { predict: 'zodiacPredictPanel', giong: 'zodiacGiongPanel', db: 'zodiacDBPanel', ultimate: 'zodiacUltimatePanel' };
      panel.classList.toggle('active', panelId === panelMap[tab]);
    });
  },

  renderFrequencyRating: function(freqResult) {
    var grid = document.getElementById('giongFreqGrid');
    if (!grid) return;

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
      '顶峰区': 'zone-peak',
      '高频区': 'zone-high',
      '中频区': 'zone-mid',
      '低频区': 'zone-low',
      '等待区': 'zone-wait'
    };

    var zoneOrder = ['顶峰区', '高频区', '中频区', '低频区', '等待区'];

    var html = '';

    html += '<div class="freq-swiper-container">';
    html += '<div class="freq-swiper-wrapper" id="freqSwiperWrapper">';

    periods.forEach(function(period) {
      var data = freqResult[period.key];
      if (!data) {
        html += '<div class="freq-card"><div class="freq-card-title">' + period.label + '</div>';
        html += '<div class="empty-tip">数据不足</div></div>';
        return;
      }

      var storageKey = 'ZONE_PREV_ZONE_' + period.key;
      var appearPosKey = 'ZONE_APPEAR_POS_' + period.key;
      var lastCountKey = 'ZONE_LAST_COUNT_' + period.key;
      
      var prevZoneMap = {};
      var cachedPrev = Storage.get(storageKey);
      if (cachedPrev) prevZoneMap = cachedPrev;

      var lastAppearPosMap = {};
      var cachedAppear = Storage.get(appearPosKey);
      if (cachedAppear) lastAppearPosMap = cachedAppear;

      var lastCountMap = {};
      var cachedCount = Storage.get(lastCountKey);
      if (cachedCount) lastCountMap = cachedCount;

      var newZoneMap = {};
      var newAppearPosMap = {};
      var newCountMap = {};

      var grouped = {};
      zoneOrder.forEach(function(z) { grouped[z] = []; });
      data.forEach(function(item) {
        grouped[item.zone].push(item);
        newCountMap[item.zodiac] = item.count;
      });

      html += '<div class="freq-card">';
      html += '<div class="freq-card-title">' + period.label + '</div>';

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
          var currentZone = item.zone;
          var prevZone = prevZoneMap[item.zodiac] || currentZone;
          var lastCount = lastCountMap[item.zodiac];
          var currCount = item.count;
          var lastAppearPos = lastAppearPosMap[item.zodiac];
          
          var hasNewDraw = false;
          if (lastCount !== undefined && currCount > lastCount) {
            hasNewDraw = true;
            newAppearPosMap[item.zodiac] = prevZone;
          } else if (lastCount === undefined && currCount > 0) {
            newAppearPosMap[item.zodiac] = currentZone;
          } else if (!lastAppearPos) {
            newAppearPosMap[item.zodiac] = currentZone;
          }
          
          var appearPosForBadge = lastAppearPosMap[item.zodiac];
          if (!appearPosForBadge && newAppearPosMap[item.zodiac]) {
            appearPosForBadge = newAppearPosMap[item.zodiac];
          }
          if (!appearPosForBadge) {
            appearPosForBadge = currentZone;
          }
          
          var missClass = zoneColors[prevZone] || '';
          var badgeClass = zoneColors[appearPosForBadge] || '';
          newZoneMap[item.zodiac] = currentZone;

          var dropArrow = (item.willDrop) ? '<span class="drop-arrow">▼</span>' : '';
          html += '<div class="zone-zod-card">';
          html += '<div class="zod-card-count-badge ' + badgeClass + '">' + item.count + dropArrow + '</div>';
          html += '<div class="zod-card-name">' + item.zodiac + '</div>';
          html += '<div class="zod-card-stats">';
          html += '<span class="zod-card-miss ' + missClass + '">' + item.miss + '期</span>';
          html += '</div>';
          html += '</div>';
        });
        html += '</div>';
        html += '</div>';
      });

      html += '</div>';

      var changed = false;
      var oldKeys = Object.keys(prevZoneMap);
      var newKeys = Object.keys(newZoneMap);
      if (oldKeys.length !== newKeys.length) { changed = true; }
      else {
        for (var ki = 0; ki < newKeys.length; ki++) {
          if (prevZoneMap[newKeys[ki]] !== newZoneMap[newKeys[ki]]) { changed = true; break; }
        }
      }
      if (changed) Storage.set(storageKey, newZoneMap);
      
      Storage.set(appearPosKey, newAppearPosMap);
      Storage.set(lastCountKey, newCountMap);
      });

    html += '</div>';
    html += '<div class="freq-swiper-dots" id="freqSwiperDots">';
    periods.forEach(function(period, idx) {
      var activeClass = idx === 0 ? 'active' : '';
      html += '<span class="freq-swiper-dot ' + activeClass + '" data-freq-index="' + idx + '" data-action="switchFreqCard"></span>';
    });
    html += '</div>';
    html += '</div>';

    grid.innerHTML = html;
    
    ViewZodiacPrediction.initFreqSwiper();
  },

  renderZoneAnalysis: function(patternResult) {
    var container = document.getElementById('giongAnalysisPanel');
    if (!container) return;

    if (!patternResult) {
      container.innerHTML = '<div class="empty-tip">数据不足，无法进行历史概率分析（需至少25期）</div>';
      return;
    }

    var periods = [
      { key: 'p12', label: '基于12期滚动窗口' },
      { key: 'p24', label: '基于24期滚动窗口' },
      { key: 'p36', label: '基于36期滚动窗口' }
    ];

    var zoneColors = {
        '顶峰区': 'zone-peak',
        '高频区': 'zone-high',
        '中频区': 'zone-mid',
        '低频区': 'zone-low',
        '等待区': 'zone-wait'
      };
      var zoneLabels = ['等待区', '低频区', '中频区', '高频区', '顶峰区'];

    var html = '';
    html += '<div class="analysis-section-title">历史区域概率分析</div>';
    html += '<div class="analysis-desc">基于60期历史滚动：若生肖落入某区域，下一期开出的概率</div>';
    html += '<div class="zone-swiper-container">';
    html += '<div class="zone-swiper-wrapper" id="zoneSwiperWrapper">';

    var slideIndex = 0;
    periods.forEach(function(period) {
      var data = patternResult[period.key];
      if (!data) return;

      html += '<div class="freq-section" data-slide-index="' + slideIndex + '"><div class="freq-section-title">' + period.label + '</div>';
      slideIndex++;
      html += '<div class="freq-table-wrap"><table class="freq-table">';
      html += '<thead><tr><th>区域</th><th>样本量</th><th>下一期命中概率</th><th>强度</th></tr></thead>';
      html += '<tbody>';

      zoneLabels.forEach(function(zone) {
        var prob = data.zoneProb[zone] || 0;
        var records = (data.zoneRecords[zone] || []).length;

        var strengthBar;
        if (prob >= 18) strengthBar = '<span class="prob-bar prob-high">' + prob + '%</span>';
        else if (prob >= 12) strengthBar = '<span class="prob-bar prob-mid">' + prob + '%</span>';
        else if (prob >= 8) strengthBar = '<span class="prob-bar prob-low">' + prob + '%</span>';
        else strengthBar = '<span class="prob-bar prob-mini">' + prob + '%</span>';

        html += '<tr>';
        html += '<td><span class="freq-zone-tag ' + (zoneColors[zone] || '') + '">' + zone + '</span></td>';
        html += '<td>' + records + '</td>';
        html += '<td>' + strengthBar + '</td>';

        var strength;
        if (prob >= 18) strength = '🔥🔥🔥';
        else if (prob >= 12) strength = '🔥🔥';
        else if (prob >= 8) strength = '🔥';
        else strength = '—';

        html += '<td>' + strength + '</td>';
        html += '</tr>';
      });

      html += '</tbody></table></div></div>';
    });

    html += '</div>';
    html += '<div class="zone-swiper-dots" id="zoneSwiperDots">';
    for (var di = 0; di < slideIndex; di++) {
      var dotActiveClass = di === 0 ? 'active' : '';
      html += '<span class="zone-swiper-dot ' + dotActiveClass + '" data-zone-index="' + di + '" data-action="switchZoneAnalysis"></span>';
    }
    html += '</div>';
    html += '</div>';

    html += '<div class="analysis-conclusion">';
    html += '<div class="analysis-conclusion-title">分析结论</div>';

    var p12Data = patternResult.p12;
    if (p12Data) {
      var bestZone = '';
      var bestProb = 0;
      var worstZone = '';
      var worstProb = 100;
      zoneLabels.forEach(function(z) {
        var p = p12Data.zoneProb[z] || 0;
        if (p > bestProb) { bestProb = p; bestZone = z; }
        if (p < worstProb) { worstProb = p; worstZone = z; }
      });
      html += '<div class="analysis-item">🔝 最高出现概率区域：<b>' + bestZone + '</b>（' + bestProb + '%）</div>';
      html += '<div class="analysis-item">🔻 最低出现概率区域：<b>' + worstZone + '</b>（' + worstProb + '%）</div>';
    }

    html += '</div>';

    container.innerHTML = html;
    
    ViewZodiacPrediction.initZoneSwiper();
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

  renderDBAlgorithm: function(result, heatMap, prevNum, missStatus, hitRate, backtestStats) {
    var mainGrid = document.getElementById('dbMainGrid');
    var backupGrid = document.getElementById('dbBackupGrid');
    var heatGrid = document.getElementById('dbHeatGrid');
    var missGrid = document.getElementById('dbMissGrid');
    var hitRateEl = document.getElementById('dbHitRate');
    var backtestContainer = document.getElementById('dbBacktestContainer');
    var backtestStatsEl = document.getElementById('dbBacktestStats');
    var backtestRecordsEl = document.getElementById('dbBacktestRecords');

    var dbPanel = document.getElementById('zodiacDBPanel');

    if (!result) {
      if (dbPanel) {
        dbPanel.innerHTML = '';
      }
      return;
    }

    if (mainGrid) {
      if (!result.main || !result.main.length) {
        mainGrid.innerHTML = '<div class="empty-tip">数据不足</div>';
        mainGrid.style.gridTemplateColumns = '';
      } else {
        var mHtml = '';
        result.main.forEach(function(z, idx) {
          var rank = idx + 1;
          var rankClass = rank === 1 ? 'card-rank-1' : (rank === 2 ? 'card-rank-2' : (rank === 3 ? 'card-rank-3' : 'card-rank-other'));
          var emoji = ZodiacPrediction.getZodiacEmoji(z);
          mHtml += '<div class="db-card-item ' + rankClass + '">';
          mHtml += '<div class="db-rank-badge">' + rank + '</div>';
          mHtml += '<div class="db-card-emoji">' + emoji + '</div>';
          mHtml += '<div class="db-card-name">' + z + '</div>';
          mHtml += '</div>';
        });
        mainGrid.innerHTML = mHtml;
        mainGrid.style.gridTemplateColumns = 'repeat(4, 1fr)';
      }
    }

    if (backupGrid) {
      if (!result.backup || !result.backup.length) {
        backupGrid.innerHTML = '';
        backupGrid.style.gridTemplateColumns = '';
      } else {
        var bHtml = '';
        result.backup.forEach(function(z, idx) {
          var rank = idx + 1;
          var rankClass = rank === 1 ? 'card-rank-1' : (rank === 2 ? 'card-rank-2' : 'card-rank-other');
          var emoji = ZodiacPrediction.getZodiacEmoji(z);
          bHtml += '<div class="db-card-item ' + rankClass + '">';
          bHtml += '<div class="db-rank-badge">' + rank + '</div>';
          bHtml += '<div class="db-card-emoji">' + emoji + '</div>';
          bHtml += '<div class="db-card-name">' + z + '</div>';
          bHtml += '</div>';
        });
        backupGrid.innerHTML = bHtml;
        backupGrid.style.gridTemplateColumns = 'repeat(2, 1fr)';
      }
    }

    if (heatGrid && heatMap) {
      var tags = { hot: '热', downgrade: '降权', warm: '温', cold: '冷' };
      var zoneTags = { hot: '温号组', mid: '中等', cold: '冷号' };
      var zList = BusinessPredictOld.ZODIAC_ORDER.map(function(z) {
        return { zodiac: z, info: heatMap[z] };
      });
      zList.sort(function(a, b) { return b.info.count - a.info.count; });
      var hHtml = '';
      zList.forEach(function(item) {
        var z = item.zodiac;
        var info = item.info;
        if (!info) return;
        var tagClass = info.level === 'hot' ? 'is-hot' : (info.level === 'downgrade' ? 'is-downgrade' : (info.level === 'warm' ? 'is-warm' : 'is-cold'));
        var zoneClass = info.zone === 'hot' ? 'is-hot' : (info.zone === 'mid' ? 'is-warm' : 'is-cold');
        hHtml += '<div class="db-heat-item">';
        hHtml += '<div class="db-heat-zodiac">' + z + '</div>';
        hHtml += '<div class="db-heat-count">' + info.count + '次</div>';
        hHtml += '<span class="db-heat-tag ' + tagClass + '">' + tags[info.level] + '</span>';
        hHtml += '<span class="db-heat-tag db-heat-zone ' + zoneClass + '">' + zoneTags[info.zone] + '</span>';
        hHtml += '</div>';
      });
      heatGrid.innerHTML = hHtml;
    }

    if (hitRateEl && hitRate) {
      var rateClass = parseFloat(hitRate.hitRate) >= 40 ? 'hitrate-high' : (parseFloat(hitRate.hitRate) >= 20 ? 'hitrate-mid' : 'hitrate-low');
      hitRateEl.innerHTML = '<span class="db-hitrate-label">近' + hitRate.total + '期命中率</span><span class="db-hitrate-value ' + rateClass + '">' + hitRate.hit + '/' + hitRate.total + ' (' + hitRate.hitRate + ')</span>';
    }

    if (missGrid && missStatus) {
      var missLevelTags = { hot: '🔥热号', warm: '☀️温号', cold: '❄️冷号', deep: '🥶深冷' };
      var missLevelClass = { hot: 'miss-hot', warm: 'miss-warm', cold: 'miss-cold', deep: 'miss-deep' };
      var missList = [];
      for (var n = 1; n <= 12; n++) {
        missList.push(missStatus[n]);
      }
      missList.sort(function(a, b) { return b.miss - a.miss; });
      var mHtml = '<div class="db-miss-section-label">01–12 遗漏统计 / 冷热状态</div>';
      mHtml += '<div class="db-miss-grid">';
      missList.forEach(function(item) {
        if (!item) return;
        var cls = missLevelClass[item.level] || 'miss-warm';
        mHtml += '<div class="db-miss-item">';
        mHtml += '<div class="db-miss-zodiac">' + item.zodiac + '</div>';
        mHtml += '<div class="db-miss-count">遗漏<span class="db-miss-num">' + item.miss + '</span>期</div>';
        mHtml += '<span class="db-miss-tag ' + cls + '">' + (missLevelTags[item.level] || '') + '</span>';
        mHtml += '<div class="db-miss-tip">' + item.tip + '</div>';
        mHtml += '</div>';
      });
      mHtml += '</div>';
      missGrid.innerHTML = mHtml;
    }

    if (backtestContainer) {
      backtestContainer.style.display = 'block';
    }

    if (backtestStatsEl && backtestStats) {
      var validTotal = backtestStats.totalRecords - backtestStats.pendingCount;
      var rateColor = parseFloat(backtestStats.hitRate) >= 50 ? 'backtest-rate-high' : (parseFloat(backtestStats.hitRate) >= 30 ? 'backtest-rate-mid' : 'backtest-rate-low');
      var statsHtml = '<span class="backstat-item">命中率 <strong class="' + rateColor + '">' + backtestStats.hitRate + '%</strong></span>';
      statsHtml += '<span class="backstat-item">连中 <strong>' + backtestStats.consecutiveHits + '</strong>期</span>';
      statsHtml += '<span class="backstat-item">' + backtestStats.hitCount + '/' + validTotal + '中</span>';
      backtestStatsEl.innerHTML = statsHtml;
    }

    if (backtestRecordsEl && backtestStats && backtestStats.recentRecords) {
      if (backtestStats.recentRecords.length === 0) {
        backtestRecordsEl.innerHTML = '<div class="backtest-empty">暂无回测记录，预测后自动记录</div>';
      } else {
        var rHtml = '';
        backtestStats.recentRecords.forEach(function(record, idx) {
          var expectStr = record.expect ? (record.expect + '期') : ('#' + (idx + 1));

          var mainStr = record.mainPredictions ? record.mainPredictions.join(' ') : '-';
          var backupStr = record.backupPredictions ? record.backupPredictions.join(' ') : '-';

          var statusClass = '';
          var statusText = '';
          var actualStr = '-';

          if (record.isHit === null) {
            statusClass = 'backtest-status-pending';
            statusText = '待开奖';
          } else if (record.isHit) {
            if (record.hitType === 'main') {
              statusClass = 'backtest-status-hit-main';
              statusText = '主推中 ✓';
            } else {
              statusClass = 'backtest-status-hit-backup';
              statusText = '备选中 ○';
            }
            actualStr = record.actualResult || '?';
          } else {
            statusClass = 'backtest-status-miss';
            statusText = '未命中 ✗';
            actualStr = record.actualResult || '?';
          }

          rHtml += '<div class="backtest-record-item">';
          rHtml += '<div class="backtest-record-time">' + expectStr + '</div>';
          rHtml += '<div class="backtest-record-content">';
          rHtml += '<span class="backtest-label">推荐:</span>';
          rHtml += '<span class="backtest-value main-value">' + mainStr + '</span>';
          if (backupStr && backupStr !== '-') {
            rHtml += '<span class="backtest-paren">(</span>';
            rHtml += '<span class="backtest-value backup-value">' + backupStr + '</span>';
            rHtml += '<span class="backtest-paren">)</span>';
          }
          if (record.isHit !== null) {
            rHtml += '<span class="backtest-sep">·</span>';
            rHtml += '<span class="backtest-actual">开奖 ' + actualStr + '</span>';
          }
          rHtml += '<span class="backtest-status-badge ' + statusClass + '">' + statusText + '</span>';
          rHtml += '</div>';
          rHtml += '</div>';
        });
        backtestRecordsEl.innerHTML = rHtml;
      }
    }
  },

  renderGiongAlgorithm: function(data, backtestStats) {
    var dbPanel = document.getElementById('zodiacDBPanel');
    if (!dbPanel) return;

    if (!data || data.insufficient) {
      ViewZodiacPrediction._renderGiongEmpty(dbPanel, data ? data.message : '暂无数据');
      return;
    }

    var html = '';

    html += '<div class="card db-card">';
    html += '<div class="card-header">';
    html += '<div class="db-header-left">';
    html += '<h2>Giong双链预测</h2>';
    html += '<span class="db-badge">算法v1.0</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="card-body">';

    html += '<div class="giong-latest-info">';
    html += '<div class="giong-latest-label">最新落点</div>';
    html += '<div class="giong-latest-num">' + data.latestNum + '</div>';
    html += '<div class="giong-latest-zodiac">' + data.latestZodiac + '</div>';
    html += '</div>';

    html += '<div class="db-result-container">';

    html += '<div class="db-main-section">';
    html += '<div class="db-section-label giong-chain-label">' + data.newResult.chainName + '（主力）</div>';
    html += '<div class="giong-chain-desc">' + data.newResult.chainDesc + '</div>';
    html += '<div class="db-section-label">主推 4 码</div>';
    html += '<div class="db-number-grid">';
    data.newResult.main.forEach(function(item, idx) {
      var rank = idx + 1;
      var rankClass = rank === 1 ? 'card-rank-1' : (rank === 2 ? 'card-rank-2' : (rank === 3 ? 'card-rank-3' : 'card-rank-other'));
      var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
      html += '<div class="db-card-item ' + rankClass + '">';
      html += '<div class="db-rank-badge">' + rank + '</div>';
      html += '<div class="db-card-emoji">' + emoji + '</div>';
      html += '<div class="db-card-name">' + item.zodiac + '</div>';
      html += '</div>';
    });
    html += '</div>';

    if (data.newResult.backup && data.newResult.backup.length) {
      html += '<div class="db-divider"></div>';
      html += '<div class="db-backup-section">';
      html += '<div class="db-section-label">备选 ' + data.newResult.backup.length + ' 码</div>';
      html += '<div class="db-number-grid">';
      data.newResult.backup.forEach(function(item, idx) {
        var rank = idx + 1;
        var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
        html += '<div class="db-card-item">';
        html += '<div class="db-rank-badge">' + rank + '</div>';
        html += '<div class="db-card-emoji">' + emoji + '</div>';
        html += '<div class="db-card-name">' + item.zodiac + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
    html += '</div>';

    html += '<div class="giong-chain-divider">━━ 双链对照 ━━</div>';

    html += '<div class="db-main-section">';
    html += '<div class="db-section-label giong-chain-label giong-chain-old">' + data.oldResult.chainName + '（防守）</div>';
    html += '<div class="giong-chain-desc">' + data.oldResult.chainDesc + '</div>';
    html += '<div class="db-section-label">主推 4 码</div>';
    html += '<div class="db-number-grid">';
    data.oldResult.main.forEach(function(item, idx) {
      var rank = idx + 1;
      var rankClass = rank === 1 ? 'card-rank-1' : (rank === 2 ? 'card-rank-2' : (rank === 3 ? 'card-rank-3' : 'card-rank-other'));
      var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
      html += '<div class="db-card-item ' + rankClass + '">';
      html += '<div class="db-rank-badge">' + rank + '</div>';
      html += '<div class="db-card-emoji">' + emoji + '</div>';
      html += '<div class="db-card-name">' + item.zodiac + '</div>';
      html += '</div>';
    });
    html += '</div>';

    if (data.oldResult.backup && data.oldResult.backup.length) {
      html += '<div class="db-divider"></div>';
      html += '<div class="db-backup-section">';
      html += '<div class="db-section-label">备选 ' + data.oldResult.backup.length + ' 码</div>';
      html += '<div class="db-number-grid">';
      data.oldResult.backup.forEach(function(item, idx) {
        var rank = idx + 1;
        var emoji = ZodiacPrediction.getZodiacEmoji(item.zodiac);
        html += '<div class="db-card-item">';
        html += '<div class="db-rank-badge">' + rank + '</div>';
        html += '<div class="db-card-emoji">' + emoji + '</div>';
        html += '<div class="db-card-name">' + item.zodiac + '</div>';
        html += '</div>';
      });
      html += '</div></div>';
    }
    html += '</div>';

    html += '</div>';

    if (data.downWeightList && data.downWeightList.length) {
      html += '<div class="db-miss-container">';
      html += '<div class="db-miss-section-label">降权名单（12期≥3次）</div>';
      html += '<div class="giong-downweight-list">';
      data.downWeightList.forEach(function(item) {
        html += '<span class="giong-downweight-tag">' + item.zodiac + '</span>';
      });
      html += '</div></div>';
    }

    if (data.isCongestion) {
      html += '<div class="giong-warning">⚠ 高热拥堵：12期≥3次号码超过3个，2次号暂停推荐</div>';
    }

    html += '</div></div>';

    html += '<div class="card db-card">';
    html += '<div class="card-header"><h2>热度分布</h2></div>';
    html += '<div class="card-body">';
    html += '<div class="db-heat-grid" id="giongHeatGrid">';
    var zodiacOrder = BusinessPredictOld.ZODIAC_ORDER;
    zodiacOrder.forEach(function(z) {
      var num = BusinessGiong._toNum(z);
      var info = data.heatMap[num] || {};
      var tagClass = info.level === 'hot' ? 'is-hot' : (info.level === 'warm' ? 'is-warm' : (info.level === 'cool' ? 'is-cold' : (info.level === 'deep' ? 'is-cold' : 'is-cold')));
      var dwBadge = info.isDownWeight ? '<span class="giong-badge-dw">降权</span>' : '';
      var czBadge = info.isColdZone ? '<span class="giong-badge-cz">冷区</span>' : '';
      html += '<div class="db-heat-item">';
      html += '<div class="db-heat-zodiac">' + z + dwBadge + czBadge + '</div>';
      html += '<div class="db-heat-count">12期 ' + (info.count || 0) + '次 / 24期 ' + (info.count24 || 0) + '次</div>';
      html += '<span class="db-heat-tag ' + tagClass + '">' + (info.label || '--') + '</span>';
      html += '</div>';
    });
    html += '</div></div></div>';

    html += '<div class="card db-card">';
    html += '<div class="card-header"><h2>算法规则</h2></div>';
    html += '<div class="card-body">';
    html += '<div class="db-rules">';
    html += '<div class="db-rule-item"><div class="db-rule-num">①</div><div class="db-rule-text">旧版经典主链：01→05→07→09→04→10→01（马→虎→鼠→狗→兔→鸡→马）</div></div>';
    html += '<div class="db-rule-item"><div class="db-rule-num">②</div><div class="db-rule-text">新版实测主链：01→04→05→07→09→01（马→兔→虎→鼠→狗→马）</div></div>';
    html += '<div class="db-rule-item"><div class="db-rule-num">③</div><div class="db-rule-text">10(鸡)挂靠04(兔)，06(牛)为变盘专属号→01/07</div></div>';
    html += '<div class="db-rule-item"><div class="db-rule-num">④</div><div class="db-rule-text">12期内出现≥3次→降权；11期回落=2次→解除降权</div></div>';
    html += '<div class="db-rule-item"><div class="db-rule-num">⑤</div><div class="db-rule-text">冷门四区：蛇(02)、猪(08)、猴(11)、羊(12)永不进主推</div></div>';
    html += '<div class="db-rule-item"><div class="db-rule-num">⑥</div><div class="db-rule-text">高热拥堵(≥3次号码>3个)：普通2次号暂停推荐</div></div>';
    html += '<div class="db-rule-item"><div class="db-rule-num">⑦</div><div class="db-rule-text">06热度达标(2次+)可顶替链内冷号进主推</div></div>';
    html += '</div></div></div>';

    if (backtestStats) {
      html += ViewZodiacPrediction._renderGiongBacktestCard(backtestStats);
    }

    dbPanel.innerHTML = html;
  },

  _renderGiongEmpty: function(dbPanel, message) {
    dbPanel.innerHTML = '<div class="card db-card"><div class="card-body"><div class="empty-tip">' + (message || '数据不足，无法生成Giong预测') + '</div></div></div>';
  },

  _renderGiongBacktestCard: function(stats) {
    if (!stats || stats.totalRecords === 0) return '';

    var validTotal = stats.totalRecords - stats.pendingCount;
    var rateColor = parseFloat(stats.hitRate) >= 50 ? 'backtest-rate-high' : (parseFloat(stats.hitRate) >= 30 ? 'backtest-rate-mid' : 'backtest-rate-low');

    var html = '';
    html += '<div class="card db-card giong-backtest-card">';
    html += '<div class="card-header"><h2>Giong回测追踪</h2></div>';
    html += '<div class="card-body">';

    html += '<div class="giong-backtest-header">';
    html += '<div class="backtest-summary">';
    html += '<div class="backtest-summary-row">';
    html += '<div class="backtest-stat">';
    html += '<span class="backtest-stat-label">回测期数</span>';
    html += '<span class="backtest-stat-value">' + validTotal + '期</span>';
    html += '</div>';
    html += '<div class="backtest-stat">';
    html += '<span class="backtest-stat-label">命中次数</span>';
    html += '<span class="backtest-stat-value">' + stats.hitCount + '次</span>';
    html += '</div>';
    html += '<div class="backtest-stat">';
    html += '<span class="backtest-stat-label">命中率</span>';
    html += '<span class="backtest-stat-value ' + rateColor + '">' + stats.hitRate + '%</span>';
    html += '</div>';
    html += '</div>';
    html += '<div class="backtest-breakdown">';
    html += '<span class="backtest-breakdown-item">🎯主推中：' + stats.mainHitCount + '次</span>';
    html += '<span class="backtest-breakdown-item">🔶备选中：' + stats.backupHitCount + '次</span>';
    html += '<span class="backtest-breakdown-item">🔥连中：' + stats.consecutiveHits + '期</span>';
    html += '</div>';
    html += '</div>';
    html += '</div>';

    if (stats.pendingCount > 0) {
      html += '<div class="giong-pending-tip">' + stats.pendingCount + ' 条记录待开奖验证</div>';
    }

    html += '<div class="db-backtest-records">';
    if (!stats.recentRecords || stats.recentRecords.length === 0) {
      html += '<div class="backtest-empty">暂无回测记录</div>';
    } else {
      stats.recentRecords.forEach(function(record) {
        var mainStr = record.mainPredictions ? record.mainPredictions.join(' ') : '-';
        var backupStr = record.backupPredictions ? record.backupPredictions.join(' ') : '-';
        var expectStr = record.expect ? (record.expect + '期') : '--';

        var statusClass = '';
        var statusText = '';
        var actualStr = '-';

        if (record.isHit === null) {
          statusClass = 'backtest-status-pending';
          statusText = '待开奖';
        } else if (record.isHit) {
          if (record.hitType === 'main') {
            statusClass = 'backtest-status-hit-main';
            statusText = '主推中 ✓';
          } else {
            statusClass = 'backtest-status-hit-backup';
            statusText = '备选中 ○';
          }
          actualStr = record.actualResult || '?';
        } else {
          statusClass = 'backtest-status-miss';
          statusText = '未命中 ✗';
          actualStr = record.actualResult || '?';
        }

        html += '<div class="backtest-record-item">';
        html += '<div class="backtest-record-time">' + expectStr + '</div>';
        html += '<div class="backtest-record-content">';
        html += '<span class="backtest-label">推荐:</span>';
        html += '<span class="backtest-value main-value">' + mainStr + '</span>';
        if (backupStr && backupStr !== '-') {
          html += '<span class="backtest-paren">(</span>';
          html += '<span class="backtest-value backup-value">' + backupStr + '</span>';
          html += '<span class="backtest-paren">)</span>';
        }
        if (record.isHit !== null) {
          html += '<span class="backtest-sep">·</span>';
          html += '<span class="backtest-actual">开奖 ' + actualStr + '</span>';
        }
        html += '<span class="backtest-status-badge ' + statusClass + '">' + statusText + '</span>';
        html += '</div>';
        html += '</div>';
      });
    }
    html += '</div>';

    html += '</div></div>';
    return html;
  },

  toggleDBDetail: function() {
    var panel = document.getElementById('dbHeatPanel');
    var toggle = document.getElementById('dbDetailToggle');
    if (!panel || !toggle) return;
    var isHidden = panel.style.display === 'none';
    panel.style.display = isHidden ? 'block' : 'none';
    var arrow = toggle.querySelector('svg');
    if (arrow) {
      arrow.style.transform = isHidden ? 'rotate(180deg)' : 'rotate(0deg)';
    }
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

  initZoneSwiper: function() {
    ViewZodiacPrediction._createSwiper({
      wrapperId: 'zoneSwiperWrapper', cardSelector: '.freq-section',
      dotsId: 'zoneSwiperDots', dotClass: 'zone-swiper-dot',
      updateRef: 'zoneSwiperUpdate', dataAttr: ['data-zone-current', '0']
    });
  },

  zoneSwiperUpdate: null,
  predSwiperUpdate: null,
  freqSwiperUpdate: null
};