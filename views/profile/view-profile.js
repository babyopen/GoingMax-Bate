/**
 * 视图层：我的（Profile）页面渲染
 * @namespace ViewProfile
 * 职责：只做 DOM 渲染，动态注入到已有面板，不修改 index.html 已有 DOM
 * 依赖方向：被 event.js 调用（事件层 → 视图层）
 * 红线：不调用业务层、不做计算、不绑定事件
 */
const ViewProfile = {

  /**
   * 渲染"使用说明"卡片到 #profileMinePanel（动态注入，不破坏已有 DOM）
   * 已注入则跳过（幂等）。
   */
  renderHelpCard: function() {
    var panel = document.getElementById('profileMinePanel');
    if (!panel) return;

    // 已存在则不再重复注入
    if (document.getElementById('profileHelpCard')) return;

    var helpCard = document.createElement('div');
    helpCard.className = 'card';
    helpCard.id = 'profileHelpCard';

    var version = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.VERSION) ? CONFIG.VERSION : 'Beta';
    var dataVersion = (typeof CONFIG !== 'undefined' && CONFIG && CONFIG.DATA_VERSION) ? CONFIG.DATA_VERSION : '-';

    helpCard.innerHTML =
      '<div class="card-header">' +
        '<h2>使用说明</h2>' +
      '</div>' +
      '<div class="card-body">' +
        '<div style="font-size:13px;line-height:1.7;color:var(--text);">' +
          '<div style="margin-bottom:10px;padding:8px 12px;background:var(--bg-secondary);border-radius:8px;">' +
            '<div style="font-size:12px;color:var(--sub-text);margin-bottom:2px;">当前版本</div>' +
            '<div style="font-weight:600;">v' + version + '（数据版本：' + dataVersion + '）</div>' +
          '</div>' +
          '<div style="margin-bottom:8px;">' +
            '<div style="font-weight:600;margin-bottom:4px;">📌 主要功能</div>' +
            '<div style="color:var(--sub-text);">· 历史开奖查询与走势分析</div>' +
            '<div style="color:var(--sub-text);">· 生肖 / 波色 / 五行等多维预测</div>' +
            '<div style="color:var(--sub-text);">· 滑动窗口算法推荐 + 回测追踪</div>' +
            '<div style="color:var(--sub-text);">· 终极算法自适应模式</div>' +
          '</div>' +
          '<div style="margin-bottom:8px;">' +
            '<div style="font-weight:600;margin-bottom:4px;">⚠️ 重要提示</div>' +
            '<div style="color:var(--sub-text);">· 本工具仅供娱乐与数据分析参考</div>' +
            '<div style="color:var(--sub-text);">· 不构成任何投注建议</div>' +
            '<div style="color:var(--sub-text);">· 数据陈旧时预测结果不可靠</div>' +
          '</div>' +
          '<div style="color:var(--sub-text);font-size:11px;text-align:center;padding-top:8px;border-top:1px solid var(--border);">' +
            '请理性使用，祝您生活愉快 🙏' +
          '</div>' +
        '</div>' +
      '</div>';

    panel.appendChild(helpCard);
  },

  /**
   * 切换『我的』页面子 tab 的 UI（仅渲染 DOM，不做业务）
   * @param {string} tab - mine / official / phoenix / daxian / max
   */
  switchProfileTabUI: function(tab) {
    ViewCommon.switchTabUI({
      tabSelector: '#profilePage .zodiac-tab-btn[data-profile-tab]',
      tabDataAttr: 'profileTab',
      panelMap: {
        mine: 'profileMinePanel',
        official: 'profileOfficialPanel',
        phoenix: 'profilePhoenixPanel',
        daxian: 'profileDaxianPanel',
        max: 'profileMaxPanel'
      },
      navBtnSelector: '.nav-tab[data-page="profile"]'
    }, tab);
  }
};