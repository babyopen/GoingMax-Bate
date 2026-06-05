const GIONGBETA_CONFIRM_MODAL = {
  _callback: null,
  _modal: null,
  _message: null,
  _cancelBtn: null,
  _confirmBtn: null,

  init: () => {
    GIONGBETA_CONFIRM_MODAL._modal = document.createElement('div');
    GIONGBETA_CONFIRM_MODAL._modal.id = 'giongbeta-confirm-modal';
    GIONGBETA_CONFIRM_MODAL._modal.style.cssText = `
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
    GIONGBETA_CONFIRM_MODAL._modal.innerHTML = `
      <div style="
        background: var(--card, #fff);
        border-radius: 12px;
        padding: 24px;
        width: 85%;
        max-width: 320px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        transform: scale(0.9);
        transition: transform 0.3s ease;
      ">
        <div id="giongbeta-confirm-message" style="
          font-size: 15px;
          color: var(--text, #1a1a1a);
          margin-bottom: 24px;
          text-align: center;
          line-height: 1.5;
        "></div>
        <div style="display: flex; gap: 12px;">
          <button id="giongbeta-confirm-cancel" style="
            flex: 1;
            padding: 12px;
            border: 1px solid var(--border, #e0e0e0);
            border-radius: 8px;
            background: var(--card, #fff);
            color: var(--sub-text, #666);
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          ">取消</button>
          <button id="giongbeta-confirm-ok" style="
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: var(--danger, #ff3b30);
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            transition: opacity 0.2s;
          ">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(GIONGBETA_CONFIRM_MODAL._modal);

    GIONGBETA_CONFIRM_MODAL._message = document.getElementById('giongbeta-confirm-message');
    GIONGBETA_CONFIRM_MODAL._cancelBtn = document.getElementById('giongbeta-confirm-cancel');
    GIONGBETA_CONFIRM_MODAL._confirmBtn = document.getElementById('giongbeta-confirm-ok');
    
    GIONGBETA_CONFIRM_MODAL._cancelBtn.addEventListener('click', () => {
      GIONGBETA_CONFIRM_MODAL.hide();
      if(GIONGBETA_CONFIRM_MODAL._callback) {
        GIONGBETA_CONFIRM_MODAL._callback(false);
        GIONGBETA_CONFIRM_MODAL._callback = null;
      }
    });

    GIONGBETA_CONFIRM_MODAL._confirmBtn.addEventListener('click', () => {
      GIONGBETA_CONFIRM_MODAL.hide();
      if(GIONGBETA_CONFIRM_MODAL._callback) {
        GIONGBETA_CONFIRM_MODAL._callback(true);
        GIONGBETA_CONFIRM_MODAL._callback = null;
      }
    });

    GIONGBETA_CONFIRM_MODAL._modal.addEventListener('click', (e) => {
      if(e.target === GIONGBETA_CONFIRM_MODAL._modal) {
        GIONGBETA_CONFIRM_MODAL.hide();
        if(GIONGBETA_CONFIRM_MODAL._callback) {
          GIONGBETA_CONFIRM_MODAL._callback(false);
          GIONGBETA_CONFIRM_MODAL._callback = null;
        }
      }
    });
  },

  show: (message, callback) => {
    if(!GIONGBETA_CONFIRM_MODAL._modal) {
      GIONGBETA_CONFIRM_MODAL.init();
    }
    
    GIONGBETA_CONFIRM_MODAL._message.innerText = message;
    GIONGBETA_CONFIRM_MODAL._callback = callback;
    
    GIONGBETA_CONFIRM_MODAL._modal.style.opacity = '1';
    GIONGBETA_CONFIRM_MODAL._modal.style.visibility = 'visible';
    GIONGBETA_CONFIRM_MODAL._modal.querySelector('div').style.transform = 'scale(1)';
  },

  hide: () => {
    if(!GIONGBETA_CONFIRM_MODAL._modal) return;
    
    GIONGBETA_CONFIRM_MODAL._modal.style.opacity = '0';
    GIONGBETA_CONFIRM_MODAL._modal.style.visibility = 'hidden';
    GIONGBETA_CONFIRM_MODAL._modal.querySelector('div').style.transform = 'scale(0.9)';
  }
};