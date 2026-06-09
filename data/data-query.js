const DataQuery = {
  /**
   * 缓存：号码到所有属性的映射
   * @private
   */
  _numToAttrMap: null,
  
  /**
   * 缓存：属性到号码的反向映射
   * @private
   */
  _attrToNumMap: null,

  /**
   * 初始化数据查询模块（预计算所有映射关系）
   */
  init: () => {
    if(DataQuery._numToAttrMap && DataQuery._attrToNumMap) {
      return;
    }
    
    DataQuery._numToAttrMap = {};
    DataQuery._attrToNumMap = {
      zodiac: {},
      color: {},
      element: {},
      type: {},
      head: {},
      tail: {},
      sum: {},
      sumOdd: {},
      sumSize: {},
      tailSize: {},
      bs: {},
      colorsx: {}
    };
    
    for(let num = 1; num <= 49; num++) {
      const attrs = DataQuery.getNumAttrs(num);
      DataQuery._numToAttrMap[num] = attrs;
      
      Object.keys(attrs).forEach(key => {
        if(DataQuery._attrToNumMap[key]) {
          if(!DataQuery._attrToNumMap[key][attrs[key]]) {
            DataQuery._attrToNumMap[key][attrs[key]] = [];
          }
          DataQuery._attrToNumMap[key][attrs[key]].push(num);
        }
      });
    }
  },

  /**
   * 获取单个号码的所有属性
   * @param {number} num - 号码 (1-49)
   * @returns {Object} 包含所有属性的对象
   */
  getNumAttrs: (num) => {
    num = Number(num);
    const s = Utils.formatNum(num);
    const head = Math.floor(num / 10);
    const tail = num % 10;
    const sum = head + tail;
    const sumOdd = sum % 2 === 1 ? '合单' : '合双';
    const sumSize = sum >= 7 ? '合大' : '合小';
    const tailSize = tail >= 5 ? '尾大' : '尾小';
    const big = num >= 25 ? '大' : '小';
    const odd = num % 2 === 1 ? '单' : '双';
    const bs = big + odd;
    
    const color = Utils.getColorName(num);
    const element = Utils.getWuxing(num);
    
    const type = CONFIG.JIAQIN.includes(DataQuery._getZodiacByNum(num)) ? '家禽' : '野兽';
    
    return {
      num,
      s,
      color,
      element,
      zodiac: DataQuery._getZodiacByNum(num),
      type,
      head,
      tail,
      sum,
      sumOdd,
      sumSize,
      tailSize,
      big,
      odd,
      bs,
      colorsx: color + odd
    };
  },

  /**
   * 根据号码获取生肖（私有辅助方法）
   * @private
   * @param {number} num - 号码
   * @returns {string} 生肖
   */
  _getZodiacByNum: (num) => {
    const state = StateManager._state;
    if(state.zodiacCycle && state.zodiacCycle.length === 12) {
      return state.zodiacCycle[(num - 1) % 12];
    }
    const fallbackCycle = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
    return fallbackCycle[(num - 1) % 12];
  },

  /**
   * 通过属性获取号码列表
   * @param {string} attrType - 属性类型 (zodiac/color/element/type/head/tail/sum/bs/colorsx)
   * @param {string|number} attrValue - 属性值
   * @returns {Array<number>} 号码列表
   */
  getNumsByAttr: (attrType, attrValue) => {
    DataQuery.init();
    if(!DataQuery._attrToNumMap[attrType]) {
      return [];
    }
    return DataQuery._attrToNumMap[attrType][attrValue] || [];
  },

  /**
   * 批量查询：通过多个属性获取交集号码
   * @param {Object} conditions - 查询条件对象 {zodiac: '鼠', color: '红', ...}
   * @returns {Array<number>} 符合所有条件的号码列表
   */
  getNumsByConditions: (conditions) => {
    DataQuery.init();
    let result = Array.from({length: 49}, (_, i) => i + 1);
    
    Object.keys(conditions).forEach(attrType => {
      const attrValue = conditions[attrType];
      const nums = DataQuery.getNumsByAttr(attrType, attrValue);
      result = result.filter(n => nums.includes(n));
    });
    
    return result;
  },

  /**
   * 检查号码是否符合某个属性
   * @param {number} num - 号码
   * @param {string} attrType - 属性类型
   * @param {string|number} attrValue - 属性值
   * @returns {boolean}
   */
  checkNumAttr: (num, attrType, attrValue) => {
    const attrs = DataQuery.getNumAttrs(num);
    return attrs[attrType] === attrValue;
  },

  /**
   * 获取两个号码的所有共同属性
   * @param {number} num1 - 号码1
   * @param {number} num2 - 号码2
   * @returns {Array<string>} 共同属性列表
   */
  getCommonAttrs: (num1, num2) => {
    const attrs1 = DataQuery.getNumAttrs(num1);
    const attrs2 = DataQuery.getNumAttrs(num2);
    const common = [];
    
    ['zodiac', 'color', 'element', 'type', 'big', 'odd', 'bs', 'colorsx'].forEach(key => {
      if(attrs1[key] === attrs2[key]) {
        common.push(key);
      }
    });
    
    return common;
  }
};
