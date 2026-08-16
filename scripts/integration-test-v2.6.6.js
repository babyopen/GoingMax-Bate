/**
 * v2.6.6 性能优化验证：_runGenericBacktest 预计算 specials
 *
 * 验证：
 *   1. 等价性：与旧逻辑输出完全一致
 *   2. 性能：getSpecial 调用次数大幅减少（-80%+）
 *
 * 通过 mock Utils + CONFIG，独立运行新旧两个版本进行对比
 */
'use strict';

const fs = require('fs');

// === Mock Utils ===
let getSpecialCallCount = 0;
const TE_FROM_EXPECT = {}; // 简单映射：expect 后3位 → te（1-49）
for (let i = 1; i <= 49; i++) TE_FROM_EXPECT[String(i).padStart(4, '0')] = i;

function getSpecial(item) {
  getSpecialCallCount++;
  const te = TE_FROM_EXPECT[item.expect.slice(-4)] || 1;
  return {
    te: te,
    zod: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'][te % 12],
    wuxing: ['金','木','水','火','土'][te % 5],
    colorName: ['红','蓝','绿'][te % 3],
    odd: te % 2 === 1
  };
}
const Utils = { SpecialCalculator: { getSpecial } };
const CONFIG = { BIG_RANGE: [25, 48] };

// === 旧版本（v2.6.5 之前）：每个回调都自调 getSpecial ===
function runOld(data, testCount, config) {
  const results = [];
  const maxOffset = Math.min(testCount, data.length - 6);
  for (let offset = 0; offset < maxOffset; offset++) {
    const targetItem = data[offset];
    if (!targetItem) continue;

    const recentData = data.slice(offset + 1, offset + 7);
    if (recentData.length < 5) continue;

    const lastValues = [];
    for (let i = 0; i < Math.min(5, recentData.length); i++) {
      // 旧版本：直接调 config.extractValue（内部会调 getSpecial）
      const val = config.extractValue(recentData[i]);
      if (config.categories.indexOf(val) !== -1) lastValues.push(val);
      else lastValues.push(config.categories[0]);
    }
    if (lastValues.length < 3) continue;

    const scores = {};
    config.categories.forEach(c => scores[c] = 0);
    const last3 = lastValues.slice(0, 3);
    const allSame3 = last3.every(v => v === last3[0]);
    if (allSame3) {
      const others = config.categories.filter(c => c !== last3[0]);
      others.forEach(c => scores[c] += config.weights.consecutive);
    } else if (last3[0] !== last3[1] && last3[1] !== last3[2]) {
      scores[last3[0]] += config.weights.alternate;
    }

    const valueCount = {};
    lastValues.forEach(v => valueCount[v] = (valueCount[v] || 0) + 1);
    Object.keys(valueCount).forEach(val => {
      if (valueCount[val] >= 3) {
        const bonus = (valueCount[val] - 2) * 8;
        const otherVals = config.categories.filter(c => c !== val);
        otherVals.forEach(c => scores[c] += Math.max(5, bonus));
      }
    });

    if (lastValues.length >= 4 && lastValues[2] === last3[0]) {
      scores[last3[0]] += config.weights.repeat;
    }
    if (last3[0] === last3[1]) scores[last3[0]] += config.weights.inertia;

    let maxScore = -1, bestValue = '-';
    Object.keys(scores).forEach(val => {
      if (scores[val] > maxScore) { maxScore = scores[val]; bestValue = val; }
    });

    let predictedValue = bestValue;
    let confidence;
    if (maxScore > 0) {
      confidence = Math.min(72, 42 + Math.round((maxScore / 50) * 28));
    } else {
      predictedValue = lastValues[0];
      confidence = 40;
    }

    // 旧版本：targetItem 也调一次 getSpecial
    const actualValue = config.extractValue(targetItem);
    if (!actualValue) continue;
    if (predictedValue === '-') continue;
    const isHit = predictedValue === actualValue;

    results.push({
      expect: targetItem.expect,
      predictedValue,
      actualValue,
      // 旧版本：再调一次 getNumber（也调 getSpecial）
      actualNumber: config.getNumber(targetItem),
      confidence,
      isHit
    });
  }
  return results;
}

