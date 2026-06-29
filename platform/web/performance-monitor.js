/**
 * 【平台层】性能监控工具
 * 
 * 职责：
 * - Web Vitals 指标收集
 * - 关键路径性能埋点
 * - 错误追踪和上报
 * - 性能数据持久化
 */
const PerformanceMonitor = (function() {
  'use strict';
  
  // 私有状态
  const metrics = new Map();
  const errors = [];
  const MAX_ERRORS = 100;
  
  /**
   * 记录性能指标
   * @param {string} name - 指标名称
   * @param {number} value - 指标值（毫秒）
   * @param {Object} metadata - 元数据
   */
  function mark(name, value, metadata = {}) {
    if (!name || typeof value !== 'number') {
      console.warn('[PerformanceMonitor] 无效的性能指标');
      return;
    }
    
    const record = {
      name,
      value,
      timestamp: Date.now(),
      metadata
    };
    
    metrics.set(name, record);
    
    // 控制台输出（开发环境）
    if (CONFIG.DEBUG) {
      console.log(`[Perf] ${name}: ${value.toFixed(2)}ms`, metadata);
    }
  }
  
  /**
   * 开始计时
   * @param {string} name - 计时器名称
   * @returns {Function} 结束计时的函数
   */
  function startTimer(name) {
    const startTime = performance.now ? performance.now() : Date.now();
    
    return function endTimer(metadata = {}) {
      const endTime = performance.now ? performance.now() : Date.now();
      const duration = endTime - startTime;
      mark(name, duration, metadata);
      return duration;
    };
  }
  
  /**
   * 获取所有性能指标
   * @returns {Array} 性能指标数组
   */
  function getMetrics() {
    return Array.from(metrics.values());
  }
  
  /**
   * 获取特定指标
   * @param {string} name - 指标名称
   * @returns {Object|null} 指标记录
   */
  function getMetric(name) {
    return metrics.get(name) || null;
  }
  
  /**
   * 清除所有指标
   */
  function clearMetrics() {
    metrics.clear();
  }
  
  /**
   * 记录错误
   * @param {Error|string} error - 错误对象或消息
   * @param {string} context - 错误上下文
   */
  function captureError(error, context = '') {
    const errorRecord = {
      message: error.message || String(error),
      stack: error.stack || '',
      context,
      timestamp: Date.now(),
      url: window.location.href
    };
    
    errors.push(errorRecord);
    
    // 限制错误数量
    if (errors.length > MAX_ERRORS) {
      errors.shift();
    }
    
    // 控制台输出
    console.error('[Error]', errorRecord.message, context);
    
    // 这里可以集成 Sentry 等错误追踪服务
    // if (typeof Sentry !== 'undefined') {
    //   Sentry.captureException(error, { extra: { context } });
    // }
  }
  
  /**
   * 获取错误列表
   * @returns {Array} 错误记录数组
   */
  function getErrors() {
    return [...errors];
  }
  
  /**
   * 清除错误记录
   */
  function clearErrors() {
    errors.length = 0;
  }
  
  /**
   * 收集 Web Vitals 指标
   */
  function collectWebVitals() {
    // FCP (First Contentful Paint)
    if ('PerformanceObserver' in window) {
      try {
        const observer = new PerformanceObserver(function(list) {
          list.getEntries().forEach(function(entry) {
            mark('web-vitals.' + entry.name, entry.startTime);
          });
        });
        
        // 观察paint事件
        observer.observe({ entryTypes: ['paint'] });
        
        // 观察导航事件
        observer.observe({ entryTypes: ['navigation'] });
        
        // 观察资源加载
        observer.observe({ entryTypes: ['resource'] });
      } catch (e) {
        console.warn('[PerformanceMonitor] Web Vitals 收集失败:', e);
      }
    }
  }
  
  /**
   * 导出性能报告
   * @returns {Object} 性能报告
   */
  function exportReport() {
    return {
      timestamp: Date.now(),
      url: window.location.href,
      userAgent: navigator.userAgent,
      metrics: getMetrics(),
      errors: getErrors(),
      summary: {
        totalMetrics: metrics.size,
        totalErrors: errors.length,
        avgLoadTime: _calculateAvgLoadTime()
      }
    };
  }
  
  /**
   * 计算平均加载时间（内部辅助函数）
   * @private
   */
  function _calculateAvgLoadTime() {
    const loadMetrics = Array.from(metrics.values())
      .filter(m => m.name.includes('load') || m.name.includes('render'));
    
    if (loadMetrics.length === 0) return 0;
    
    const sum = loadMetrics.reduce((acc, m) => acc + m.value, 0);
    return Math.round(sum / loadMetrics.length);
  }
  
  /**
   * 初始化性能监控
   */
  function init() {
    // 收集 Web Vitals
    collectWebVitals();
    
    // 监听全局错误
    window.addEventListener('error', function(event) {
      captureError(event.error || event.message, event.filename + ':' + event.lineno);
    });
    
    // 监听未处理的Promise拒绝
    window.addEventListener('unhandledrejection', function(event) {
      captureError(event.reason, 'Unhandled Promise Rejection');
    });
    
    console.log('[PerformanceMonitor] 性能监控已初始化');
  }
  
  // 公开API
  return Object.freeze({
    init: init,
    mark: mark,
    startTimer: startTimer,
    getMetrics: getMetrics,
    getMetric: getMetric,
    clearMetrics: clearMetrics,
    captureError: captureError,
    getErrors: getErrors,
    clearErrors: clearErrors,
    collectWebVitals: collectWebVitals,
    exportReport: exportReport
  });
})();
