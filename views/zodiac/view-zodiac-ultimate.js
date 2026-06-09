/**
 * 视图层：终极算法面板（ultimate panel）
 * 职责：渲染"资料页"中的"终极算法标签页"，包含主推4码 + 备选 + 周期状态 + 未推荐生肖 + 回测追踪
 * 依赖方向：被 business-main.js / event.js 调用
 * 拆分记录：2026-06-09 从 view-zodiac-prediction.js 拆分
 */
const ViewZodiacUltimate = {

  /**
   * 缓存最近一次未推荐生肖来源数据，供 showUnrecSourcesModal 使用
   */
  _lastUnrecSources: null,

  /**
   * 渲染终极算法结果（主推4码 + 备选 + 周期状态）
   */
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
    html += '<button class="db-copy-btn" data-action="copyMainZodiacs" type="button" aria-label="复制主推与备选生肖"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg></button>';

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
        html += '<div class="db-section-label">防 ' + data.alternative.length + ' 码</div>';
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
        html += '<div class="db-section-label">防 ' + data.alternative.length + ' 码</div>';
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
   * 从 DOM 中读取 v1 推荐（前 6 张生肖预测卡片的生肖名）
   */
  _readV1FromDOM: function() {
    var grid = document.getElementById('zodiacPredictionGrid');
    if (!grid) return [];
    var visiblePanel = grid.querySelector('.freq-panel[style*="display: block"], .freq-panel:not([style*="display: none"])');
    var target = visiblePanel || grid;
    var cards = target.querySelectorAll('.zodiac-static-card .zodiac-static-name');
    var list = [];
    cards.forEach(function(el) { if (el.textContent) list.push(el.textContent.trim()); });
    return list.slice(0, 6);
  },

  /**
   * 从 DOM 中读取 v2 推荐（Giong 页面推荐面板）
   */
  _readV2FromDOM: function() {
    var panel = document.getElementById('giongRecommendPanel');
    if (!panel) return [];
    var cards = panel.querySelectorAll('.zodiac-static-card .zodiac-static-name');
    var list = [];
    cards.forEach(function(el) { if (el.textContent) list.push(el.textContent.trim()); });
    return list;
  },

  /**
   * 从 DOM 中读取终极推荐（主推 4 码 + 备选 n 码）
   */
  _readUltimateFromDOM: function() {
    var container = document.getElementById('ultimateResultContainer');
    if (!container) return [];
    var names = container.querySelectorAll('.db-card-name');
    var list = [];
    names.forEach(function(el) { if (el.textContent) list.push(el.textContent.trim()); });
    return list;
  },

  /**
   * 渲染未推荐生肖卡片（直接从三个推荐源 DOM 中读取）
   */
  renderUnrecommendedZodiacs: function(_) {
    var ultimateResultContainer = document.getElementById('ultimateResultContainer');
    if (!ultimateResultContainer) return;
    var cardBody = ultimateResultContainer.parentNode;
    if (!cardBody) return;

    var panel = document.getElementById('unrecommendedZodiacPanel');
    if (!panel) {
      panel = document.createElement('div');
      panel.id = 'unrecommendedZodiacPanel';
      cardBody.appendChild(panel);
    }

    var v1List = ViewZodiacUltimate._readV1FromDOM();
    var v2List = ViewZodiacUltimate._readV2FromDOM();
    var ultimateList = ViewZodiacUltimate._readUltimateFromDOM();

    var ZODIAC_ORDER = ZodiacPrediction.ZODIAC_ORDER;
    var ZODIAC_EMOJI = ZodiacPrediction.ZODIAC_EMOJI;

    function uniq(arr) {
      var map = {};
      var out = [];
      arr.forEach(function(z) { if (z && !map[z]) { map[z] = true; out.push(z); } });
      return out;
    }

    var v1Uniq = uniq(v1List);
    var v2Uniq = uniq(v2List);
    var ultUniq = uniq(ultimateList);
    var allRecSet = {};
    [].concat(v1Uniq, v2Uniq, ultUniq).forEach(function(z) { allRecSet[z] = true; });
    var allRecommended = Object.keys(allRecSet);

    var unrecommended = [];
    ZODIAC_ORDER.forEach(function(z) {
      if (!allRecSet[z]) unrecommended.push({ zodiac: z, emoji: ZODIAC_EMOJI[z] || '❓' });
    });

    ViewZodiacUltimate._lastUnrecSources = {
      ultUniq: ultUniq,
      v1Uniq: v1Uniq,
      v2Uniq: v2Uniq,
      allRecommended: allRecommended,
      unrecommended: unrecommended
    };

    var html = '<div class="unrec-card">';

    html += '<div class="unrec-section unrec-final">';
    html += '<div class="unrec-source-title unrec-highlight">';
    html += '<span>绝杀生肖（' + unrecommended.length + '个）</span>';
    html += '<button class="unrec-view-sources-btn" data-action="showUnrecSources" type="button" aria-label="查看来源（' + allRecommended.length + ' 个推荐 · ' + unrecommended.length + ' 个绝杀）" title="查看来源">';
    html += '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">';
    html += '<line x1="8" y1="6" x2="21" y2="6"></line>';
    html += '<line x1="8" y1="12" x2="21" y2="12"></line>';
    html += '<line x1="8" y1="18" x2="21" y2="18"></line>';
    html += '<line x1="3" y1="6" x2="3.01" y2="6"></line>';
    html += '<line x1="3" y1="12" x2="3.01" y2="12"></line>';
    html += '<line x1="3" y1="18" x2="3.01" y2="18"></line>';
    html += '</svg>';
    html += '</button>';
    html += '</div>';
    if (unrecommended.length) {
      html += '<div class="unrec-grid">';
      unrecommended.forEach(function(item) {
        html += '<div class="unrec-item">';
        html += '<span class="unrec-emoji">' + item.emoji + '</span>';
        html += '<span class="unrec-name">' + item.zodiac + '</span>';
        html += '</div>';
      });
      html += '</div>';
    } else {
      html += '<div class="unrec-empty-tip">全部生肖均被推荐</div>';
    }
    html += '</div>';

    html += '</div>';
    panel.innerHTML = html;
  },

  /**
   * 展示「查看来源」弹窗
   */
  showUnrecSourcesModal: function() {
    var src = ViewZodiacUltimate._lastUnrecSources;
    if (!src) {
      Toast.show('暂无来源数据');
      return;
    }
    function renderChip(z) {
      return '<span class="unrec-chip">' + z + '</span>';
    }
    function renderSection(title, list) {
      var inner = list && list.length
        ? '<div class="unrec-chips">' + list.map(renderChip).join('') + '</div>'
        : '<div class="unrec-empty-tip">无</div>';
      return '<div class="unrec-section">'
        + '<div class="unrec-source-title">' + title + '</div>'
        + inner
        + '</div>';
    }

    var html = '';
    html += renderSection('① 终极算法推荐', src.ultUniq);
    html += renderSection('② 生肖预测（v1）', src.v1Uniq);
    html += renderSection('③ Giong 页面推荐（v2）', src.v2Uniq);
    html += renderSection('合并去重（共 ' + src.allRecommended.length + ' 个）', src.allRecommended);

    UnrecSourceModal.show('推荐来源明细', html);
  },

  renderUltimateBacktest: function(summary, currentBackupCount) {
    var container = document.getElementById('ultimateBacktestContainer');
    if (!container) return;

    if (!summary || !summary.total) {
      container.innerHTML = '';
      return;
    }

    var hitClass = ViewCommon.getRateClass(summary.hitRate);
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
      if (r.hit && r.hitRank >= 1 && r.hitRank <= r.topN.length) {
        var _hitIdx = r.hitRank - 1;
        topNText = r.topN.map(function(z, i) {
          if (i === _hitIdx) return '<span class="backtest-record-zodiac-hit">' + z + '</span>';
          return z;
        }).join(' ');
      }
      var backupText = '';
      if (r.backupTopN && r.backupTopN.length > 0) {
        var _bHtml = r.backupTopN.join(' ');
        if (r.backupHit && r.backupHitRank >= 1 && r.backupHitRank <= r.backupTopN.length) {
          var _bHitIdx = r.backupHitRank - 1;
          _bHtml = r.backupTopN.map(function(z, i) {
            if (i === _bHitIdx) return '<span class="backtest-record-zodiac-hit">' + z + '</span>';
            return z;
          }).join(' ');
        }
        backupText = '  <span style="color:#1a1a1a;">防:</span>' + _bHtml;
      }

      var stageTag = r.stage ? '<span class="backtest-stage-tag">' + r.stage.replace('稳定运行期', '').replace('过渡混沌期', '过渡') + '</span>' : '';
      var blackInfo = r.blackListCount > 0 ? '<span class="backtest-black-info">降权' + r.blackListCount + '个</span>' : '';

      html += '<div class="backtest-record-row ' + hitRowClass + '">';
      html += '<div class="backtest-record-period">' + r.expect + '期 ' + stageTag + '</div>';
      html += '<span class="backtest-record-predict"><span class="backtest-record-zodiacs"><span style="color:#1a1a1a;">主:</span>' + topNText + backupText + '</span>' + blackInfo + '</span>';
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

  /**
   * 切换回测详情弹窗显示状态
   */
  toggleBacktestDetailModal: function(show) {
    var modal = document.getElementById('backtestDetailModal');
    if (modal) modal.style.display = show ? 'flex' : 'none';
  }
};
