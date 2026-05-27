/**
 * 移动端滚动性能优化工具
 * 用于诊断和监控滑动卡顿问题
 */

const ScrollPerformanceMonitor = {
  /**
   * 检测设备性能等级
   * @returns {'high'|'medium'|'low'} 性能等级
   */
  detectPerformanceLevel: () => {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');

    if (!gl) return 'low';

    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (debugInfo) {
      const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL).toLowerCase();

      if (renderer.includes('apple gpu') || renderer.includes('apple m')) {
        return 'high';
      }
      if (renderer.includes('adreno') || renderer.includes('mali')) {
        const memory = navigator.deviceMemory || 4;
        return memory >= 6 ? 'high' : (memory >= 4 ? 'medium' : 'low');
      }
    }

    const cores = navigator.hardwareConcurrency || 2;
    const memory = navigator.deviceMemory || 2;

    if (cores >= 8 && memory >= 8) return 'high';
    if (cores >= 4 && memory >= 4) return 'medium';
    return 'low';
  },

  /**
   * 根据设备性能应用优化策略
   */
  applyOptimizations: () => {
    const level = ScrollPerformanceMonitor.detectPerformanceLevel();
    document.documentElement.dataset.performanceLevel = level;

    console.log(`[ScrollPerf] 设备性能等级: ${level}`);

    if (level === 'low') {
      document.body.classList.add('low-performance-mode');

      console.warn('[ScrollPerf] 已启用低端设备优化模式');
      console.table({
        'backdrop-filter': '已降低模糊强度',
        'will-change': '已移除',
        '动画': '已简化',
        '阴影': '已减少'
      });
    }
  },

  /**
   * 监控滚动帧率（开发调试用）
   */
  startFPSMonitoring: () => {
    if (typeof window === 'undefined' || !window.requestAnimationFrame) return;

    let frameCount = 0;
    let lastTime = performance.now();
    let fps = 0;

    const measure = () => {
      frameCount++;
      const now = performance.now();

      if (now - lastTime >= 1000) {
        fps = Math.round((frameCount * 1000) / (now - lastTime));

        if (fps < 30) {
          console.warn(`[ScrollPerf] ⚠️ 低帧率警告: ${fps} FPS (建议>55FPS)`);
        } else if (fps < 45) {
          console.log(`[ScrollPerf] 帧率偏低: ${fps} FPS`);
        }

        frameCount = 0;
        lastTime = now;
      }

      requestAnimationFrame(measure);
    };

    requestAnimationFrame(measure);
  },

  /**
   * 检测是否支持passive事件监听器
   */
  checkPassiveSupport: () => {
    let passiveSupported = false;
    try {
      const options = Object.defineProperty({}, 'passive', {
        get: () => { passiveSupported = true; return true; }
      });
      window.addEventListener('test', null, options);
      window.removeEventListener('test', null, options);
    } catch(e) {
      passiveSupported = false;
    }

    console.log(`[ScrollPerf] Passive事件支持: ${passiveSupported ? '✅' : '❌'}`);
    return passiveSupported;
  }
};

// 自动执行检测（仅在浏览器环境中）
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      ScrollPerformanceMonitor.applyOptimizations();
      ScrollPerformanceMonitor.checkPassiveSupport();

      // 开发环境自动启动FPS监控
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        ScrollPerformanceMonitor.startFPSMonitoring();
      }
    });
  } else {
    ScrollPerformanceMonitor.applyOptimizations();
    ScrollPerformanceMonitor.checkPassiveSupport();
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ScrollPerformanceMonitor;
}
