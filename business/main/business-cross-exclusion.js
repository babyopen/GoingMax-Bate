/**
 * 交叉排除模块 · 业务层
 * 职责：收集多个推荐模块的推荐结果，合并去重后返回排除列表
 *
 * 推荐源：
 *   1. 生肖预测（calcContinuousScores → cards 前6名）
 *   2. Giong 标签页（getZoneRecommend → 前6名）
 *   3. 终极算法（generateFullReport → mainNumbers/transitionNumbers + alternativeNumbers）
 *
 * 依赖方向: views/ -> business/ -> core/
 * 禁止 DOM 操作
 */
const BusinessCrossExclusion = {

  /** 12生肖完整列表 */
  ALL_ZODIAC: ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'],

  /**
   * Rule 2 触发时的默认降权系数（0 = 无降权；0.5 = 打 5 折；1 = 完全扣光）
   * 适用对象：3 源全覆盖时，仅被"生肖预测"推荐、但未被"Giong+终极算法"二源推荐的生肖
   * 可按需调整，无需改主逻辑
   */
  DOWNWEIGHT_FACTOR: 0.5,

  /**
   * Rule 2 触发时使用的两个核心推荐源（用于计算二源并集）
   * 固定为 ["终极算法", "Giong"]，按用户规则要求
   */
  RULE2_SOURCES: ['giong', 'ultimate'],

  /**
   * 收集所有推荐模块的推荐生肖，合并去重
   *
   * @param {Array} historyData - 历史数据
   * @param {Array<string>} [sources] - 指定收集哪些推荐源，默认全部 ['predict', 'giong', 'ultimate']
   * @returns {Object} {
   *   recommended: Array<string>,         // 3源推荐并集（去重）
   *   excluded: Array<string>,           // 未被任何源推荐（Rule 1 硬排除）
   *   sources: {predict: [], giong: [], ultimate: []}, // 各源原始生肖（去重后）
   *   recommendCount: number,
   *   excludeCount: number,
   *   twoSourceUnion: Array<string>,     // Giong + 终极算法 二源并集
   *   downweighted: Array<string>,       // Rule 2 触发时的降权生肖
   *   downweightFactor: number,          // 降权系数（0=未触发；0.5=打5折）
   *   rule2Triggered: boolean,           // Rule 2 是否触发
   *   insufficientData?: boolean         // 历史数据为空时为 true
   * }
   */
  collectAllRecommend: function(historyData, sources) {
    // [Bug#6 修复] sources 参数类型校验：非数组则降级为默认全源
    if (!Array.isArray(sources)) {
      sources = ['predict', 'giong', 'ultimate'];
    }

    const recommendedSet = {};
    const giongUltimateSet = {}; // Giong + 终极算法 二源并集（用于 Rule 2 降权判断）
    const sourceDetails = { predict: [], giong: [], ultimate: [] };

    // 入口级校验：历史数据为空或格式异常时，返回空推荐（全部生肖排除）
    if (!historyData || !Array.isArray(historyData) || historyData.length === 0) {
      return {
        recommended: [],
        excluded: this.ALL_ZODIAC.slice(),
        sources: sourceDetails,
        recommendCount: 0,
        excludeCount: this.ALL_ZODIAC.length,
        twoSourceUnion: [],
        downweighted: [],
        downweightFactor: 0,
        rule2Triggered: false,
        insufficientData: true
      };
    }

    // [Bug#1 修复] 提取统一生肖校验函数：三源共用，确保数据清洁
    const isValidZodiac = function(z) {
      return z && typeof z === 'string' && z.length === 1 && this.ALL_ZODIAC.indexOf(z) !== -1;
    }.bind(this);

    // [Bug#4 修复] 提取统一添加函数：Set + 去重 push（同时维护 Set 与 Array）
    const addZodiac = function(zodiacSet, detailsArr, zx) {
      if (!isValidZodiac(zx)) return;
      zodiacSet[zx] = true;
      if (detailsArr.indexOf(zx) === -1) { // 数组去重
        detailsArr.push(zx);
      }
    };

    // 1. 生肖预测（v1推荐，前6名）
    if (sources.indexOf('predict') !== -1) {
      try {
        const predictResult = ZodiacPrediction.calcContinuousScores(historyData);
        if (predictResult && predictResult.cards) {
          for (let i = 0; i < Math.min(6, predictResult.cards.length); i++) {
            // [Bug#1 修复] predict 源现在也做生肖合法性校验
            addZodiac(recommendedSet, sourceDetails.predict, predictResult.cards[i].zodiac);
          }
        }
      } catch (e) {
        // [Bug#3 修复] 静默 catch → 开发模式 console.warn，便于排查
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BusinessCrossExclusion] predict源失败：', e);
        }
      }
    }

    // 2. Giong 标签页推荐（getZoneRecommend，取前6名）
    if (sources.indexOf('giong') !== -1) {
      try {
        const freqResult = ZodiacPrediction.calcFrequencyRating(historyData);
        const patternResult = ZodiacPrediction.analyzeZonePatterns(historyData);
        if (freqResult && patternResult) {
          const giongRecommend = ZodiacPrediction.getZoneRecommend(historyData, freqResult, patternResult);
          if (giongRecommend && giongRecommend.length) {
            for (let j = 0; j < Math.min(6, giongRecommend.length); j++) {
              const item = giongRecommend[j];
              const zx = Array.isArray(item) ? item[0] : (item.zodiac || '');
              if (isValidZodiac(zx)) {
                recommendedSet[zx] = true;
                giongUltimateSet[zx] = true; // 同步入二源并集
                if (sourceDetails.giong.indexOf(zx) === -1) sourceDetails.giong.push(zx); // 去重
              }
            }
          }
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BusinessCrossExclusion] giong源失败：', e);
        }
      }
    }

    // 3. 终极算法推荐（主推 + 备用，全部纳入交叉排除并集）
    if (sources.indexOf('ultimate') !== -1) {
      try {
        const ultimateHistory = BusinessUltimate.historyDataToUltimateFormat(historyData);
        if (ultimateHistory && ultimateHistory.length) {
          const ultimateReport = BusinessUltimate.generateFullReport(ultimateHistory);
          if (ultimateReport && ultimateReport.numbers) {
            // V1.4.1：主推 + 备用 一并纳入（之前遗漏了 alternativeNumbers）
            const ultimateMain = ultimateReport.numbers.mainNumbers || ultimateReport.numbers.transitionNumbers || [];
            const ultimateAlt = ultimateReport.numbers.alternativeNumbers || [];
            const ultimateNums = ultimateMain.concat(ultimateAlt);
            for (let k = 0; k < ultimateNums.length; k++) {
              const zx = BusinessUltimate._getZodiacByNum(ultimateNums[k]);
              if (isValidZodiac(zx)) {
                recommendedSet[zx] = true;
                giongUltimateSet[zx] = true; // 同步入二源并集
                if (sourceDetails.ultimate.indexOf(zx) === -1) sourceDetails.ultimate.push(zx); // 去重
              }
            }
          }
        }
      } catch (e) {
        if (typeof console !== 'undefined' && console.warn) {
          console.warn('[BusinessCrossExclusion] ultimate源失败：', e);
        }
      }
    }

    // 生成排除列表
    const excluded = [];
    const recommended = [];
    for (let m = 0; m < this.ALL_ZODIAC.length; m++) {
      const z = this.ALL_ZODIAC[m];
      if (recommendedSet[z]) {
        recommended.push(z);
      } else {
        excluded.push(z);
      }
    }

    // === Rule 2 触发逻辑 ===
    // 触发条件：3 源并集已覆盖全部 12 生肖（即 Rule 1 排除列表为空）
    // 降权对象：被 3 源推荐、但未被"Giong + 终极算法"二源推荐的生肖
    const twoSourceUnion = [];
    for (let t = 0; t < this.ALL_ZODIAC.length; t++) {
      const tz = this.ALL_ZODIAC[t];
      if (giongUltimateSet[tz]) twoSourceUnion.push(tz);
    }

    // [Bug#8 修复] 提取 rule2Triggered 为单一判定源，避免逻辑散落
    const rule2Triggered = excluded.length === 0;

    const downweighted = [];
    let downweightFactor = 0;
    if (rule2Triggered) {
      // 3 源全覆盖 → 启动 Rule 2 软降权
      for (let n = 0; n < this.ALL_ZODIAC.length; n++) {
        const zn = this.ALL_ZODIAC[n];
        if (!giongUltimateSet[zn]) {
          downweighted.push(zn);
        }
      }
      downweightFactor = this.DOWNWEIGHT_FACTOR;
    }

    return {
      recommended: recommended,
      excluded: excluded,
      sources: sourceDetails,
      recommendCount: recommended.length,
      excludeCount: excluded.length,
      // 二源并集 + 降权信息（向后兼容，旧接口不受影响）
      twoSourceUnion: twoSourceUnion,
      downweighted: downweighted,
      downweightFactor: downweightFactor,
      rule2Triggered: rule2Triggered // [Bug#8 修复] 统一来源
    };
  },

  /**
   * 快捷方法：直接获取排除列表（兼容旧接口）
   *
   * @param {Array} historyData - 历史数据
   * @returns {Array<string>} 未被任何模块推荐的生肖数组
   */
  getExcludedZodiacs: function(historyData) {
    return this.collectAllRecommend(historyData).excluded;
  },

  /**
   * [新增] 快捷方法：获取 Rule 2 触发时的降权生肖列表
   * 仅在 Rule 1 排除列表为空（3 源全覆盖）时才有返回值
   *
   * @param {Array} historyData - 历史数据
   * @returns {Array<string>} 需要降权扣分的生肖数组（被 3 源推荐但未被 Giong+终极算法 推荐的生肖）
   */
  getDownweightedZodiacs: function(historyData) {
    return this.collectAllRecommend(historyData).downweighted;
  },

  /**
   * [新增] 快捷方法：获取当前 Rule 2 降权系数
   * 0 表示未触发降权；>0 表示将上述生肖的最终评分乘以该系数
   *
   * @param {Array} historyData - 历史数据
   * @returns {number} 降权系数（默认 0.5）
   */
  getDownweightFactor: function(historyData) {
    return this.collectAllRecommend(historyData).downweightFactor;
  },

  /**
   * [新增] 判断 Rule 2 是否触发
   * @param {Array} historyData - 历史数据
   * @returns {boolean} true = Rule 2 触发；false = Rule 1 已生效硬排除
   */
  isRule2Triggered: function(historyData) {
    return this.collectAllRecommend(historyData).rule2Triggered === true;
  },

  /**
   * 判断某个生肖是否被排除
   *
   * @param {string} shengxiao - 目标生肖
   * @param {Array<string>} excludedZodiacs - 排除列表
   * @returns {boolean}
   */
  isExcluded: function(shengxiao, excludedZodiacs) {
    return excludedZodiacs && excludedZodiacs.indexOf(shengxiao) !== -1;
  }
};