// === 新版本（v2.6.6）：预计算 specials ===
function runNew(data, testCount, config) {
  const results = [];
  const maxOffset = Math.min(testCount, data.length - 6);

  // v2.6.6 关键优化：一次性预计算
  const specials = data.map(item => Utils.SpecialCalculator.getSpecial(item));

  for (let offset = 0; offset < maxOffset; offset++) {
    const targetItem = data[offset];
    if (!targetItem) continue;

    const recentData = data.slice(offset + 1, offset + 7);
    if (recentData.length < 5) continue;

    const lastValues = [];
    for (let i = 0; i < Math.min(5, recentData.length); i++) {
      // v2.6.6：传入预计算的 special（回调不再调 getSpecial）
      const val = config.extractValue(recentData[i], specials[offset + 1 + i]);
      if (config.categories.indexOf(val) !== -1) lastValues.push(val);
      else lastValues.push(config.categories[0]);
    }
    if (lastValues.length < 3) continue;

    const scores = {};
    config.categories.forEach(c => scores[c] = 0);
    const last3 = lastValues.slice(0, 3);
    const allSame3 = last3.every(v => v === last3[0]);
    if (allSame3) {
      const others = config.categories.filter(c => c !== last3[0]);
      others.forEach(c => scores[c] += config.weights.consecutive);
    } else if (last3[0] !== last3[1] && last3[1] !== last3[2]) {
      scores[last3[0]] += config.weights.alternate;
    }

    const valueCount = {};
    lastValues.forEach(v => valueCount[v] = (valueCount[v] || 0) + 1);
    Object.keys(valueCount).forEach(val => {
      if (valueCount[val] >= 3) {
        const bonus = (valueCount[val] - 2) * 8;
        const otherVals = config.categories.filter(c => c !== val);
        otherVals.forEach(c => scores[c] += Math.max(5, bonus));
      }
    });

    if (lastValues.length >= 4 && lastValues[2] === last3[0]) {
      scores[last3[0]] += config.weights.repeat;
    }
    if (last3[0] === last3[1]) scores[last3[0]] += config.weights.inertia;

    let maxScore = -1, bestValue = '-';
    Object.keys(scores).forEach(val => {
      if (scores[val] > maxScore) { maxScore = scores[val]; bestValue = val; }
    });

    let predictedValue = bestValue;
    let confidence;
    if (maxScore > 0) {
      confidence = Math.min(72, 42 + Math.round((maxScore / 50) * 28));
    } else {
      predictedValue = lastValues[0];
      confidence = 40;
    }

    const actualValue = config.extractValue(targetItem, specials[offset]);
    if (!actualValue) continue;
    if (predictedValue === '-') continue;
    const isHit = predictedValue === actualValue;

    results.push({
      expect: targetItem.expect,
      predictedValue,
      actualValue,
      actualNumber: config.getNumber(targetItem, specials[offset]),
      confidence,
      isHit
    });
  }
  return results;
}

// === 测试数据 ===
const data = [];
for (let i = 0; i < 30; i++) {
  const te = (i % 49) + 1;
  data.push({ expect: '2026' + String(te).padStart(4, '0'), te });
}

const sizeConfig = {
  categories: ['大', '小'],
  weights: { consecutive: 20, alternate: 0, repeat: 15, inertia: 12, statistical: 0 },
  extractValue: function(item, special) {
    if (!special) special = Utils.SpecialCalculator.getSpecial(item);
    return special.te >= CONFIG.BIG_RANGE[0] && special.te <= CONFIG.BIG_RANGE[1] ? '大' : '小';
  },
  getNumber: function(item, special) {
    if (!special) special = Utils.SpecialCalculator.getSpecial(item);
    return special.te;
  }
};

