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

    // 渲染 01-49 号码统计表
    var numStatWrap = document.getElementById('numStatisticsTable');
    if(numStatWrap) {
      if(data.numStatistics && data.numStatistics.length > 0) {
        var html = '<div class="num-stat-row num-stat-head">'
          + '<div class="num-stat-cell">号码</div>'
          + '<div class="num-stat-cell">出现次数</div>'
          + '<div class="num-stat-cell">出现概率</div>'
          + '<div class="num-stat-cell">平均间隔</div>'
          + '<div class="num-stat-cell">最大间隔</div>'
          + '<div class="num-stat-cell">最小间隔</div>'
          + '<div class="num-stat-cell">当前遗漏</div>'
          + '</div>';
        for(var i = 0; i < data.numStatistics.length; i++) {
          var ns = data.numStatistics[i];
          var colorClass = (ns.count >= 4) ? 'hot' : (ns.count >= 2) ? 'warm' : (ns.count >= 1) ? 'normal' : 'cold';
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
    var entries = BusinessCommonSort.sortEntriesByValueDesc(Object.entries(dataObj));
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
   */
  renderRankToDOM: function(containerId, html) {
    var container = document.getElementById(containerId);
    if(container) container.innerHTML = html;
  }

};

// 挂载到 ViewAnalysis 以保持外部 API 兼容
if (typeof ViewAnalysis !== 'undefined') {
  ViewAnalysis.renderFullAnalysis = ViewAnalysisFull.renderFullAnalysis;
  ViewAnalysis.buildRankHtml = ViewAnalysisFull.buildRankHtml;
  ViewAnalysis.renderRankToDOM = ViewAnalysisFull.renderRankToDOM;
}
