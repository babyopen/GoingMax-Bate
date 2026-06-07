/**
 * 视图层：分析页面渲染
 * @namespace ViewAnalysis
 * 职责：只做 DOM 渲染，接收预计算数据，不包含业务计算
 * 依赖方向：被 business/ 调用（business → views，上层→下层）
 * 红线：不反向调用 business/、不调用 StateManager 写操作
 */
const ViewAnalysis = {

  /**
   * 渲染最新开奖（接收预处理的显示数据）
   * @param {Object} displayData - { ballsHtml, expect }
   */
  renderLatest: (displayData) => {
    if(!displayData) return;
    var latestBalls = document.getElementById('latestBalls');
    var curExpect = document.getElementById('curExpect');
    if(latestBalls && displayData.ballsHtml !== undefined) latestBalls.innerHTML = displayData.ballsHtml;
    if(curExpect && displayData.expect !== undefined) curExpect.innerText = displayData.expect || '--';
  },

  /**
   * 渲染历史列表（接收预处理的历史HTML和行HTML）
   * @param {Object} historyData - { historyHtml, isEmpty, loadMoreVisible }
   */
  renderHistory: (historyData) => {
    var historyList = document.getElementById('historyList');
    if(!historyList) return;
    if(historyData.isEmpty) {
      historyList.innerHTML = '<div style="padding:20px;text-align:center;">暂无历史数据</div>';
    } else {
      historyList.innerHTML = historyData.historyHtml;
    }
    var loadMore = document.getElementById('loadMore');
    if(loadMore) {
      loadMore.style.display = historyData.loadMoreVisible ? 'block' : 'none';
    }
  },

  showHistoryLoading: () => {
    var historyList = document.getElementById('historyList');
    if(historyList) historyList.innerHTML = '<div style="padding:20px;text-align:center;">加载中...</div>';
  },

  showHistoryError: () => {
    var historyList = document.getElementById('historyList');
    if(historyList) {
      historyList.innerHTML = '<div style="padding:20px;text-align:center;color:var(--danger);">数据加载失败，请刷新重试</div>';
    }
  },

  /**
   * 渲染全维度分析（接收 Business.calcFullAnalysis() 预计算数据）
   * @param {Object} data - 预计算的分析数据
   */
  renderFullAnalysis: (data) => {
    var hotWrap = document.getElementById('hotWrap');
    var emptyTip = document.getElementById('emptyTip');
    
    if(!data) {
      if(hotWrap) hotWrap.style.display = 'none';
      if(emptyTip) emptyTip.style.display = 'block';
      return;
    }
    
    if(hotWrap) hotWrap.style.display = 'block';
    if(emptyTip) emptyTip.style.display = 'none';

    var setText = function(id, val) { var el = document.getElementById(id); if(el) el.innerText = val; };

    setText('hotShape', data.hotSD || '');
    setText('hotZodiac', data.hotZodiac || '');
    setText('hotHeadTail', data.hotHT || '');
    setText('hotColorWx', data.hotCW || '');
    setText('hotMiss', data.hotMiss || '');
    setText('odd', data.odd || '');
    setText('even', data.even || '');
    setText('big', data.big || '');
    setText('small', data.small || '');
    setText('r1', data.r1); setText('r2', data.r2); setText('r3', data.r3);
    setText('r4', data.r4); setText('r5', data.r5);
    setText('h0', data.h0); setText('h1', data.h1); setText('h2', data.h2);
    setText('h3', data.h3); setText('h4', data.h4);
    setText('cRed', data.cRed); setText('cBlue', data.cBlue); setText('cGreen', data.cGreen);
    setText('wJin', data.wJin); setText('wMu', data.wMu); setText('wShui', data.wShui);
    setText('wHuo', data.wHuo); setText('wTu', data.wTu);
    setText('aniHome', data.aniHome); setText('aniWild', data.aniWild);

    setText('hotShape2', data._hotShape2 || '');
    setText('hotRange2', data._hotRange2 || '');
    setText('hotHead2', data._hotHead2 || '');
    setText('hotTail2', data._hotTail2 || '');
    setText('hotColor2', data._hotColor2 || '');
    setText('hotWuxing2', data._hotWuxing2 || '');
    setText('hotAnimal', data._hotAnimal || '');
    setText('hotZodiac2', data._hotZodiac2 || '');
    setText('hotNumber', data.hotNum || '');
    setText('missCur', data.missCur || '');
    setText('missAvg', data.missAvg || '');
    setText('missMax', data.missMax || '');
    setText('missHot', data.missHot || '');
    setText('missWarm', data.missWarm || '');
    setText('missCold', data.missCold || '');
    setText('hotColdTip', data.hotColdTip || '');
    setText('streakCur', data.streakCur || '');
    setText('streakMax', data.streakMax || '');
    setText('streakTip', data.streakTip || '');

    var tailHtml = '';
    if(data.tailArr) {
      for(var t = 0; t <= 9; t++) {
        tailHtml += '<div class="analysis-item"><div class="label">尾' + t + '</div><div class="value">' + (data.tailArr[t] || 0) + '</div></div>';
      }
    }
    var tailRow = document.getElementById('tailRow');
    if(tailRow) tailRow.innerHTML = tailHtml;

    if(data.rankHtmls) {
      var rankKeys = ['singleDoubleRank', 'bigSmallRank', 'rangeRank', 'headRank', 'tailRank', 'colorRank', 'wuxingRank', 'animalRank', 'zodiacRank'];
      rankKeys.forEach(function(k) {
        var el = document.getElementById(k);
        if(el && data.rankHtmls[k]) el.innerHTML = data.rankHtmls[k];
      });
    }
  },

  /**
   * 渲染完整排行表HTML（不写入DOM，返回HTML供调用方使用）
   * @param {Object} dataObj - 数据对象
   * @param {number} total - 总数
   * @param {Object} missMap - 遗漏值映射 {name: missValue}
   * @returns {string} HTML
   */
  buildRankHtml: (dataObj, total, missMap) => {
    if(total === 0 || !dataObj) return '';
    var entries = Object.entries(dataObj).sort(function(a, b) { return b[1] - a[1]; });
    var html = '<div class="rank-header"><div class="rank-no">名次</div><div class="rank-name">分类</div><div class="rank-count">次数</div><div class="rank-rate">占比</div><div class="rank-miss">遗漏</div></div>';
    entries.forEach(function(entry, idx) {
      var name = entry[0], count = entry[1];
      var rate = ((count / total) * 100).toFixed(0) + '%';
      var miss;
      if(missMap && missMap[name] !== undefined) {
        miss = missMap[name];
      } else {
        miss = count > 0 ? Math.floor((total - count) / count) : total;
      }
      html += '<div class="rank-row"><div class="rank-no">' + (idx + 1) + '</div><div class="rank-name">' + name + '</div><div class="rank-count">' + count + '</div><div class="rank-rate">' + rate + '</div><div class="rank-miss">' + miss + '</div></div>';
    });
    return html;
  },

  /**
   * 渲染排行表到指定容器
   * @param {string} containerId
   * @param {string} html
   */
  renderRankToDOM: (containerId, html) => {
    var container = document.getElementById(containerId);
    if(container) container.innerHTML = html;
  },

  /**
   * 渲染生肖关联分析（接收预处理的渲染数据）
   * @param {Object} renderData - { combo1, combo2, combo3, tailZodiacHtml, followTableHtml, zodiacTotalHtml, zodiacMissHtml, finalNums }
   */
  renderZodiacAnalysis: (renderData) => {
    var zodiacEmptyTip = document.getElementById('zodiacEmptyTip');
    var zodiacContent = document.getElementById('zodiacContent');
    
    if(!renderData) {
      if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'block';
      if(zodiacContent) zodiacContent.style.display = 'none';
      return;
    }
    
    if(zodiacEmptyTip) zodiacEmptyTip.style.display = 'none';
    if(zodiacContent) zodiacContent.style.display = 'block';

    var combo1 = document.getElementById('combo1');
    var combo2 = document.getElementById('combo2');
    var combo3 = document.getElementById('combo3');
    if(combo1) combo1.innerText = renderData.combo1 || '';
    if(combo2) combo2.innerText = renderData.combo2 || '';
    if(combo3) combo3.innerText = renderData.combo3 || '';

    var tailZodiacGrid = document.getElementById('tailZodiacGrid');
    if(tailZodiacGrid) tailZodiacGrid.innerHTML = renderData.tailZodiacHtml || '';

    var zodiacFollowTable = document.getElementById('zodiacFollowTable');
    if(zodiacFollowTable) zodiacFollowTable.innerHTML = renderData.followTableHtml || '';

    var zodiacTotalGrid = document.getElementById('zodiacTotalGrid');
    if(zodiacTotalGrid) zodiacTotalGrid.innerHTML = renderData.zodiacTotalHtml || '';

    var zodiacMissGrid = document.getElementById('zodiacMissGrid');
    if(zodiacMissGrid) zodiacMissGrid.innerHTML = renderData.zodiacMissHtml || '';

    var zodiacFinalNum = document.getElementById('zodiacFinalNum');
    if(zodiacFinalNum) zodiacFinalNum.innerText = renderData.finalNums || '';
  },

  /**
   * 切换详情显示（纯DOM操作）
   * @param {string} targetId - 目标元素ID
   */
  toggleDetail: (targetId) => {
    var el = document.getElementById(targetId);
    if(!el) return;
    var isVisible = window.getComputedStyle(el).display !== 'none';
    el.style.display = isVisible ? 'none' : 'block';
    var btn = document.querySelector('[data-action="toggleDetail"][data-target="' + targetId + '"]');
    if(btn) btn.textContent = isVisible ? '展开详情' : '收起详情';
  },

  /**
   * 切换分析标签页UI（仅DOM操作）
   * @param {string} tab - 标签名
   */
  switchTabUI: (tab) => {
    document.querySelectorAll('.analysis-tab-btn').forEach(function(btn) {
      btn.classList.toggle('active', btn.dataset.analysisTab === tab);
    });
    var panels = { 'history': 'historyPanel', 'analysis': 'analysisPanelContent', 'zodiac': 'zodiacAnalysisPanel' };
    Object.keys(panels).forEach(function(key) {
      var panel = document.getElementById(panels[key]);
      if(panel) panel.classList.toggle('active', key === tab);
    });
  },

  /**
   * 更新加载更多按钮可见性
   * @param {boolean} visible
   */
  updateLoadMoreBtn: (visible) => {
    var loadMore = document.getElementById('loadMore');
    if(loadMore) loadMore.style.display = visible ? 'block' : 'none';
  },

  /**
   * 更新倒计时显示
   * @param {string} timeStr - HH:MM:SS
   */
  updateCountdown: (timeStr) => {
    var countdown = document.getElementById('countdown');
    if(countdown) countdown.innerText = timeStr;
  },

  /**
   * 同步分析选择器UI值（不包含业务逻辑）
   * @param {Object} vals
   */
  syncSelectors: (vals) => {
    if(vals.zodiacAnalyzeSelect) { var el = document.getElementById('zodiacAnalyzeSelect'); if(el) el.value = vals.zodiacAnalyzeSelect; }
    if(vals.zodiacCustomNum !== undefined) { var el = document.getElementById('zodiacCustomNum'); if(el) el.value = vals.zodiacCustomNum; }
    if(vals.analyzeSelect) { var el = document.getElementById('analyzeSelect'); if(el) el.value = vals.analyzeSelect; }
    if(vals.customNum !== undefined) { var el = document.getElementById('customNum'); if(el) el.value = vals.customNum; }
    if(vals.customNumCountVisible !== undefined) { var el = document.getElementById('customNumCount'); if(el) el.style.display = vals.customNumCountVisible ? 'inline-block' : 'none'; }
  },

  /**
   * 显示精选推荐号码 5 维算法回测弹窗（图片式排版）
   * @param {Object} backtestData - 由 ZodiacPrediction.runFinalZodiacBacktest 返回
   */
  showFinalBacktestModal: (backtestData) => {
    if (!backtestData || !backtestData.details) return;

    // 移除已存在的弹窗，避免重复
    var existing = document.getElementById('finalBacktestModal');
    if (existing) existing.remove();

    // 注入一次性动画样式
    if (!document.getElementById('finalBacktestAnimations')) {
      var styleEl = document.createElement('style');
      styleEl.id = 'finalBacktestAnimations';
      styleEl.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{transform:scale(0.95)}to{transform:scale(1)}}@keyframes fadeOut{from{opacity:1}to{opacity:0}}';
      document.head.appendChild(styleEl);
    }

    var overlay = document.createElement('div');
    overlay.id = 'finalBacktestModal';
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:16px;opacity:0;animation:fadeIn 0.25s ease forwards;';

    var html = '';
    html += '<div style="background:var(--card);border-radius:14px;width:100%;max-width:420px;max-height:86vh;overflow-y:auto;padding:18px;box-shadow:0 10px 40px rgba(0,0,0,0.3);transform:scale(0.95);animation:scaleIn 0.25s ease forwards;">';

    // 标题
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(128,128,128,0.18);">';
    html += '<h3 style="font-size:16px;font-weight:700;color:var(--text);margin:0;">📜 精选特码回测记录</h3>';
    html += '<button id="closeFinalBacktestBtn" style="background:none;border:none;font-size:24px;color:var(--sub-text);cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>';
    html += '</div>';

    // 统计概览
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;">';
    html += '<div style="background:var(--bg-secondary);padding:10px;border-radius:10px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">回测期数</div>';
    html += '<div style="font-size:18px;font-weight:700;color:var(--text);">' + backtestData.totalTests + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(48,209,88,0.12);padding:10px;border-radius:10px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">号码命中</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#30D158;">' + backtestData.totalHits + '</div>';
    html += '</div>';
    html += '<div style="background:rgba(10,132,255,0.12);padding:10px;border-radius:10px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">命中率</div>';
    html += '<div style="font-size:18px;font-weight:700;color:#0A84FF;">' + backtestData.totalHitRate + '%</div>';
    html += '</div>';
    html += '</div>';

    if (backtestData.currentStreak > 0) {
      html += '<div style="background:linear-gradient(135deg, rgba(255,159,10,0.15), rgba(255,159,10,0.06));border-left:3px solid #FF9F0A;padding:8px 12px;border-radius:8px;margin-bottom:12px;">';
      html += '<div style="font-size:12px;color:var(--sub-text);">当前号码连中</div>';
      html += '<div style="font-size:18px;font-weight:700;color:#FF9F0A;">' + backtestData.currentStreak + ' 期 🔥</div>';
      html += '</div>';
    }

    // 图片式回测记录
    html += '<div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:12px;">';
    html += '<div style="background:linear-gradient(180deg, #f7f7f7, #ececec);padding:8px 10px;font-size:12px;font-weight:700;color:#333;border-bottom:1px solid #e0e0e0;">';
    html += '📋 近期 ' + backtestData.recentTests + ' 期回测明细（5 维算法：头/尾/色/五行 + 跟随生肖）';
    html += '</div>';
    html += '<div style="max-height:46vh;overflow-y:auto;padding:2px 0;">';

    backtestData.details.forEach(function(item) {
      var hitTag = item.isHit ? '<span style="color:#fff;background:#30D158;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;margin-left:4px;">准</span>'
                                : '<span style="color:#fff;background:#FF3B30;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;margin-left:4px;">不</span>';
      var actualNumStr = String(item.actualNumber || 0).padStart(2, '0');
      // 5 个推荐号码：红色；若实际号码在其中则蓝色高亮
      var numsHtml = (item.recommendedNums || []).map(function(n) {
        var ns = String(n).padStart(2, '0');
        if (n === item.actualNumber) {
          return '<span style="color:#1e6dff;font-weight:700;">' + ns + '</span>';
        }
        return '<span style="color:#e02020;">' + ns + '</span>';
      }).join(' ');

      html += '<div style="display:flex;align-items:center;flex-wrap:wrap;padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;line-height:1.6;">';
      html += '<span style="font-weight:700;color:#1a1a1a;min-width:60px;">' + item.expect + '期</span>';
      html += '<span style="color:#1a1a1a;">:精选推荐</span>';
      html += '<span style="color:#1a1a1a;margin:0 2px;">【</span>';
      html += '<span style="letter-spacing:1px;">' + numsHtml + '</span>';
      html += '<span style="color:#1a1a1a;margin:0 2px;">】</span>';
      html += '<span style="color:#1a1a1a;">开:</span>';
      html += '<span style="color:#1e6dff;font-weight:700;">' + actualNumStr + '</span>';
      html += hitTag;
      html += '</div>';
    });

    html += '</div>';
    html += '</div>';

    // 底部说明
    html += '<div style="background:var(--bg-secondary);padding:10px 12px;border-radius:8px;font-size:11px;color:var(--sub-text);line-height:1.6;">';
    html += '• 算法：每期用其前 12 期窗口跑 5 维加权打分（头/尾/色/五行 + 跟随生肖）<br>';
    html += '• 推荐 Top5 号码 vs 实际特码对比判定命中<br>';
    html += '• 最近 ' + backtestData.recentTests + ' 期命中 <strong style="color:#30D158;">' + backtestData.recentHits + '</strong> 次 (' + backtestData.recentHitRate + '%)<br>';
    html += '• 数据仅供参考，不构成投资建议';
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 关闭按钮
    var closeBtn = document.getElementById('closeFinalBacktestBtn');
    if (closeBtn) {
      closeBtn.addEventListener('click', function() {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      });
    }
    // 点击遮罩关闭
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        overlay.style.animation = 'fadeOut 0.2s ease forwards';
        setTimeout(function() { overlay.remove(); }, 200);
      }
    });
  }
};