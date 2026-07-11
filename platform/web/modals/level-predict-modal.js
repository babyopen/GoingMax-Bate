/**
 * 平台层：等级预测回测弹窗（2026-07-12 用户需求）
 *   职责：弹窗 DOM 创建、显示/隐藏、内容渲染
 *   依赖：业务层 ZodiacTongJi.predictLevelBacktest
 */
const LevelPredictModal = {
  _modal: null,
  _backtestData: null,

  init: function() {
    if (LevelPredictModal._modal) return;

    LevelPredictModal._modal = document.createElement('div');
    LevelPredictModal._modal.id = 'level-predict-modal';
    LevelPredictModal._modal.style.cssText = [
      'position:fixed;top:0;left:0;right:0;bottom:0;',
      'background:rgba(0,0,0,0.5);',
      'display:flex;align-items:center;justify-content:center;',
      'z-index:1001;opacity:0;visibility:hidden;',
      'transition:all 0.3s ease;'
    ].join('');

    LevelPredictModal._modal.innerHTML = [
      '<div style="',
        'background:#fff;border-radius:16px;padding:20px;',
        'width:92%;max-width:400px;max-height:85vh;',
        'overflow-y:auto;box-shadow:0 10px 40px rgba(0,0,0,0.2);',
        'transform:scale(0.9);transition:transform 0.3s ease;',
      '">',
        '<div style="',
          'display:flex;justify-content:space-between;align-items:center;',
          'margin-bottom:16px;padding-bottom:12px;',
          'border-bottom:1px solid #eee;',
        '">',
          '<div id="level-predict-modal-title" style="',
            'font-size:17px;font-weight:700;color:#1a1a1a;',
          '"></div>',
          '<button id="level-predict-modal-close" style="',
            'background:none;border:none;font-size:24px;color:#999;',
            'cursor:pointer;padding:0;width:32px;height:32px;',
            'display:flex;align-items:center;justify-content:center;',
          '">×</button>',
        '</div>',
        '<div id="level-predict-modal-content"></div>',
        '<div style="',
          'display:flex;gap:12px;margin-top:20px;',
        '">',
          '<button id="level-predict-modal-confirm" style="',
            'flex:1;padding:12px;border:none;border-radius:8px;',
            'background:#007bff;color:#fff;font-size:14px;cursor:pointer;',
          '">关闭</button>',
        '</div>',
      '</div>'
    ].join('');

    document.body.appendChild(LevelPredictModal._modal);

    // 关闭事件
    document.getElementById('level-predict-modal-close').addEventListener('click', function() {
      LevelPredictModal.hide();
    });
    document.getElementById('level-predict-modal-confirm').addEventListener('click', function() {
      LevelPredictModal.hide();
    });
    LevelPredictModal._modal.addEventListener('click', function(e) {
      if (e.target === LevelPredictModal._modal) LevelPredictModal.hide();
    });

    // 暗色模式
    var darkStyle = document.createElement('style');
    darkStyle.id = 'level-predict-modal-dark';
    darkStyle.textContent = [
      '@media (prefers-color-scheme: dark) {',
        '#level-predict-modal > div { background: #1C1C1E !important; }',
        '#level-predict-modal-title { color: #FFFFFF !important; }',
        '#level-predict-modal-close { color: #FFFFFF !important; }',
        '#level-predict-modal-confirm { background: #0A84FF !important; }',
        '#level-predict-modal-content table { color: #FFFFFF; }',
        '#level-predict-modal-content th { background: #2C2C2E !important; color: #98989F !important; }',
        '#level-predict-modal-content td { border-color: #38383A !important; }',
        '#level-predict-modal-content .lp-backtest-hit { background: rgba(52,199,89,0.15) !important; }',
        '#level-predict-modal-content .lp-backtest-miss { background: rgba(255,59,48,0.08) !important; }',
      '}'
    ].join('');
    document.head.appendChild(darkStyle);
  },

  /**
   * 显示回测弹窗
   * @param {Object} backtestData - 业务层 predictLevelBacktest 返回结果
   */
  show: function(backtestData) {
    if (!LevelPredictModal._modal) LevelPredictModal.init();

    LevelPredictModal._backtestData = backtestData;

    var titleEl = document.getElementById('level-predict-modal-title');
    var contentEl = document.getElementById('level-predict-modal-content');

    titleEl.innerText = '等级预测回测追踪';

    if (!backtestData || !backtestData.results || !backtestData.results.length) {
      contentEl.innerHTML = '<div style="padding:20px;text-align:center;color:#999;">数据不足，至少需要 21 期历史</div>';
      LevelPredictModal._showOverlay();
      return;
    }

    var html = '';

    // 汇总卡片
    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:16px;">';
    html += '<div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">';
    html += '<div style="font-size:11px;color:#999;margin-bottom:4px;">回测期数</div>';
    html += '<div style="font-size:20px;font-weight:800;color:#1a1a1a;">' + backtestData.total + '</div>';
    html += '</div>';
    html += '<div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">';
    html += '<div style="font-size:11px;color:#999;margin-bottom:4px;">命中次数</div>';
    html += '<div style="font-size:20px;font-weight:800;color:#34c759;">' + backtestData.hits + '</div>';
    html += '</div>';
    html += '<div style="background:#f5f5f5;padding:12px;border-radius:8px;text-align:center;">';
    html += '<div style="font-size:11px;color:#999;margin-bottom:4px;">命中率</div>';
    var rateColor = backtestData.hitRate >= 50 ? '#34c759' : backtestData.hitRate >= 33 ? '#ff9500' : '#ff3b30';
    html += '<div style="font-size:20px;font-weight:800;color:' + rateColor + ';">' + backtestData.hitRate + '%</div>';
    html += '</div>';
    html += '</div>';

    // 命中率进度条
    html += '<div style="height:6px;background:#eee;border-radius:3px;margin-bottom:16px;overflow:hidden;">';
    html += '<div style="height:100%;width:' + backtestData.hitRate + '%;background:' + rateColor + ';border-radius:3px;"></div>';
    html += '</div>';

    // 逐期明细表格
    html += '<div style="font-size:13px;font-weight:600;color:#666;margin-bottom:8px;">逐期明细</div>';
    html += '<div style="max-height:360px;overflow-y:auto;">';
    html += '<table style="width:100%;border-collapse:collapse;font-size:11px;">';
    html += '<thead><tr style="background:#f5f5f5;position:sticky;top:0;">';
    html += '<th style="padding:6px 4px;text-align:left;color:#999;">期号</th>';
    html += '<th style="padding:6px 4px;text-align:center;color:#999;">号码</th>';
    html += '<th style="padding:6px 4px;text-align:center;color:#999;">实际等级</th>';
    html += '<th style="padding:6px 4px;text-align:center;color:#999;">漏</th>';
    html += '<th style="padding:6px 4px;text-align:left;color:#999;">预测 Top3</th>';
    html += '<th style="padding:6px 4px;text-align:center;color:#999;">结果</th>';
    html += '</tr></thead>';
    html += '<tbody>';

    var results = backtestData.results;
    // results 已按时间顺序（从旧到新），显示最近 50 条
    var displayList = results.length > 50 ? results.slice(results.length - 50) : results;

    displayList.forEach(function(r) {
      var rowBg = r.hit
        ? 'background:rgba(52,199,89,0.06);'
        : 'background:rgba(255,59,48,0.03);';
      var resultText = r.hit ? '命中' : '未中';
      var resultColor = r.hit ? '#34c759' : '#ff3b30';
      var levelCls = 'tj-level-' + r.actualLevel;

      html += '<tr class="lp-backtest-' + (r.hit ? 'hit' : 'miss') + '" style="' + rowBg + '">';
      html += '<td style="padding:5px 4px;border-bottom:1px solid #eee;">' + r.expect + '</td>';
      html += '<td style="padding:5px 4px;text-align:center;font-weight:700;border-bottom:1px solid #eee;">' + (r.num < 10 ? '0' + r.num : r.num) + '</td>';
      html += '<td style="padding:5px 4px;text-align:center;border-bottom:1px solid #eee;">' + r.actualEmoji + ' ' + r.actualName + '</td>';
      html += '<td style="padding:5px 4px;text-align:center;border-bottom:1px solid #eee;">' + r.miss + '</td>';
      html += '<td style="padding:5px 4px;border-bottom:1px solid #eee;font-size:10px;">' + r.top3Names.join(' / ') + '</td>';
      html += '<td style="padding:5px 4px;text-align:center;font-weight:700;color:' + resultColor + ';border-bottom:1px solid #eee;">' + resultText + '</td>';
      html += '</tr>';
    });

    if (results.length > 50) {
      html += '<tr><td colspan="6" style="padding:8px;text-align:center;color:#999;font-size:11px;">仅显示最近 50 条，共 ' + results.length + ' 条</td></tr>';
    }

    html += '</tbody></table>';
    html += '</div>';

    contentEl.innerHTML = html;
    LevelPredictModal._showOverlay();
  },

  _showOverlay: function() {
    LevelPredictModal._modal.style.opacity = '1';
    LevelPredictModal._modal.style.visibility = 'visible';
    LevelPredictModal._modal.querySelector('div').style.transform = 'scale(1)';
  },

  hide: function() {
    if (!LevelPredictModal._modal) return;
    LevelPredictModal._modal.style.opacity = '0';
    LevelPredictModal._modal.style.visibility = 'hidden';
    LevelPredictModal._modal.querySelector('div').style.transform = 'scale(0.9)';
    LevelPredictModal._backtestData = null;
  }
};