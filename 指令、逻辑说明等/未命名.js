/**
 * 算法终极版 V1.3.0 最终整合版
 * 内嵌定制12期滑动降权+临界解权完整逻辑
 * 规则：满3次降权；仅预判3→2才解除降权，其余不解
 * @author AI Engineer
 * @version 1.3.0 整合降权规则定稿
 */

// ====================== 核心配置区（永久固定）======================
export const CYCLE_CONFIG = Object.freeze({
  V1: Object.freeze({
    name: 'V1冷号周期',
    mainPool: Object.freeze([2, 3, 6, 8, 11, 12]),
    coldPool: Object.freeze([1, 4, 5, 7, 9, 10]),
    transitionPool: Object.freeze([1, 4]),
    cycleChain: Object.freeze([2, 6, 12, 8, 3, 11])
  }),
  V2: Object.freeze({
    name: 'V2热号周期',
    mainPool: Object.freeze([1, 4, 5, 7, 9, 10]),
    coldPool: Object.freeze([2, 3, 6, 8, 11, 12]),
    transitionPool: Object.freeze([3, 6]),
    cycleChain: Object.freeze([1, 5, 7, 9, 4, 10])
  })
});

export const CYCLE_STAGES = Object.freeze({
  V1_STABLE: 'V1稳定运行期',
  V2_STABLE: 'V2稳定运行期',
  TRANSITION: '过渡混沌期',
  INSUFFICIENT_DATA: '数据不足无法判断'
});

export const RISK_LEVELS = Object.freeze({
  LOW: '✅ 低风险',
  MEDIUM: '⚠️ 中风险',
  HIGH: '🚨 极高风险',
  UNKNOWN: '❓ 未知风险'
});

// 降权规则固定配置
export const WEIGHT_CONFIG = Object.freeze({
  windowSize: 12,
  downWeightLimit: 3
});

// ====================== 基础工具函数 ======================
export function countFrequency(history, n) {
  const recent = history.slice(-n);
  const freq = Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0]));
  recent.forEach(item => {
    if (item.number >= 1 && item.number <= 12) {
      freq[item.number]++;
    }
  });
  return freq;
}

export function getNextInCycle(current, cycleChain) {
  const index = cycleChain.indexOf(current);
  return index === -1 ? null : cycleChain[(index + 1) % cycleChain.length];
}

export function checkConsecutive(history, pool, n) {
  if (history.length < n) return false;
  const recent = history.slice(-n);
  return recent.every(item => pool.includes(item.number));
}

export function getRecentMainNumbers(history, mainPool, n = 3) {
  return history
    .slice(-n)
    .map(item => item.number)
    .filter(num => mainPool.includes(num))
    .reverse();
}

// ====================== 新增：降权专用工具函数 ======================
/**
 * 计算当前12期窗口各号码出现次数
 */
export function getCurrent12Freq(history) {
  return countFrequency(history, WEIGHT_CONFIG.windowSize);
}

/**
 * 模拟下一期滑动12期窗口，预判次数
 */
export function getNext12Freq(history) {
  if (history.length <= WEIGHT_CONFIG.windowSize) {
    return getCurrent12Freq(history);
  }
  // 剔除最旧一期，模拟窗口滑动
  const newHistory = history.slice(1);
  return countFrequency(newHistory, WEIGHT_CONFIG.windowSize);
}

/**
 * 获取最终降权黑名单
 * 规则：
 * 1. 当前12期=3次 初始降权
 * 2. 仅当前3次 且 下一期刚好=2次 → 解除降权
 * 3. 其余全部保留降权
 */
export function getDownWeightBlackList(history) {
  const currFreq = getCurrent12Freq(history);
  const nextFreq = getNext12Freq(history);
  const blackList = new Set();

  for (let num = 1; num <= 12; num++) {
    const curr = currFreq[num];
    const next = nextFreq[num];

    // 初始满3次标记降权
    if (curr === WEIGHT_CONFIG.downWeightLimit) {
      // 唯一解权条件：3 → 刚好2
      if (!(next === 2)) {
        blackList.add(num);
      }
    }
  }
  return Array.from(blackList);
}

