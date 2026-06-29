/**
 * 【业务层】视图辅助工具
 * 从视图层抽取的业务计算逻辑（v2.0.9）
 * 
 * 职责：
 * - 为视图层提供纯数据加工函数
 * - 避免视图层直接进行业务计算
 * - 符合分层架构规范
 */
const BusinessViewHelper = {
  /**
   * 按计数降序排序区域统计
   * @param {Object} sourceZoneCount - { '一区': 5, '二区': 3, ... }
   * @returns {Array} [{ zone: string, count: number }, ...]
   */
  sortZonesByCountDesc: (sourceZoneCount) => {
    if (!sourceZoneCount || typeof sourceZoneCount !== 'object') {
      return [];
    }
    
    const statZones = Object.keys(sourceZoneCount).map(function(zone) {
      return { 
        zone: zone, 
        count: sourceZoneCount[zone] 
      };
    });
    
    // 使用业务层排序工具
    return BusinessCommonSort.sortByNumberDesc(statZones, 'count');
  },
  
  /**
   * 计算百分比
   * @param {number} value - 当前值
   * @param {number} total - 总值
   * @returns {number} 百分比（0-100）
   */
  calcPercentage: (value, total) => {
    if (!total || total === 0) return 0;
    return Math.round(value / total * 100);
  },
  
  /**
   * 格式化区域统计数据（用于渲染）
   * @param {Object} changeData - 区域变动数据
   * @returns {Array} 格式化后的统计数据
   */
  formatZoneStats: (changeData) => {
    if (!changeData || !changeData.sourceZoneCount) {
      return [];
    }
    
    const sorted = BusinessViewHelper.sortZonesByCountDesc(changeData.sourceZoneCount);
    const total = sorted.reduce(function(sum, item) { 
      return sum + item.count; 
    }, 0);
    
    return sorted.map(function(item) {
      return {
        zone: item.zone,
        count: item.count,
        percentage: BusinessViewHelper.calcPercentage(item.count, total)
      };
    }).filter(function(item) {
      return item.count > 0; // 过滤掉计数为0的
    });
  },
  
  /**
   * 提取Top N生肖名称
   * @param {Array} candidates - 候选生肖列表 [{ zodiac: '鼠', ... }, ...]
   * @param {number} n - Top N数量，默认6
   * @returns {Array} 生肖名称数组
   */
  extractTopNZodiacs: (candidates, n) => {
    if (!Array.isArray(candidates)) return [];
    const limit = n || 6;
    return candidates.slice(0, limit).map(function(c) {
      return c.zodiac || c.shengxiao || '';
    }).filter(Boolean);
  },
  
  /**
   * 格式化推荐号码列表
   * @param {Array} recommendedNums - 推荐号码数组
   * @returns {string} HTML字符串
   */
  formatRecommendedNums: (recommendedNums) => {
    if (!Array.isArray(recommendedNums) || recommendedNums.length === 0) {
      return '';
    }
    
    return recommendedNums.map(function(n) {
      return '<span class="rec-num">' + n + '</span>';
    }).join(' ');
  },
  
  /**
   * 生成重叠号码的HTML
   * @param {Array} nums - 号码数组 [{ s: '05', ... }, ...]
   * @returns {string} 空格分隔的号码字符串
   */
  formatOverlapNums: (nums) => {
    if (!Array.isArray(nums)) return '';
    return nums.map(function(item) {
      return item.s || item.num || '';
    }).filter(Boolean).join(' ');
  },
  
  /**
   * 批量选择解析 - 号码
   * @param {string} raw - 原始输入字符串
   * @returns {Array} 合法的号码数组
   */
  parseBatchNumbers: (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    
    // 使用通用工具分割
    const nums = raw.split(Utils.SPLIT_TOKEN_REGEX)
      .map(Number)
      .filter(Utils.isValidLotteryNum);
    
    return nums;
  },
  
  /**
   * 批量选择解析 - 生肖名称
   * @param {string} raw - 原始输入字符串
   * @returns {Array} 合法的生肖名称数组
   */
  parseBatchZodiacs: (raw) => {
    if (!raw || typeof raw !== 'string') return [];
    
    // 分割并过滤空值
    let names = raw.split(Utils.SPLIT_TOKEN_REGEX).filter(Boolean);
    
    // 尝试数字转生肖（如 "1" -> "鼠"）
    names = names.map(function(n) {
      const num = Number(n);
      if (!isNaN(num) && num >= 1 && num <= 12) {
        return CONFIG.ANALYSIS.ZODIAC_ALL[num - 1];
      }
      return n;
    });
    
    // 验证生肖名称
    const validZodiacs = new Set(CONFIG.ANALYSIS.ZODIAC_ALL);
    return names.filter(function(name) {
      // 支持简体/繁体
      const simpName = CONFIG.ANALYSIS.ZODIAC_TRAD_TO_SIMP[name] || name;
      return validZodiacs.has(simpName);
    });
  }
};
