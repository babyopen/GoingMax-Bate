const Toast = {
  /** @private */
  _dom: document.getElementById('toast'),
  /** @private */
  _timer: null,

  /**
   * 显示提示
   * @param {string} text - 提示文本
   * @param {number} duration - 显示时长(ms)
   */
  show: (text, duration = CONFIG.TOAST_DURATION) => {
    clearTimeout(Toast._timer);
    Toast._dom.innerText = text;
    Toast._dom.classList.add('show');
    Toast._timer = setTimeout(() => {
      Toast._dom.classList.remove('show');
    }, duration);
  },

  /**
   * 清除定时器
   */
  clearTimer: () => {
    clearTimeout(Toast._timer);
  }
};
