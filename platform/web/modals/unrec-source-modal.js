/**
 * 未推荐生肖 - 「查看来源」弹窗（platform 层）
 * 用于展示 ①②③ 各源推荐与合并去重数据
 * 接收纯 html 内容（由视图层拼接），弹窗本身只负责壳与显隐
 */
const UnrecSourceModal = {
  _modal: null,

  init: () => {
    if (UnrecSourceModal._modal) return;

    UnrecSourceModal._modal = document.createElement('div');
    UnrecSourceModal._modal.id = 'unrec-source-modal';
    UnrecSourceModal._modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1001;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    `;
    UnrecSourceModal._modal.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 16px;
        padding: 20px;
        width: 90%;
        max-width: 360px;
        max-height: 80vh;
        overflow-y: auto;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        transform: scale(0.9);
        transition: transform 0.3s ease;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #eee;
        ">
          <div id="unrec-source-title" style="
            font-size: 18px;
            font-weight: 600;
            color: #1a1a1a;
          "></div>
          <button id="unrec-source-close" style="
            background: none;
            border: none;
            font-size: 24px;
            color: #999;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
          ">×</button>
        </div>
        <div id="unrec-source-content"></div>
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button id="unrec-source-confirm" style="
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #007bff;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          ">关闭</button>
        </div>
      </div>
    `;
    document.body.appendChild(UnrecSourceModal._modal);

    document.getElementById('unrec-source-close').addEventListener('click', UnrecSourceModal.hide);
    document.getElementById('unrec-source-confirm').addEventListener('click', UnrecSourceModal.hide);
    UnrecSourceModal._modal.addEventListener('click', function(e) {
      if (e.target === UnrecSourceModal._modal) UnrecSourceModal.hide();
    });

    // 暗色模式适配（参照 zodiac-stat-modal 风格）
    var darkStyle = document.createElement('style');
    darkStyle.id = 'unrec-source-modal-dark-style';
    darkStyle.textContent = `
      @media (prefers-color-scheme: dark) {
        #unrec-source-modal > div {
          background: #1C1C1E !important;
        }
        #unrec-source-title { color: #FFFFFF !important; }
        #unrec-source-close  { color: #FFFFFF !important; }
        #unrec-source-confirm { background: #0A84FF !important; }
        #unrec-source-content .unrec-source-title { color: #FFFFFF !important; }
        #unrec-source-content .unrec-chip { background: rgba(255,255,255,0.08) !important; color: #FFFFFF !important; }
        #unrec-source-content .unrec-empty-tip { color: #98989F !important; }
        #unrec-source-content .unrec-merged-title { color: #FFFFFF !important; }
      }
    `;
    document.head.appendChild(darkStyle);
  },

  /**
   * 显示「查看来源」弹窗
   * @param {string} title - 弹窗标题
   * @param {string} html  - 已拼接好的内容 html（由视图层生成）
   */
  show: function(title, html) {
    if (!UnrecSourceModal._modal) UnrecSourceModal.init();
    document.getElementById('unrec-source-title').innerText = title || '查看来源';
    document.getElementById('unrec-source-content').innerHTML = html || '';
    UnrecSourceModal._modal.style.opacity = '1';
    UnrecSourceModal._modal.style.visibility = 'visible';
    UnrecSourceModal._modal.querySelector('div').style.transform = 'scale(1)';
  },

  hide: () => {
    if (!UnrecSourceModal._modal) return;
    UnrecSourceModal._modal.style.opacity = '0';
    UnrecSourceModal._modal.style.visibility = 'hidden';
    UnrecSourceModal._modal.querySelector('div').style.transform = 'scale(0.9)';
  }
};
