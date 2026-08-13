/**
 * 视图层：分析页 - 全维度分析标签页
 * 职责：渲染全维度分析数据、排行表 HTML
 * 依赖方向：被 business/ 调用，仅做 DOM 渲染
 * 拆分记录：2026-06-09 从 view-analysis.js 拆分
 */
const ViewAnalysisFull = {

  /**
   * 渲染全维度分析（接收 Business.calcFullAnalysis() 预计算数据）
   */
  renderFullAnalysis: function(data) {
    const hotWrap = document.getElementById('hotWrap');
    const emptyTip = document.getElementById('emptyTip');
    
    if(!data) {
      if(hotWrap) hotWrap.style.display = 'none';
      if(emptyTip) emptyTip.style.display = 'block';
      return;
    }
    
    if(hotWrap) hotWrap.style.display = 'block';
    if(emptyTip) emptyTip.style.display = 'none';

    const setText = function(id, val) { const el = document.getElementById(id); if(el) el.innerText = val; };

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

    // v2.6.0 新增：给热门 TOP5 父 div 添加点击回测入口
    const hotNumberEl = document.getElementById('hotNumber');
    if (hotNumberEl && hotNumberEl.parentElement) {
      hotNumberEl.parentElement.setAttribute('data-action', 'showHotBacktest');
      hotNumberEl.parentElement.style.cursor = 'pointer';
      hotNumberEl.parentElement.style.transition = 'opacity 0.2s';
    }
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

    let tailHtml = '';
    if(data.tailArr) {
      for(let t = 0; t <= 9; t++) {
        tailHtml += '<div class="analysis-item"><div class="label">尾' + t + '</div><div class="value">' + (data.tailArr[t] || 0) + '</div></div>';
      }
    }
    const tailRow = document.getElementById('tailRow');
    if(tailRow) tailRow.innerHTML = tailHtml;

    if(data.rankHtmls) {
      const rankKeys = ['singleDoubleRank', 'bigSmallRank', 'rangeRank', 'headRank', 'tailRank', 'colorRank', 'wuxingRank', 'animalRank', 'zodiacRank'];
      rankKeys.forEach(function(k) {
        const el = document.getElementById(k);
        if(el && data.rankHtmls[k]) el.innerHTML = data.rankHtmls[k];
      });
    }

    // 渲染 01-49 号码统计表
    const numStatWrap = document.getElementById('numStatisticsTable');
    if(numStatWrap) {
      if(data.numStatistics && data.numStatistics.length > 0) {
        let html = '<div class="num-stat-row num-stat-head">'
          + '<div class="num-stat-cell">号码</div>'
          + '<div class="num-stat-cell">出现次数</div>'
          + '<div class="num-stat-cell">出现概率</div>'
          + '<div class="num-stat-cell">平均间隔</div>'
          + '<div class="num-stat-cell">最大间隔</div>'
          + '<div class="num-stat-cell">最小间隔</div>'
          + '<div class="num-stat-cell">当前遗漏</div>'
          + '</div>';
        for(let i = 0; i < data.numStatistics.length; i++) {
          const ns = data.numStatistics[i];
          const colorClass = (ns.count >= 4) ? 'hot' : (ns.count >= 2) ? 'warm' : (ns.count >= 1) ? 'normal' : 'cold';
          html += '<div class="num-stat-row num-stat-' + colorClass + '">'
            + '<div class="num-stat-cell num-stat-num">' + ns.num + '</div>'
            + '<div class="num-stat-cell">' + ns.count + '</div>'
            + '<div class="num-stat-cell">' + ns.rate + '%</div>'
            + '<div class="num-stat-cell">' + ns.avgGap + '</div>'
            + '<div class="num-stat-cell">' + ns.maxGap + '</div>'
            + '<div class="num-stat-cell">' + ns.minGap + '</div>'
            + '<div class="num-stat-cell">' + ns.currentMiss + '</div>'
            + '</div>';
        }
        numStatWrap.innerHTML = html;
      } else {
        // 数据未生成（缓存旧 JS 或 calcFullAnalysis 抛错）
        numStatWrap.innerHTML = '<div class="num-stat-empty">号码统计未生成，请刷新页面或检查控制台错误（尝试:Business.calcFullAnalysis().numStatistics）</div>';
      }
    }
  },

  /**
   * 渲染完整排行表HTML（不写入DOM，返回HTML供调用方使用）
   */
  buildRankHtml: function(dataObj, total, missMap) {
    if(total === 0 || !dataObj) return '';
    const entries = BusinessCommonSort.sortEntriesByValueDesc(Object.entries(dataObj));
    let html = '<div class="rank-header"><div class="rank-no">名次</div><div class="rank-name">分类</div><div class="rank-count">次数</div><div class="rank-rate">占比</div><div class="rank-miss">遗漏</div></div>';
    entries.forEach(function(entry, idx) {
      const name = entry[0], count = entry[1];
      const rate = ((count / total) * 100).toFixed(0) + '%';
      let miss;
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
   */
  renderRankToDOM: function(containerId, html) {
    const container = document.getElementById(containerId);
    if(container) container.innerHTML = html;
  },

  /**
   * 显示热门号码回测弹窗（v2.6.0 新增）
   * 视图层：仅渲染 DOM，不做业务计算
   * @param {Object} backtestData - 回测汇总数据 { totalTests, totalHits, totalHitRate, details }
   */
  showHotBacktestModal: function(backtestData) {
    if (!backtestData || !backtestData.details || !backtestData.details.length) return;

    const modalId = 'hotBacktestModal';
    const existingModal = document.getElementById(modalId);
    if (existingModal) existingModal.remove();

    const overlay = document.createElement('div');
    overlay.id = modalId;
    overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);display:flex;align-items:center;justify-content:center;z-index:10000;padding:20px;opacity:0;animation:fadeIn 0.25s ease forwards;';

    const bd = backtestData;
    const hl = '#FF6B35';

    let html = '';
    html += '<div style="background:var(--card);border-radius:16px;width:100%;max-width:420px;max-height:80vh;overflow-y:auto;padding:20px;box-shadow:0 10px 40px rgba(0,0,0,0.3);transform:scale(0.95);animation:scaleIn 0.25s ease forwards;">';

    // 标题
    html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">';
    html += '<h3 style="font-size:17px;font-weight:700;color:var(--text);margin:0;">🔥 热门特码回测追踪</h3>';
    html += '<button id="closeHotBacktestBtn" style="background:none;border:none;font-size:24px;color:var(--sub-text);cursor:pointer;padding:4px 8px;line-height:1;">&times;</button>';
    html += '</div>';

    // 统计概览
    html += '<div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px;">';
    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:12px;text-align:center;">';
    html += '<div style="font-size:11px;color:var(--sub-text);margin-bottom:4px;">回测期数</div>';
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

    // 详情列表
    html += '<div style="margin-bottom:12px;">';
    html += '<div style="font-size:13px;font-weight:600;color:var(--text);margin-bottom:10px;">最近 ' + bd.totalTests + ' 期详情</div>';
    html += '<div style="display:flex;flex-direction:column;gap:6px;">';

    (bd.details || []).forEach(function(item) {
      const hitBg = item.isHit ? 'rgba(59,130,246,0.12)' : 'rgba(255,69,58,0.12)';
      const hitColor = item.isHit ? '#3B82F6' : '#FF453A';
      const hitIcon = item.isHit ? '✓' : '✗';

      html += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-radius:8px;background:' + hitBg + ';color:' + hitColor + ';">';
      html += '<span style="font-size:12px;font-weight:600;min-width:80px;">' + item.expect + '期</span>';
      html += '<span style="font-size:14px;font-weight:700;">' + item.actualNumber + '</span>';
      html += '<span style="font-size:11px;font-weight:600;color:var(--sub-text);max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">TOP5:' + item.top5 + '</span>';
      html += '<span style="font-size:16px;font-weight:700;">' + hitIcon + '</span>';
      html += '</div>';
    });

    html += '</div></div>';

    // 底部说明
    html += '<div style="background:var(--bg-secondary);padding:12px;border-radius:8px;margin-top:12px;">';
    html += '<div style="font-size:11px;color:var(--sub-text);line-height:1.5;">• 算法：统计最近 ' + (bd.windowSize || 12) + ' 期号码出现频率，取 TOP5 最热号码<br>• 与"特码热门TOP5"展示算法完全一致<br>• 数据仅供参考，不构成投资建议</div>';
    html += '</div>';

    html += '</div>';
    overlay.innerHTML = html;
    document.body.appendChild(overlay);

    // 关闭逻辑
    const closeHandler = function() {
      overlay.style.animation = 'fadeOut 0.2s ease forwards';
      setTimeout(function() { overlay.remove(); }, 200);
    };
    const closeBtn = document.getElementById('closeHotBacktestBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeHandler);
    overlay.addEventListener('click', function(e) { if (e.target === overlay) closeHandler(); });

    // 注入动画样式（复用已有动画 keyframes）
    if (!document.getElementById('backtestModalAnimations')) {
      const styleSheet = document.createElement('style');
      styleSheet.id = 'backtestModalAnimations';
      styleSheet.textContent = '@keyframes fadeIn{from{opacity:0}to{opacity:1}}@keyframes scaleIn{from{transform:scale(0.95)}to{transform:scale(1)}}@keyframes fadeOut{from{opacity:1}to{opacity:0}}';
      document.head.appendChild(styleSheet);
    }
  }

};

// 挂载到 ViewAnalysis 以保持外部 API 兼容
if (typeof ViewAnalysis !== 'undefined') {
  ViewAnalysis.renderFullAnalysis = ViewAnalysisFull.renderFullAnalysis;
  ViewAnalysis.buildRankHtml = ViewAnalysisFull.buildRankHtml;
  ViewAnalysis.renderRankToDOM = ViewAnalysisFull.renderRankToDOM;
  ViewAnalysis.showHotBacktestModal = ViewAnalysisFull.showHotBacktestModal;
}
