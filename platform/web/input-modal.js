const GIONGBETA_INPUT_MODAL = {
  _callback: null,
  _modal: null,
  _input: null,
  _title: null,

  init: () => {
    GIONGBETA_INPUT_MODAL._modal = document.createElement('div');
    GIONGBETA_INPUT_MODAL._modal.id = 'giongbeta-input-modal';
    GIONGBETA_INPUT_MODAL._modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    `;
    GIONGBETA_INPUT_MODAL._modal.innerHTML = `
      <div style="
        background: #fff;
        border-radius: 12px;
        padding: 24px;
        width: 85%;
        max-width: 320px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
        transform: scale(0.9);
        transition: transform 0.3s ease;
      ">
        <div id="giongbeta-modal-title" style="
          font-size: 16px;
          font-weight: 600;
          color: #1a1a1a;
          margin-bottom: 16px;
          text-align: center;
        "></div>
        <input id="giongbeta-modal-input" type="text" style="
          width: 100%;
          padding: 12px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          outline: none;
          transition: border-color 0.2s;
        " placeholder="输入要排除的号码，空格/逗号/顿号/引号/竖线/点/横线分隔">
        <div style="display: flex; gap: 12px; margin-top: 20px;">
          <button id="giongbeta-modal-cancel" style="
            flex: 1;
            padding: 12px;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            background: #fff;
            color: #666;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          ">取消</button>
          <button id="giongbeta-modal-confirm" style="
            flex: 1;
            padding: 12px;
            border: none;
            border-radius: 8px;
            background: #007bff;
            color: #fff;
            font-size: 14px;
            cursor: pointer;
            transition: background 0.2s;
          ">确定</button>
        </div>
      </div>
    `;
    document.body.appendChild(GIONGBETA_INPUT_MODAL._modal);

    GIONGBETA_INPUT_MODAL._title = document.getElementById('giongbeta-modal-title');
    GIONGBETA_INPUT_MODAL._input = document.getElementById('giongbeta-modal-input');
    
    document.getElementById('giongbeta-modal-cancel').addEventListener('click', () => {
      GIONGBETA_INPUT_MODAL.hide();
      if(GIONGBETA_INPUT_MODAL._callback) {
        GIONGBETA_INPUT_MODAL._callback(null);
        GIONGBETA_INPUT_MODAL._callback = null;
      }
    });

    document.getElementById('giongbeta-modal-confirm').addEventListener('click', () => {
      const value = GIONGBETA_INPUT_MODAL._input.value.trim();
      GIONGBETA_INPUT_MODAL.hide();
      if(GIONGBETA_INPUT_MODAL._callback) {
        GIONGBETA_INPUT_MODAL._callback(value);
        GIONGBETA_INPUT_MODAL._callback = null;
      }
    });

    GIONGBETA_INPUT_MODAL._modal.addEventListener('click', (e) => {
      if(e.target === GIONGBETA_INPUT_MODAL._modal) {
        GIONGBETA_INPUT_MODAL.hide();
        if(GIONGBETA_INPUT_MODAL._callback) {
          GIONGBETA_INPUT_MODAL._callback(null);
          GIONGBETA_INPUT_MODAL._callback = null;
        }
      }
    });

    const darkStyle = document.createElement('style');
    darkStyle.id = 'giongbeta-modal-dark-style';
    darkStyle.textContent = `
      @media (prefers-color-scheme: dark) {
        #giongbeta-input-modal > div {
          background: #1C1C1E !important;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.5) !important;
        }
        #giongbeta-modal-title {
          color: #FFFFFF !important;
        }
        #giongbeta-modal-input {
          background: #2C2C2E !important;
          border-color: #3A3A3C !important;
          color: #FFFFFF !important;
        }
        #giongbeta-modal-input::placeholder {
          color: #98989F !important;
        }
        #giongbeta-modal-cancel {
          background: #2C2C2E !important;
          border-color: #3A3A3C !important;
          color: #FFFFFF !important;
        }
        #giongbeta-modal-cancel:hover {
          background: #3A3A3C !important;
        }
      }
    `;
    document.head.appendChild(darkStyle);
  },

  show: (title, placeholder = '', defaultValue = '', callback) => {
    if(!GIONGBETA_INPUT_MODAL._modal) {
      GIONGBETA_INPUT_MODAL.init();
    }
    
    GIONGBETA_INPUT_MODAL._title.innerText = title;
    GIONGBETA_INPUT_MODAL._input.placeholder = placeholder;
    GIONGBETA_INPUT_MODAL._input.value = defaultValue;
    GIONGBETA_INPUT_MODAL._callback = callback;
    
    GIONGBETA_INPUT_MODAL._modal.style.opacity = '1';
    GIONGBETA_INPUT_MODAL._modal.style.visibility = 'visible';
    GIONGBETA_INPUT_MODAL._modal.querySelector('div').style.transform = 'scale(1)';
    
    setTimeout(() => {
      GIONGBETA_INPUT_MODAL._input.focus();
    }, 100);
  },

  hide: () => {
    if(!GIONGBETA_INPUT_MODAL._modal) return;
    
    GIONGBETA_INPUT_MODAL._modal.style.opacity = '0';
    GIONGBETA_INPUT_MODAL._modal.style.visibility = 'hidden';
    GIONGBETA_INPUT_MODAL._modal.querySelector('div').style.transform = 'scale(0.9)';
    GIONGBETA_INPUT_MODAL._input.value = '';
  }
};