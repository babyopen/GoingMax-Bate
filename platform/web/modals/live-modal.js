/**
 * 【平台层】直播弹窗组件
 * 职责：显示直播视频流弹窗，支持HLS(m3u8)格式播放
 * 依赖方向：平台层，被视图层/事件层调用
 */
const LiveModal = {
  _modal: null,
  _video: null,
  _hlsPlayer: null,
  _closeBtn: null,
  _hlsLoaded: false,
  _checkTimer: null,
  _countdownTimer: null,

  LIVE_URL: 'https://live-macaujc.com/live/livestream/new.m3u8',

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

  _loadHlsJs: function() {
    return new Promise((resolve, reject) => {
      if (typeof Hls !== 'undefined') {
        this._hlsLoaded = true;
        resolve();
        return;
      }

      if (this._hlsLoading) {
        this._hlsLoading.then(resolve).catch(reject);
        return;
      }

      this._hlsLoading = new Promise((res, rej) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.bootcdn.net/ajax/libs/hls.js/1.5.13/hls.min.js';
        script.onload = () => {
          this._hlsLoaded = true;
          res();
          resolve();
        };
        script.onerror = () => {
          rej(new Error('hls.js 加载失败'));
          reject(new Error('hls.js 加载失败'));
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

  _startCheckTimer: function() {
    this._stopCheckTimer();
    this._updateCountdown();
    this._checkTimer = setInterval(() => {
      this._updateCountdown();
      if (this._isLiveTime()) {
        this._playLive();
      }
    }, 30000);
    this._countdownTimer = setInterval(() => {
      this._updateCountdown();
    }, 1000);
  },

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
      targetTime = new Date(now);
      targetTime.setHours(LIVE_START_HOUR, LIVE_START_MIN, 0, 0);
    } else if (currentMinutes > LIVE_START_HOUR * 60 + LIVE_END_MIN) {
      targetTime = new Date(now);
      targetTime.setDate(targetTime.getDate() + 1);
      targetTime.setHours(LIVE_START_HOUR, LIVE_START_MIN, 0, 0);
    } else {
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

  _isLiveTime: function() {
    const now = new Date();
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const totalMinutes = hours * 60 + minutes;

    const LIVE_START = 21 * 60 + 30;
    const LIVE_END = 21 * 60 + 38;

    return totalMinutes >= LIVE_START && totalMinutes <= LIVE_END;
  },

  _playLive: function() {
    if (!this._isLiveTime()) {
      this._showOffline();
      return;
    }

    this._hideOffline();
    this._showLoading();
    this._destroyPlayer();

    this._loadHlsJs().then(() => {
      if (Hls.isSupported()) {
        this._hlsPlayer = new Hls({
          enableWorker: false,
          lowLatencyMode: true,
          liveSyncDurationCount: 3
        });

        this._hlsPlayer.loadSource(this.LIVE_URL);
        this._hlsPlayer.attachMedia(this._video);

        this._hlsPlayer.on(Hls.Events.ERROR, (event, data) => {
          if (data.fatal) {
            this._showError();
          }
        });

        this._hlsPlayer.on(Hls.Events.MANIFEST_PARSED, () => {
          this._hideLoading();
          this._video.play().catch(() => {});
        });

        setTimeout(() => {
          this._hideLoading();
        }, 8000);
      } else if (this._video.canPlayType('application/vnd.apple.mpegurl')) {
        this._video.src = this.LIVE_URL;
        this._video.addEventListener('loadedmetadata', () => {
          this._hideLoading();
          this._video.play().catch(() => {});
        });
        this._video.addEventListener('error', () => {
          this._showError();
        });
        this._hideLoading();
      } else {
        this._showError();
      }
    }).catch(() => {
      this._showError();
    });
  },

  _destroyPlayer: function() {
    if (this._hlsPlayer) {
      try {
        this._hlsPlayer.stopLoad();
        this._hlsPlayer.destroy();
      } catch(e) {}
      this._hlsPlayer = null;
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
