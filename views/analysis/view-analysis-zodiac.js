/**
 * 视图层：分析页 - 生肖关联分析标签页
 * 职责：渲染生肖关联分析、精选特码回测弹窗
 * 依赖方向：被 business/ 调用，仅做 DOM 渲染
 * 拆分记录：2026-06-09 从 view-analysis.js 拆分
 */
const ViewAnalysisZodiac = {

  /**
   * 渲染生肖关联分析（接收预处理的渲染数据）
   */
  renderZodiacAnalysis: function(renderData) {
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
   * 显示精选推荐号码 5 维算法回测弹窗（图片式排版）
   */
  showFinalBacktestModal: function(backtestData, nextPredictText, nextExpect) {
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

    // 下期预测独立卡片（2026-07-21 从回测明细抽出，置于统计概览之后、明细列表之前）
    if (nextPredictText) {
      var pureNums = nextPredictText.replace('✅ 精选特码：', '').trim();
      var predictNumsArr = pureNums.split(' ').filter(Boolean);
      // 下期号优先用 event.js 传入的 nextExpect（基于 historyData[0] 最新一期），
      //   兜底用 details[0].expect + 1
      var _nextExpLabel = '';
      if (nextExpect) {
        _nextExpLabel = String(nextExpect);
      } else if (backtestData.details && backtestData.details[0] && backtestData.details[0].expect) {
        _nextExpLabel = String(Number(backtestData.details[0].expect) + 1);
      }
      // 号码蓝色显示（区别于回测行的红字推荐 + 蓝字命中）
      var predictNumsHtml = predictNumsArr.map(function(n) {
        return '<span style="color:#0A84FF;">' + Utils.formatNum(Number(n)) + '</span>';
      }).join(' ');

      html += '<div style="background:linear-gradient(135deg, rgba(10,132,255,0.10), rgba(10,132,255,0.04));border:1px solid rgba(10,132,255,0.25);border-radius:10px;padding:10px 12px;margin-bottom:12px;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
      html += '<div style="font-size:13px;font-weight:700;color:#0A84FF;">🔮 下期预测 · ' + _nextExpLabel + '期</div>';
      html += '<button data-action="copyPredictNums" data-predict-nums="' + pureNums.replace(/"/g, '&quot;') + '" style="background:rgba(10,132,255,0.15);border:none;color:#0A84FF;font-size:10px;padding:2px 8px;border-radius:4px;cursor:pointer;white-space:nowrap;">📋 复制</button>';
      html += '</div>';
      html += '<div style="font-size:13px;line-height:1.7;">';
      html += '<span style="color:#1a1a1a;">【</span>';
      html += '<span style="letter-spacing:1px;">' + predictNumsHtml + '</span>';
      html += '<span style="color:#1a1a1a;">】</span>';
      html += '<span style="color:#1a1a1a;margin-left:6px;">开:</span>';
      html += '<span style="color:#1a1a1a;font-weight:700;">—</span>';
      html += '<span style="color:#fff;background:#0A84FF;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;margin-left:6px;">待开奖</span>';
      html += '</div>';
      html += '</div>';
    }

    // 图片式回测记录
    html += '<div style="background:#fff;border:1px solid #e0e0e0;border-radius:8px;overflow:hidden;margin-bottom:12px;">';
    html += '<div style="background:linear-gradient(180deg, #f7f7f7, #ececec);padding:8px 10px;font-size:12px;font-weight:700;color:#333;border-bottom:1px solid #e0e0e0;">';
    html += '📋 近期 ' + backtestData.recentTests + ' 期回测明细（红字=算法25推荐，灰字=随机补足5个，蓝字=命中）';
    html += '</div>';
    html += '<div style="max-height:46vh;overflow-y:auto;padding:2px 0;">';

    backtestData.details.forEach(function(item) {
      var hitTag = item.isHit ? '<span style="color:#fff;background:#30D158;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;margin-left:4px;">准</span>'
                                : '<span style="color:#fff;background:#FF3B30;padding:1px 6px;border-radius:4px;font-size:11px;font-weight:700;margin-left:4px;">错</span>';
      var actualNumStr = Utils.formatNum(item.actualNumber || 0);
      // 推荐号码：算法推荐红字 + 随机补足灰字；若实际号码在其中则蓝色高亮
      var numsHtml = (item.recommendedNums || []).map(function(item2) {
        var n = typeof item2 === 'object' ? item2.num : item2;
        var isRandom = typeof item2 === 'object' && item2.isRandom === true;
        var ns = Utils.formatNum(n);
        if (n === item.actualNumber) {
          return '<span style="color:#1e6dff;font-weight:700;">' + ns + '</span>';
        }
        // 随机补足号码用灰色显示，区别于算法推荐红字
        if (isRandom) {
          return '<span style="color:#9aa0a6;">' + ns + '</span>';
        }
        return '<span style="color:#e02020;">' + ns + '</span>';
      }).join(' ');

      html += '<div style="display:flex;align-items:center;flex-wrap:wrap;padding:7px 10px;border-bottom:1px solid #f0f0f0;font-size:13px;line-height:1.6;">';
      html += '<span style="font-weight:700;color:#1a1a1a;min-width:60px;">' + item.expect + '期</span>';
      html += '<span style="color:#1a1a1a;margin:0 2px;">【</span>';
      html += '<span style="letter-spacing:1px;">' + numsHtml + '</span>';
      html += '<span style="color:#1a1a1a;margin:0 2px;">】</span>';
      html += '<span style="color:#1a1a1a;">开:</span>';
      html += '<span style="color:#1e6dff;font-weight:700;">' + actualNumStr + '</span>';
      html += hitTag;
      html += '</div>';
    });

// 下期预测行已移至回测明细最前（2026-07-14 调整位置）

    html += '</div>';
    html += '</div>';

    // 底部说明
    html += '<div style="background:var(--bg-secondary);padding:10px 12px;border-radius:8px;font-size:11px;color:var(--sub-text);line-height:1.6;">';
    html += '• 算法：每期用其前 12 期窗口跑 5 维加权打分（头/尾/色/五行 + 跟随生肖）<br>';
    html += '• 展示 25 个算法推荐号 + 5 个从 1-49 随机补足号，共 30 个 vs 实际特码判定<br>';
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

// 挂载到 ViewAnalysis 以保持外部 API 兼容
if (typeof ViewAnalysis !== 'undefined') {
  ViewAnalysis.renderZodiacAnalysis = ViewAnalysisZodiac.renderZodiacAnalysis;
  ViewAnalysis.showFinalBacktestModal = ViewAnalysisZodiac.showFinalBacktestModal;
}