/**
 * 过滤候选号码：剔除降权号，循环链补位
 */
export function filterByWeight(history, candidateNums, config) {
  const blackList = getDownWeightBlackList(history);
  // 先剔除降权号码
  let valid = candidateNums.filter(num => !blackList.includes(num));
  // 不足4码，从循环链顺位补位
  if (valid.length < 4) {
    const chain = config.cycleChain;
    for (const num of chain) {
      if (!valid.includes(num) && !blackList.includes(num)) {
        valid.push(num);
        if (valid.length >= 4) break;
      }
    }
  }
  return {
    main: valid.slice(0, 4).sort((a, b) => a - b),
    downWeight: blackList.sort((a, b) => a - b)
  };
}

// ====================== 核心周期判定 V1.3.0 ======================
export function detectCycleStage(history) {
  const sortedHistory = [...history].sort((a, b) => a.issue - b.issue);

  if (sortedHistory.length < 20) {
    return {
      stage: CYCLE_STAGES.INSUFFICIENT_DATA,
      advice: `历史数据仅有${sortedHistory.length}期，需要至少20期才能准确判断周期`,
      requiredData: 20 - sortedHistory.length
    };
  }

  const freq20 = countFrequency(sortedHistory, 20);
  const v1Count = CYCLE_CONFIG.V1.mainPool.reduce((sum, num) => sum + freq20[num], 0);
  const v2Count = CYCLE_CONFIG.V2.mainPool.reduce((sum, num) => sum + freq20[num], 0);

  const cons3V1 = checkConsecutive(sortedHistory, CYCLE_CONFIG.V1.mainPool, 3);
  const cons3V2 = checkConsecutive(sortedHistory, CYCLE_CONFIG.V2.mainPool, 3);
  const cons2V1 = checkConsecutive(sortedHistory, CYCLE_CONFIG.V1.mainPool, 2);
  const cons2V2 = checkConsecutive(sortedHistory, CYCLE_CONFIG.V2.mainPool, 2);

  const recentNumbers = sortedHistory.slice(-4).map(item => item.number);
  let chainValidV1 = 0, chainValidV2 = 0;
  for (let i = 0; i < recentNumbers.length - 1; i++) {
    if (CYCLE_CONFIG.V1.mainPool.includes(recentNumbers[i]) && getNextInCycle(recentNumbers[i], CYCLE_CONFIG.V1.cycleChain) === recentNumbers[i+1]) chainValidV1++;
    if (CYCLE_CONFIG.V2.mainPool.includes(recentNumbers[i]) && getNextInCycle(recentNumbers[i], CYCLE_CONFIG.V2.cycleChain) === recentNumbers[i+1]) chainValidV2++;
  }

  let dominantCycle = null;

  if (v2Count >= v1Count + 1) {
    if (cons3V2 || cons2V2 || chainValidV2 >= 1) dominantCycle = CYCLE_CONFIG.V2;
  }
  if (v1Count >= v2Count + 1) {
    if (cons3V1 || cons2V1 || chainValidV1 >= 1) dominantCycle = CYCLE_CONFIG.V1;
  }

  if (Math.abs(v1Count - v2Count) <= 1) {
    if (cons3V2 || (cons2V2 && chainValidV2 >= 1)) dominantCycle = CYCLE_CONFIG.V2;
    else if (cons3V1 || (cons2V1 && chainValidV1 >= 1)) dominantCycle = CYCLE_CONFIG.V1;
  }

  if (!dominantCycle) {
    return {
      stage: CYCLE_STAGES.TRANSITION,
      dominantCycle: '双池并行',
      v1MainCount: v1Count,
      v2MainCount: v2Count
    };
  }

  const otherCycle = dominantCycle === CYCLE_CONFIG.V1 ? CYCLE_CONFIG.V2 : CYCLE_CONFIG.V1;
  const newCycleSignals = [];
  if (checkConsecutive(sortedHistory, otherCycle.mainPool, 3)) newCycleSignals.push('连续3期开出新周期号码');

  if (newCycleSignals.length >= 1) {
    return {
      stage: otherCycle === CYCLE_STAGES.V1_STABLE ? CYCLE_STAGES.V1_STABLE : CYCLE_STAGES.V2_STABLE,
      dominantCycle: otherCycle.name,
      v1MainCount: v1Count,
      v2MainCount: v2Count
    };
  }

  return {
    stage: dominantCycle === CYCLE_CONFIG.V1 ? CYCLE_STAGES.V1_STABLE : CYCLE_STAGES.V2_STABLE,
    dominantCycle: dominantCycle.name,
    v1MainCount: v1Count,
    v2MainCount: v2Count
  };
}

