/**
 * 视图层：生肖预测面板（predict panel）
 * 职责：渲染"资料页"中的"推荐前6/后6名"面板
 * 依赖方向：被 business-main.js / event.js 调用
 * 拆分记录：2026-06-09 从 view-zodiac-prediction.js 拆分
 */
const ViewZodiacPredict = {

  /**
   * 渲染推荐前6名 / 后6名（默认显示 top6，bottom6 通过 switchPredTabUI 切换）
   */
  renderPrediction: function(predictionData) {
    const grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return;

    if (!predictionData || !predictionData.cards) {
      grid.innerHTML = '<div class="empty-tip">暂无开奖数据，无法生成预测</div>';
      return;
    }

    const allCards = predictionData.cards;
    if (!allCards || allCards.length < 12) {
      grid.innerHTML = '<div class="empty-tip">数据不足，无法生成完整预测</div>';
      return;
    }

    let html = '';
    html += '<div class="freq-panels-container">';

    const top6Cards = allCards.slice(0, 6);
    const bottom6Cards = allCards.slice(6, 12);

    html += '<div class="freq-panel zodiac-pred-panel" data-pred-panel="top6">';
    html += '<div class="zp-header-row">';
    html += '<button class="db-copy-btn" data-action="copyZodiacTop6" type="button" aria-label="复制前 6 名生肖"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>';
    html += '</div>';
    html += '<div class="zodiac-pred-grid">';
    top6Cards.forEach(function(card, idx) {
      const rankNum = idx + 1;
      let cardClass = '';
      if (rankNum === 1) cardClass = 'card-rank-1';
      else if (rankNum === 2) cardClass = 'card-rank-2';
      else if (rankNum === 3) cardClass = 'card-rank-3';
      else cardClass = 'card-rank-other';

      const emoji = CONFIG.ZODIAC_EMOJI[card.zodiac] || '';

      html += ViewCommon.renderZodiacCardHtml(card.zodiac, rankNum, cardClass, emoji);
    });
    html += '</div>';
    html += '</div>';

    html += '<div class="freq-panel zodiac-pred-panel" data-pred-panel="bottom6" style="display:none;">';
    html += '<div class="zp-header-row">';
    html += '<button class="db-copy-btn" data-action="copyZodiacTop6" type="button" aria-label="复制后 6 名生肖"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>';
    html += '</div>';
    html += '<div class="zodiac-pred-grid">';
    bottom6Cards.forEach(function(card, idx) {
      const rankNum = idx + 7;
      const cardClass = 'card-rank-other';

      const emoji = CONFIG.ZODIAC_EMOJI[card.zodiac] || '';

      html += ViewCommon.renderZodiacCardHtml(card.zodiac, rankNum, cardClass, emoji);
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

  initPredSwiper: function() {
    ViewCommon._createSwiper({
      wrapperId: 'zodiacPredSwiperWrapper', cardSelector: '.zodiac-pred-card',
      dotsId: 'zodiacPredSwiperDots', dotClass: 'freq-swiper-dot', updateRef: 'ViewZodiacPredict.predSwiperUpdate'
    });
  },

  renderEmpty: function() {
    const grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-tip">暂无开奖数据，请先刷新历史数据</div>';
  },

  showLoading: function() {
    const grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return;
    grid.innerHTML = '<div class="empty-tip">正在计算预测...</div>';
  },

  renderBacktest: function(summary) {
    const container = document.getElementById('zodiacBacktestContainer');
    if (!container) return;

    if (!summary || !summary.total) {
      container.innerHTML = '';
      return;
    }

    const hitClass = ViewCommon.getRateClass(summary.hitRate);

    let html = '<div class="backtest-summary">';
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

    html += '<div class="backtest-records backtest-records-inline">';

    try {
      const _st = (typeof StateManager !== 'undefined') ? StateManager._state : null;
      const _hist = _st && _st.analysis ? _st.analysis.historyData : null;
      const _v1 = _st && _st.analysis ? _st.analysis.v1Recommend : null;
      if (_hist && _hist.length > 0 && _v1 && _v1.length) {
        const _nextExp = Number(_hist[0].expect) + 1;
        const _top6 = _v1.map(function(c) { return c.zodiac; }).join('');
        html += '<div class="backtest-record-row backtest-pending">';
        html += '<span class="backtest-record-period">' + _nextExp + '期:</span>';
        html += '<span class="backtest-record-predict">【<span class="backtest-record-zodiacs">' + _top6 + '</span>】</span>';
        html += '<span class="backtest-record-result"><span class="backtest-record-hittext">待开奖</span></span>';
        html += '</div>';
      }
    } catch (e) { /* 状态不可用则跳过 */ }

    const recentRecords = summary.records.slice(0, 30);
    recentRecords.forEach(function(r) {
      const hitText = r.hit ? '准' : '错';
      const hitRowClass = r.hit ? 'backtest-hit' : 'backtest-miss';
      let top6Html;
      if (r.hit && r.hitRank >= 1 && r.hitRank <= r.top6.length) {
        const hitIdx = r.hitRank - 1;
        top6Html = r.top6.map(function(z, i) {
          if (i === hitIdx) return '<span class="backtest-record-zodiac-hit">' + z + '</span>';
          return z;
        }).join('');
      } else {
        top6Html = r.top6.join('');
      }
      const actualNumRaw = r.actualTe !== undefined ? r.actualTe : (r.actualNumber !== undefined ? r.actualNumber : '');
      const actualNum = Utils.formatNum(actualNumRaw);
      html += '<div class="backtest-record-row ' + hitRowClass + '">';
      html += '<span class="backtest-record-period">' + r.expect + '期:</span>';
      html += '<span class="backtest-record-predict">【<span class="backtest-record-zodiacs">' + top6Html + '</span>】</span>';
      html += '<span class="backtest-record-result">开:<b>' + r.actualZodiac + '</b>' + actualNum + '<span class="backtest-record-hittext">' + hitText + '</span></span>';
      html += '</div>';
    });
    html += '</div>';

    container.innerHTML = html;
  },

  renderBacktestEmpty: function() {
    const container = document.getElementById('zodiacBacktestContainer');
    if (!container) return;
    container.innerHTML = '<div class="empty-tip">运行中…</div>';
  },

  renderStrategyPanel: function(tuned) {
    const panel = document.getElementById('zodiacStrategyPanel');
    if (!panel) return;

    if (!tuned) {
      panel.innerHTML = '';
      return;
    }

    let strategyClass;
    if (tuned.strategy === '强追热') strategyClass = 'strategy-hot';
    else if (tuned.strategy === '追冷搏反弹') strategyClass = 'strategy-cold';
    else strategyClass = 'strategy-balanced';

    const dims = [
      { key: 'base', label: '热度', max: 30 },
      { key: 'shape', label: '形态', max: 20 },
      { key: 'interval', label: '间隔', max: 20 },
      { key: 'trend', label: '趋势', max: 15 },
      { key: 'momentum', label: '动量', max: 15 }
    ];

    let html = '<div class="strategy-panel">';
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
      const pct = tuned.dimensionEff[d.key] || 0;
      const w = tuned.detail[d.key] || 0;
      const barClass = pct >= 80 ? 'bar-high' : (pct >= 50 ? 'bar-mid' : 'bar-low');
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

  /**
   * 切换顶 6 名 / 后 6 名子面板
   */
  switchPredTabUI: function(predTab) {
    document.querySelectorAll('#zodiacPredictionGrid .freq-tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.predTab === predTab);
    });
    document.querySelectorAll('#zodiacPredictionGrid .freq-panel').forEach(function(panel) {
      panel.style.display = panel.dataset.predPanel === predTab ? '' : 'none';
    });
  }
};

// 供 _createSwiper 回写 slide 函数
ViewZodiacPredict.predSwiperUpdate = null;
