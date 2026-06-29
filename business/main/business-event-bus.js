/**
 * 【业务层】轻量级事件总线（观察者模式）
 * 用于解耦 StateManager 和 Render，避免核心层直接调用平台层
 * 
 * 使用示例：
 *   // 在 app.js 中注册监听器
 *   BusinessEventBus.on('state:change', () => Render.renderAll());
 *   
 *   // 在 state.js 中发布事件（替代直接调用 Render.renderAll()）
 *   BusinessEventBus.emit('state:change');
 */
const BusinessEventBus = (function() {
  'use strict';
  
  /**
   * 事件监听器存储 Map
   * key: 事件名称 (string)
   * value: 回调函数集合 (Set<Function>)
   * @private
   */
  const listeners = new Map();
  
  /**
   * 订阅事件
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * @returns {Function} 取消订阅函数
   * 
   * @example
   * const off = BusinessEventBus.on('data:update', handler);
   * off(); // 取消订阅
   */
  function on(event, callback) {
    if (typeof event !== 'string' || !event.trim()) {
      console.warn('[BusinessEventBus] 事件名称不能为空');
      return function noop() {};
    }
    
    if (typeof callback !== 'function') {
      console.warn('[BusinessEventBus] 回调必须是函数');
      return function noop() {};
    }
    
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event).add(callback);
    
    // 返回取消订阅函数
    return function off() {
      const set = listeners.get(event);
      if (set) {
        set.delete(callback);
        if (set.size === 0) {
          listeners.delete(event);
        }
      }
    };
  }
  
  /**
   * 发布事件
   * @param {string} event - 事件名称
   * @param {...*} args - 传递给回调的参数
   * 
   * @example
   * BusinessEventBus.emit('data:update', newData, timestamp);
   */
  function emit(event, ...args) {
    if (typeof event !== 'string' || !event.trim()) {
      console.warn('[BusinessEventBus] 事件名称不能为空');
      return;
    }
    
    const set = listeners.get(event);
    if (!set || set.size === 0) {
      return; // 没有监听器，静默返回
    }
    
    // 复制 Set 避免在遍历时修改导致的问题
    const callbacks = Array.from(set);
    callbacks.forEach(function(callback) {
      try {
        callback.apply(null, args);
      } catch (e) {
        console.error('[BusinessEventBus] 事件 "' + event + '" 回调执行失败:', e);
      }
    });
  }
  
  /**
   * 一次性订阅（触发后自动取消）
   * @param {string} event - 事件名称
   * @param {Function} callback - 回调函数
   * 
   * @example
   * BusinessEventBus.once('init:complete', handler);
   */
  function once(event, callback) {
    if (typeof callback !== 'function') {
      console.warn('[BusinessEventBus] 回调必须是函数');
      return;
    }
    
    var off = on(event, function(...args) {
      off(); // 自动取消订阅
      callback.apply(null, args);
    });
  }
  
  /**
   * 移除监听器
   * @param {string} [event] - 可选，指定事件名称；不传则清空所有监听器
   * 
   * @example
   * BusinessEventBus.clear('data:update'); // 清除特定事件
   * BusinessEventBus.clear(); // 清除所有事件
   */
  function clear(event) {
    if (event) {
      listeners.delete(event);
    } else {
      listeners.clear();
    }
  }
  
  /**
   * 获取某个事件的监听器数量（调试用）
   * @param {string} event - 事件名称
   * @returns {number} 监听器数量
   */
  function listenerCount(event) {
    const set = listeners.get(event);
    return set ? set.size : 0;
  }
  
  // 导出公共 API（冻结防止外部修改）
  return Object.freeze({
    on: on,
    once: once,
    emit: emit,
    clear: clear,
    listenerCount: listenerCount
  });
})();
