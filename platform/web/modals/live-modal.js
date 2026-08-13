/**
 * 【平台层】直播弹窗组件
 * 职责：显示直播视频流弹窗，支持FLV格式播放
 * 依赖方向：平台层，被视图层/事件层调用
 */
const LiveModal = {
  _modal: null,
  _video: null,
  _flvPlayer: null,
  _closeBtn: null,
  _flvLoaded: false,
  _checkTimer: null,
  _countdownTimer: null,

  init: function() {
    if (this._modal) return;

    this._modal = document.createElement('div');
    this._modal.id = 'live-modal';
    this._modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10000;
      opacity: 0;
      visibility: hidden;
      transition: all 0.3s ease;
    `;

    this._modal.innerHTML = `
      <div style="
        position: relative;
        width: 90%;
        max-width: 800px;
        background: #000;
        border-radius: 12px;
        overflow: hidden;
        transform: scale(0.9);
        transition: transform 0.3s ease;
      ">
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: rgba(0,0,0,0.8);
          color: #fff;
        ">
          <span style="font-size: 16px; font-weight: 600;">直播</span>
          <button id="live-modal-close" style="
            background: none;
            border: none;
            color: #fff;
            font-size: 24px;
            cursor: pointer;
            padding: 0;
            width: 32px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            transition: background 0.2s;
          ">×</button>
        </div>
        <div id="live-modal-video-container" style="position: relative; width: 100%; padding-top: 56.25%; background: #000; overflow: hidden;">
          <video id="live-modal-video" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            object-fit: contain;
            background: #000;
          " controls autoplay muted playsinline webkit-playsinline></video>
          <div id="live-modal-offline" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: #000;
            color: #fff;
            font-size: 18px;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
          ">
            <div style="font-size: 15px; line-height: 1.8; color: rgba(255,255,255,0.8);">
              直播时间为每晚 <span style="color: #ff4757; font-weight: 700; font-size: 18px;">21:30 - 21:38</span>
            </div>
            <div id="live-modal-countdown" style="margin-top: 16px; font-size: 13px; color: rgba(255,255,255,0.6);"></div>
            <button id="live-modal-refresh" style="
              margin-top: 16px;
              padding: 8px 24px;
              background: var(--primary, #007AFF);
              color: #fff;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
            ">立即刷新</button>
          </div>
          <div id="live-modal-loading" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.7);
            color: #fff;
            font-size: 14px;
            text-align: center;
          ">
            <div style="margin-bottom: 8px;">加载中...</div>
          </div>
          <div id="live-modal-error" style="
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: none;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            background: rgba(0,0,0,0.8);
            color: #ff6b6b;
            font-size: 14px;
            text-align: center;
            padding: 20px;
            box-sizing: border-box;
          ">
            <div style="margin-bottom: 8px;">直播加载失败</div>
            <button id="live-modal-retry" style="
              padding: 8px 20px;
              background: var(--primary, #007AFF);
              color: #fff;
              border: none;
              border-radius: 6px;
              font-size: 14px;
              cursor: pointer;
            ">重试</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(this._modal);

    this._video = document.getElementById('live-modal-video');
    this._videoContainer = document.getElementById('live-modal-video-container');
    this._closeBtn = document.getElementById('live-modal-close');
    this._loadingEl = document.getElementById('live-modal-loading');
    this._errorEl = document.getElementById('live-modal-error');
    this._offlineEl = document.getElementById('live-modal-offline');
    this._countdownEl = document.getElementById('live-modal-countdown');
    this._retryBtn = document.getElementById('live-modal-retry');
    this._refreshBtn = document.getElementById('live-modal-refresh');

    this._closeBtn.addEventListener('click', () => this.hide());
    this._retryBtn.addEventListener('click', () => this._playLive());
    this._refreshBtn.addEventListener('click', () => this._playLive());

    this._modal.addEventListener('click', (e) => {
      if (e.target === this._modal) {
        this.hide();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this._modal.style.visibility === 'visible') {
        this.hide();
      }
    });
  },

  _loadFlvJs: function() {
    return new Promise((resolve, reject) => {
      if (typeof flvjs !== 'undefined') {
        this._flvLoaded = true;
        resolve();
        return;
      }

      if (this._flvLoading) {
        this._flvLoading.then(resolve).catch(reject);
        return;
      }

      this._flvLoading = new Promise((res, rej) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.bootcdn.net/ajax/libs/flv.js/1.6.2/flv.min.js';
        script.onload = () => {
          this._flvLoaded = true;
          res();
          resolve();
        };
        script.onerror = () => {
          rej(new Error('flv.js 加载失败'));
          reject(new Error('flv.js 加载失败'));
        };
        document.head.appendChild(script);
      });
    });
  },

  _showLoading: function() {
    if (this._loadingEl) this._loadingEl.style.display = 'flex';
    if (this._errorEl) this._errorEl.style.display = 'none';
    if (this._offlineEl) this._offlineEl.style.display = 'none';
  },

  _hideLoading: function() {
    if (this._loadingEl) this._loadingEl.style.display = 'none';
  },

  _showError: function() {
    this._hideLoading();
    this._hideOffline();
    if (this._errorEl) this._errorEl.style.display = 'flex';
  },

  _showOffline: function() {
    this._hideLoading();
    if (this._errorEl) this._errorEl.style.display = 'none';
    if (this._offlineEl) this._offlineEl.style.display = 'flex';
    this._startCheckTimer();
  },

  _hideOffline: function() {
    if (this._offlineEl) this._offlineEl.style.display = 'none';
    this._stopCheckTimer();
  },

  /**
   * 启动定时检查（每30秒检查一次是否到直播时间）
   */
  _startCheckTimer: function() {
    this._stopCheckTimer();
    this._updateCountdown();
    // 每30秒检查一次
    this._checkTimer = setInterval(() => {
      this._updateCountdown();
      if (this._isLiveTime()) {
        this._playLive();
      }
    }, 30000);
    // 每秒更新倒计时
    this._countdownTimer = setInterval(() => {
      this._updateCountdown();
    }, 1000);
  },

  /**
   * 停止定时检查
   */
  _stopCheckTimer: function() {
    if (this._checkTimer) {
      clearInterval(this._checkTimer);
      this._checkTimer = null;
    }
    if (this._countdownTimer) {
      clearInterval(this._countdownTimer);
      this._countdownTimer = null;
    }
  },

  /**
   * 更新倒计时显示
   */
  _updateCountdown: function() {
    if (!this._countdownEl) return;
    const now = new Date();
    const LIVE_START_HOUR = 21;
    const LIVE_START_MIN = 30;
    const LIVE_END_MIN = 38;

    let targetTime;
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const liveStartMinutes = LIVE_START_HOUR * 60 + LIVE_START_MIN;

    if (currentMinutes < liveStartMinutes) {
      // 今天还没到直播时间
      targetTime = new Date(now);
      targetTime.setHours(LIVE_START_HOUR, LIVE_START_MIN, 0, 0);
    } else if (currentMinutes > LIVE_START_HOUR * 60 + LIVE_END_MIN) {
      // 今天直播已结束，显示明天
      targetTime = new Date(now);
      targetTime.setDate(targetTime.getDate() + 1);
      targetTime.setHours(LIVE_START_HOUR, LIVE_START_MIN, 0, 0);
    } else {
      // 正在直播时间，应该已经进入播放了
      this._countdownEl.textContent = '直播中...';
      return;
    }

    const diff = targetTime - now;
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    let timeText = '';
    if (hours > 0) {
      timeText = `距离直播开始还有 ${hours}小时${minutes}分${seconds}秒`;
    } else {
      timeText = `距离直播开始还有 ${minutes}分${seconds}秒`;
    }
    this._countdownEl.textContent = timeText + '自动刷新';
  },

  /**
   * 检查当前是否在直播时间段内（21:30-21:38）
   * @returns {boolean}
   */
  _isLiveTime: function() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    // 21:30 = 21*60+30 = 1290
    // 21:38 = 21*60+38 = 1298
    const LIVE_START = 21 * 60 + 30;
    const LIVE_END = 21 * 60 + 38;

    return totalMinutes >= LIVE_START && totalMinutes <= LIVE_END;
  },

  _playLive: function() {
    // 先检查是否在直播时间段
    if (!this._isLiveTime()) {
      this._showOffline();
      return;
    }

    this._hideOffline();
    this._showLoading();
    this._destroyPlayer();

    this._loadFlvJs().then(() => {
      if (flvjs.isSupported()) {
        this._flvPlayer = flvjs.createPlayer({
          type: 'flv',
          url: 'https://live-macaujc.com/live/livestream/new.flv',
          isLive: true,
          hasAudio: true,
          hasVideo: true,
          cors: true
        }, {
          enableWorker: false,
          enableStashBuffer: false,
          stashInitialSize: 128,
          autoCleanupSourceBuffer: true
        });

        this._flvPlayer.attachMediaElement(this._video);
        this._flvPlayer.load();

        this._flvPlayer.on(flvjs.Events.ERROR, () => {
          this._showError();
        });

        this._flvPlayer.on(flvjs.Events.MEDIA_INFO, () => {
          this._hideLoading();
        });

        this._video.play().catch(() => {
          // 自动播放失败，用户需要手动点击播放
          this._hideLoading();
        });

        setTimeout(() => {
          this._hideLoading();
        }, 5000);
      } else {
        // 不支持flv.js，尝试直接播放
        this._video.src = 'https://live-macaujc.com/live/livestream/new.flv';
        this._video.play().catch(() => {
          this._showError();
        });
        this._hideLoading();
      }
    }).catch(() => {
      this._showError();
    });
  },

  _destroyPlayer: function() {
    if (this._flvPlayer) {
      try {
        this._flvPlayer.pause();
        this._flvPlayer.unload();
        this._flvPlayer.detachMediaElement();
        this._flvPlayer.destroy();
      } catch(e) {}
      this._flvPlayer = null;
    }
    if (this._video) {
      try {
        this._video.pause();
        this._video.removeAttribute('src');
        this._video.load();
      } catch(e) {}
    }
  },

  show: function() {
    if (!this._modal) {
      this.init();
    }

    this._modal.style.opacity = '1';
    this._modal.style.visibility = 'visible';
    this._modal.querySelector('div').style.transform = 'scale(1)';

    setTimeout(() => {
      this._playLive();
    }, 300);
  },

  hide: function() {
    if (!this._modal) return;

    this._stopCheckTimer();
    this._modal.style.opacity = '0';
    this._modal.style.visibility = 'hidden';
    this._modal.querySelector('div').style.transform = 'scale(0.9)';

    setTimeout(() => {
      this._destroyPlayer();
    }, 300);
  }
};

window.LiveModal = LiveModal;