// ====================== 号码生成 + 降权过滤整合 ======================
export function generateStableNumbers(history, config) {
  const sortedHistory = [...history].sort((a, b) => a.issue - b.issue);
  const recentMainNumbers = getRecentMainNumbers(sortedHistory, config.mainPool, 3);
  const hotNumbers = recentMainNumbers.slice(0, 2);

  let mainNumbers = [];
  if (hotNumbers.length >= 1) {
    const warmNumbers = hotNumbers
      .map(num => getNextInCycle(num, config.cycleChain))
      .filter(Boolean);
    mainNumbers = [...new Set([...hotNumbers, ...warmNumbers])];
  }

  // 降权过滤 + 循环链补位
  const filterRes = filterByWeight(sortedHistory, mainNumbers, config);

  return {
    mainNumbers: filterRes.main,
    alternativeNumbers: [...config.transitionPool].sort((a, b) => a - b),
    downWeightList: filterRes.downWeight,
    configUsed: config.name
  };
}

export function generateTransitionNumbers(history) {
  const sortedHistory = [...history].sort((a, b) => a.issue - b.issue);
  const oldPoolNumbers = getRecentMainNumbers(sortedHistory, CYCLE_CONFIG.V1.mainPool, 3);
  const newPoolNumbers = getRecentMainNumbers(sortedHistory, CYCLE_CONFIG.V2.mainPool, 3);

  const oldHot = oldPoolNumbers[0] || CYCLE_CONFIG.V1.mainPool[0];
  const newHot = newPoolNumbers[0] || CYCLE_CONFIG.V2.mainPool[0];
  const transitionNums = [oldHot, newHot].sort((a, b) => a - b);

  // 过渡期同样过滤降权号
  const filterRes = filterByWeight(sortedHistory, transitionNums, CYCLE_CONFIG.V2);

  return {
    transitionNumbers: transitionNums.filter(n => !filterRes.downWeight.includes(n)),
    downWeightList: filterRes.downWeight,
    note: '过渡期仅推荐非降权2码'
  };
}

// ====================== 操作建议 & 主函数 ======================
export function generateOperationAdvice(stage) {
  switch (stage) {
    case CYCLE_STAGES.V1_STABLE:
    case CYCLE_STAGES.V2_STABLE:
      return { riskLevel: RISK_LEVELS.LOW, tip: '稳定期主推4非降权码，顺势跟进' };
    case CYCLE_STAGES.TRANSITION:
      return { riskLevel: RISK_LEVELS.HIGH, tip: '过渡期观望，仅小资金试2码' };
    default:
      return { riskLevel: RISK_LEVELS.UNKNOWN, tip: '数据不足，不参与' };
  }
}

export function generateFullReport(history) {
  const cycleStatus = detectCycleStage(history);
  const advice = generateOperationAdvice(cycleStatus.stage);
  let numbersResult = null;

  if (cycleStatus.stage === CYCLE_STAGES.V1_STABLE) {
    numbersResult = generateStableNumbers(history, CYCLE_CONFIG.V1);
  } else if (cycleStatus.stage === CYCLE_STAGES.V2_STABLE) {
    numbersResult = generateStableNumbers(history, CYCLE_CONFIG.V2);
  } else if (cycleStatus.stage === CYCLE_STAGES.TRANSITION) {
    numbersResult = generateTransitionNumbers(history);
  }

  return {
    currentStage: cycleStatus.stage,
    riskLevel: advice.riskLevel,
    cycleStatus,
    numbers: numbersResult,
    advice
  };
}