const ViewZodiacPrediction = {
  renderPrediction: function(predictionData) {
    var grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return;

    if (!predictionData || !predictionData.cards) {
      grid.innerHTML = '<div class="empty-tip">暂无开奖数据，无法生成预测</div>';
      return;
    }

    var cardsHtml = '';
    predictionData.cards.forEach(function(card) {
      var roleClass = card.roleTag === '精选' ? 'tag-selected' : (card.roleTag === '防守' && card.cardClass === 'is-featured' ? 'tag-featured' : 'tag-secondary-label');
      var heatClass = card.heatTag === '热号' ? 'tag-hot' : (card.heatTag === '温号' ? 'tag-warm' : 'tag-cold');

      cardsHtml += '<div class="zodiac-prediction-card ' + card.cardClass + '">';
      cardsHtml += '<div class="zodiac-card-zodiac">' + card.zodiac + '</div>';
      cardsHtml += '<div class="zodiac-card-score">' + card.score + '分</div>';
      cardsHtml += '<div class="zodiac-card-tags">';
      cardsHtml += '<span class="zodiac-card-tag ' + roleClass + '">' + card.roleTag + '</span>';
      cardsHtml += '<span class="zodiac-card-tag ' + heatClass + '">' + card.heatTag + '</span>';
      cardsHtml += '</div>';
      cardsHtml += '</div>';
    });

    grid.innerHTML = cardsHtml;
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
      var panelMap = { predict: 'zodiacPredictPanel', giong: 'zodiacGiongPanel', db: 'zodiacDBPanel' };
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

    periods.forEach(function(period) {
      var data = freqResult[period.key];
      if (!data) {
        html += '<div class="freq-card"><div class="freq-card-title">' + period.label + '</div>';
        html += '<div class="empty-tip">数据不足</div></div>';
        return;
      }

      var storageKey = 'ZONE_PREV_ZONE_' + period.key;
      var prevZoneMap = {};
      var cached = Storage.get(storageKey);
      if (cached) prevZoneMap = cached;

      var newZoneMap = {};

      var grouped = {};
      zoneOrder.forEach(function(z) { grouped[z] = []; });
      data.forEach(function(item) {
        grouped[item.zone].push(item);
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
          var missClass = zoneColors[prevZone] || '';
          var badgeClass = zoneColors[prevZone] || '';
          newZoneMap[item.zodiac] = currentZone;
          html += '<div class="zone-zod-card">';
          html += '<div class="zod-card-count-badge ' + badgeClass + '">' + item.count + '</div>';
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
    });

    grid.innerHTML = html;
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
      { key: 'p24', label: '基于24期滚动窗口' }
    ];

    var zoneColors = {
      '顶峰区': 'zone-peak',
      '高频区': 'zone-high',
      '中频区': 'zone-mid',
      '低平区': 'zone-low',
      '等待区': 'zone-wait'
    };

    var zoneLabels = ['等待区', '低频区', '中频区', '高频区', '顶峰区'];

    var html = '';
    html += '<div class="analysis-section-title">历史区域概率分析</div>';
    html += '<div class="analysis-desc">基于60期历史滚动：若生肖落入某区域，下一期开出的概率</div>';

    periods.forEach(function(period) {
      var data = patternResult[period.key];
      if (!data) return;

      html += '<div class="freq-section"><div class="freq-section-title">' + period.label + '</div>';
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
  },

  renderZoneRecommend: function(recommend, nextExpect) {
    var container = document.getElementById('giongRecommendPanel');
    if (!container) return;

    if (!recommend || !recommend.length) {
      container.innerHTML = '';
      return;
    }

    var top6 = recommend.slice(0, 6);
    var rankClasses = ['rank-gold', 'rank-silver', 'rank-silver', 'rank-bronze', 'rank-bronze', 'rank-bronze'];
    var rankIcons = ['🥇', '🥈', '🥉', '4', '5', '6'];

    var title = '区域综合推荐';
    if (nextExpect) title = '第' + nextExpect + '期推荐';

    var html = '<div class="analysis-section-title">' + title + '</div>';
    html += '<div class="recommend-card-grid">';
    top6.forEach(function(entry, idx) {
      var rankClass = rankClasses[idx] || 'rank-default';
      var icon = rankIcons[idx] || (idx + 1);
      html += '<div class="recommend-card ' + rankClass + '">';
      html += '<div class="recommend-rank-badge">' + icon + '</div>';
      html += '<div class="recommend-zodiac-name">' + entry[0] + '</div>';
      html += '<div class="recommend-score-tag">' + entry[1] + '分</div>';
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

  renderDBAlgorithm: function(result, heatMap, prevNum) {
    var mainGrid = document.getElementById('dbMainGrid');
    var backupGrid = document.getElementById('dbBackupGrid');
    var heatGrid = document.getElementById('dbHeatGrid');

    if (!result) {
      if (mainGrid) mainGrid.innerHTML = '<div class="empty-tip">暂无历史数据，请先刷新数据</div>';
      if (backupGrid) backupGrid.innerHTML = '';
      if (heatGrid) heatGrid.innerHTML = '';
      return;
    }

    if (mainGrid) {
      if (!result.main || !result.main.length) {
        mainGrid.innerHTML = '<div class="empty-tip">数据不足</div>';
      } else {
        var mHtml = '';
        result.main.forEach(function(z) {
          mHtml += '<div class="db-number-item">';
          mHtml += '<div class="db-number-circle">' + z + '</div>';
          mHtml += '</div>';
        });
        mainGrid.innerHTML = mHtml;
      }
    }

    if (backupGrid) {
      if (!result.backup || !result.backup.length) {
        backupGrid.innerHTML = '';
      } else {
        var bHtml = '';
        result.backup.forEach(function(z) {
          bHtml += '<div class="db-number-item">';
          bHtml += '<div class="db-number-circle">' + z + '</div>';
          bHtml += '</div>';
        });
        backupGrid.innerHTML = bHtml;
      }
    }

    if (heatGrid && heatMap) {
      var tags = { hot: '热', downgrade: '降权', warm: '温', cold: '冷' };
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
        hHtml += '<div class="db-heat-item">';
        hHtml += '<div class="db-heat-zodiac">' + z + '</div>';
        hHtml += '<div class="db-heat-count">' + info.count + '次</div>';
        hHtml += '<span class="db-heat-tag ' + tagClass + '">' + tags[info.level] + '</span>';
        hHtml += '</div>';
      });
      heatGrid.innerHTML = hHtml;
    }
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
  }
};