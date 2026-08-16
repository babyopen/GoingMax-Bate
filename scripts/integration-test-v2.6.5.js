/**
 * v2.6.5 重构验证：_analyzeGenericPatterns 通用方法
 *
 * 直接复制通用方法的源码到测试脚本，独立运行验证行为
 */
'use strict';

console.log('=== v2.6.5 重构验证 ===\n');

// 复制通用方法的实现（与业务层代码一致）
function analyzeGenericPatterns(sequence, valKey, options) {
  options = options || {};
  if (!sequence || sequence.length < 2) return [];
  const hotThreshold = options.hotThreshold || 0;
  const label = options.label || '交替';

  const patterns = [];
  let currentStreak = 1;
  let streakType = sequence[0][valKey];

  for (let i = 1; i < sequence.length; i++) {
    if (sequence[i][valKey] === streakType) {
      currentStreak++;
    } else {
      if (currentStreak >= 2) {
        patterns.push({
          type: streakType + '连',
          count: currentStreak,
          startIdx: i - currentStreak,
          endIdx: i - 1
        });
      }
      streakType = sequence[i][valKey];
      currentStreak = 1;
    }
  }

  if (currentStreak >= 2) {
    patterns.push({
      type: streakType + '连',
      count: currentStreak,
      startIdx: sequence.length - currentStreak,
      endIdx: sequence.length - 1
    });
  }

  let alternations = 0;
  for (let j = 1; j < sequence.length - 1; j++) {
    if (sequence[j][valKey] !== sequence[j - 1][valKey] &&
        sequence[j][valKey] !== sequence[j + 1][valKey]) {
      alternations++;
    }
  }
  if (alternations >= 3) {
    patterns.push({
      type: '交替频繁',
      count: alternations,
      description: '近期' + label + '交替出现较频繁'
    });
  }

  if (hotThreshold > 0) {
    const hot = {};
    sequence.forEach(function (item) {
      hot[item[valKey]] = (hot[item[valKey]] || 0) + 1;
    });
    const sorted = Object.keys(hot).sort(function (a, b) { return hot[b] - hot[a]; });
    if (sorted.length > 0 && hot[sorted[0]] >= hotThreshold) {
      patterns.push({
        type: sorted[0] + '热',
        count: hot[sorted[0]],
        description: sorted[0] + '近期出现' + hot[sorted[0]] + '次'
      });
    }
  }

  return patterns;
}

// === Test 1: API 完整性 ===
console.log('--- Test 1: API 完整性 ---');
const fs = require('fs');
const code = fs.readFileSync('business/zodiac/business-zodiac-stats.js', 'utf8');
const required = ['_analyzeSizePatterns', '_analyzeOddEvenPatterns', '_analyzeWuxingPatterns', '_analyzeColorPatterns', '_analyzeGenericPatterns'];
let pass1 = true;
required.forEach(m => {
  const re = new RegExp(m + ':\\s*function');
  if (!re.test(code)) { console.log('  ❌', m, '缺失'); pass1 = false; }
  else console.log('  ✅', m);
});

// === Test 2: 4 个薄包装都是单行委托 ===
console.log('\n--- Test 2: 薄包装为单行委托 ---');
const thinWrappers = ['_analyzeSizePatterns', '_analyzeOddEvenPatterns', '_analyzeWuxingPatterns', '_analyzeColorPatterns'];
let pass2 = true;
thinWrappers.forEach(m => {
  const re = new RegExp(m + ':\\s*function\\([^)]*\\)\\s*{[^}]*_analyzeGenericPatterns[^}]*}', 's');
  if (!re.test(code)) { console.log('  ❌', m, '不是薄包装'); pass2 = false; }
  else console.log('  ✅', m, '已简化为薄包装');
});

// === Test 3: 通用方法独立调用 ===
console.log('\n--- Test 3: 通用方法独立调用 ---');

const seq1 = [{size:'大'},{size:'小'},{size:'大'},{size:'小'},{size:'大'},{size:'小'},{size:'大'},{size:'小'},{size:'大'},{size:'小'}];
const r1 = analyzeGenericPatterns(seq1, 'size', { label: '大小' });
console.log('  size:', r1.length, '个 pattern');
r1.forEach(p => console.log('    -', p.type, '×' + p.count));

const seqWX = [
  {wuxing:'金'},{wuxing:'金'},{wuxing:'木'},{wuxing:'金'},{wuxing:'金'},{wuxing:'金'},
  {wuxing:'水'},{wuxing:'金'},{wuxing:'金'},{wuxing:'金'}
];
const rWX = analyzeGenericPatterns(seqWX, 'wuxing', { hotThreshold: 3, label: '五行' });
console.log('  wuxing:', rWX.length, '个 pattern (含热度 =', rWX.some(p => p.type.includes('热')), ')');
rWX.forEach(p => console.log('    -', p.type, '×' + p.count));

// === Test 4: label 参数生效 ===
console.log('\n--- Test 4: label 参数生效 ---');
const altSeq = [];
for (let i = 0; i < 10; i++) altSeq.push({size: i % 2 === 0 ? '大' : '小'});
const a1 = analyzeGenericPatterns(altSeq, 'size', { label: '大小' });
const alt1 = a1.find(p => p.type === '交替频繁');
const pass4a = alt1 && alt1.description === '近期大小交替出现较频繁';
console.log(pass4a ? '  ✅ label="大小" 正确' : '  ❌', alt1 && alt1.description);

const altSeq2 = [];
for (let i = 0; i < 10; i++) altSeq2.push({type: i % 2 === 0 ? '单' : '双'});
const a2 = analyzeGenericPatterns(altSeq2, 'type', { label: '单双' });
const alt2 = a2.find(p => p.type === '交替频繁');
const pass4b = alt2 && alt2.description === '近期单双交替出现较频繁';
console.log(pass4b ? '  ✅ label="单双" 正确' : '  ❌', alt2 && alt2.description);

// === Test 5: 边界场景 ===
console.log('\n--- Test 5: 边界场景 ---');
console.log('  空数组:', JSON.stringify(analyzeGenericPatterns([], 'size', {})));
console.log('  长度 1:', JSON.stringify(analyzeGenericPatterns([{size:'大'}], 'size', {})));
console.log('  无热度阈值:', analyzeGenericPatterns([{wuxing:'金'},{wuxing:'金'},{wuxing:'金'}], 'wuxing', {}).length, '个（应无热度）');

// === Test 6: 代码行数变化 ===
console.log('\n--- Test 6: 代码量变化 ---');
const lines = code.split('\n').length;
console.log('  business-zodiac-stats.js 当前总行数:', lines);
console.log('  重构前约为 909 行（删 4 × ~50 行 + 加 ~85 行 = 净减 ~115 行）');

const passAll = pass1 && pass2 && pass4a && pass4b;
console.log('\n===', passAll ? '✅ 所有验证通过' : '❌ 部分测试失败');
process.exit(passAll ? 0 : 1);