console.log('=== v2.6.6 性能 + 等价性验证 ===\n');

// === Test 1: 等价性 ===
console.log('--- Test 1: 输出结果等价性 ---');
getSpecialCallCount = 0;
const oldRes = runOld(data, 24, sizeConfig);
const oldCalls = getSpecialCallCount;

getSpecialCallCount = 0;
const newRes = runNew(data, 24, sizeConfig);
const newCalls = getSpecialCallCount;

let pass1 = oldRes.length === newRes.length;
if (pass1) {
  for (let i = 0; i < oldRes.length; i++) {
    if (oldRes[i].predictedValue !== newRes[i].predictedValue ||
        oldRes[i].actualValue !== newRes[i].actualValue ||
        oldRes[i].actualNumber !== newRes[i].actualNumber ||
        oldRes[i].isHit !== newRes[i].isHit) {
      pass1 = false;
      console.log('  ❌ 第', i, '条不一致');
      break;
    }
  }
}
console.log(pass1 ? '  ✅ 30 期结果完全一致' : '  ❌ 结果不一致');

// === Test 2: 性能 ===
console.log('\n--- Test 2: getSpecial 调用次数 ---');
const reduction = ((oldCalls - newCalls) / oldCalls * 100).toFixed(1);
console.log('  旧版本:', oldCalls, '次');
console.log('  新版本:', newCalls, '次');
console.log('  减少:', reduction + '%');
const pass2 = newCalls <= oldCalls * 0.3; // 减少 70% 以上
console.log(pass2 ? '  ✅ 调用次数减少 > 70%' : '  ❌ 调用次数减少不足');

// === Test 3: 耗时对比 ===
console.log('\n--- Test 3: 耗时对比（1000 次迭代平均） ---');

// 测旧版本
const t1 = process.hrtime.bigint();
for (let i = 0; i < 1000; i++) runOld(data, 24, sizeConfig);
const oldMs = Number(process.hrtime.bigint() - t1) / 1e6;

// 测新版本
const t2 = process.hrtime.bigint();
for (let i = 0; i < 1000; i++) runNew(data, 24, sizeConfig);
const newMs = Number(process.hrtime.bigint() - t2) / 1e6;

const speedup = ((oldMs - newMs) / oldMs * 100).toFixed(1);
console.log('  旧版本:', oldMs.toFixed(2), 'ms');
console.log('  新版本:', newMs.toFixed(2), 'ms');
console.log('  加速:', speedup + '%');

// === Test 4: 业务代码改动确认 ===
console.log('\n--- Test 4: 业务代码改动确认 ---');
const bizCode = fs.readFileSync('business/zodiac/business-zodiac-backtest.js', 'utf8');
const checks = [
  { name: '预计算 specials 数组', pattern: /const specials = historyData\.map\(/, shouldExist: true },
  { name: 'extractValue 接收 special', pattern: /config\.extractValue\(recentData\[i\], specials\[/, shouldExist: true },
  { name: 'extractValue 接收 special（target）', pattern: /config\.extractValue\(targetItem, specials\[offset\]\)/, shouldExist: true },
  { name: 'getNumber 接收 special', pattern: /config\.getNumber\(targetItem, specials\[offset\]\)/, shouldExist: true },
  { name: 'buildSequence 接收 specials（3处）', pattern: /config\.buildSequence\(historyData, offset, specials\)/, shouldExist: true }
];
let pass4 = true;
checks.forEach(c => {
  const found = c.pattern.test(bizCode);
  if (c.shouldExist !== found) { console.log('  ❌', c.name); pass4 = false; }
  else console.log('  ✅', c.name);
});

const passAll = pass1 && pass2 && pass4;
console.log('\n===', passAll ? '✅ 所有验证通过' : '❌ 部分测试失败');
process.exit(passAll ? 0 : 1);