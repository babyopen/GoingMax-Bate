/**
 * 【核心层】配置模块（ES Module 版本）
 * 
 * 这是 config.js 的 ES Module 版本，用于未来迁移参考
 * 当前仍使用全局对象方式，此文件作为迁移模板
 * 
 * @module core/config-module
 */

const CONFIG = {
  // API 配置
  API: {
    HISTORY: 'https://api.example.com/history/',
    PREDICTION: 'https://api.example.com/predict/'
  },
  
  // 分析配置
  ANALYSIS: {
    ZODIAC_ALL: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],
    ZODIAC_TRAD_TO_SIMP: {
      '龍': '龙',
      '馬': '马',
      '雞': '鸡',
      '豬': '猪'
    }
  },
  
  // 最大保存数量
  MAX_SAVE_COUNT: 50,
  
  // 缓存配置
  CACHE: {
    HISTORY_TTL: 24 * 60 * 60 * 1000, // 24小时
    PREDICTION_TTL: 60 * 60 * 1000     // 1小时
  },
  
  // 性能配置
  PERFORMANCE: {
    DEBOUNCE_DELAY: 300,
    THROTTLE_DELAY: 100,
    REQUEST_TIMEOUT: 10000
  }
};

// ES Module 导出
export default CONFIG;
export { CONFIG };
