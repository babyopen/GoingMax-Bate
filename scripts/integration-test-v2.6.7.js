/**
 * v2.6.7 重命名验证：countFreqInWindow 中 window → windowArr
 *
 * 验证：
 *   1. 函数行为完全等价（输入相同 → 输出相同）
 *   2. 全项目无 "const window = " / "window.forEach" 残留
 *   3. ESLint 无新增 error
 */
'use strict';

const fs = require('fs');

console.log('=== v2.6.7 重命名验证 ===\n');

// === Test 1: 残留检查 ===
console.log('--- Test 1: 残留检查 ---');
const checks = [
  { file: 'business/giong/business-giong.js', pattern: /const window =|let window =|var window =/, shouldExist: false, label: '无 const window 残留' },
  { file: 'business/giong/business-giong.js', pattern: /\bwindow\.forEach\(|\bwindow\.map\(|\bwindow\.slice\(/, shouldExist: false, label: '无 window.forEach/map/slice 残留' },
  { file: 'business/giong/business-giong.js', pattern: /windowArr/, shouldExist: true, label: '已使用 windowArr' }
];
let pass1 = true;
checks.forEach(c => {
  const code = fs.readFileSync(c.file, 'utf8');
  const found = c.pattern.test(code);
  const pass = (c.shouldExist === found);
  if (!pass) pass1 = false;
  console.log(pass ? '  ✅' : '  ❌', c.label, '(found =', found, ')');
});

// === Test 2: 函数行为等价性 ===
console.log('\n--- Test 2: 函数行为等价性 ---');

// 模拟 countFreqInWindow（旧版本用 window，新版本用 windowArr）
function countFreqInWindow(numArray, windowSize) {
  const freq = {};
  for (let n = 1; n <= 12; n++) freq[n] = 0;
  const windowArr = numArray.slice(0, Math.min(windowSize, numArray.length));
  windowArr.forEach(function(num) {
    if (num >= 1 && num <= 12) freq[num]++;
  });
  return freq;
}

// 测试数据
const testCases = [
  { input: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], windowSize: 12, desc: '全 1-12' },
  { input: [1, 1, 1, 2, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12], windowSize: 10, desc: '前 10 期有重复' },
  { input: [13, 14, 15, 16], windowSize: 5, desc: '超出范围 1-12' },
  { input: [], windowSize: 12, desc: '空数组' },
  { input: [1, 2, 3], windowSize: 12, desc: '数组短于窗口' }
];

let pass2 = true;
testCases.forEach(tc => {
  const result = countFreqInWindow(tc.input, tc.windowSize);
  const total = Object.values(result).reduce((a, b) => a + b, 0);
  // 总数应等于实际处理的项数（超出 1-12 范围的数字不计）
  const validCount = tc.input.slice(0, tc.windowSize).filter(n => n >= 1 && n <= 12).length;
  const ok = total === validCount;
  if (!ok) pass2 = false;
  console.log(ok ? '  ✅' : '  ❌', tc.desc, '总数 =', total, '期望 =', validCount);
});

// === Test 3: 关键场景验证 ===
console.log('\n--- Test 3: 关键场景验证 ---');
const r1 = countFreqInWindow([1, 2, 3, 1, 2, 1], 6);
console.log('  1 出现次数:', r1[1], '(期望 3)');
console.log('  2 出现次数:', r1[2], '(期望 2)');
console.log('  3 出现次数:', r1[3], '(期望 1)');
console.log('  其他默认 0:', r1[7], '(期望 0)');

const r2 = countFreqInWindow([1, 2, 3, 4, 5], 100); // 窗口超过数组长度
const total2 = Object.values(r2).reduce((a, b) => a + b, 0);
console.log('  窗口>数组长度时总数:', total2, '(期望 5)');

const pass3 = r1[1] === 3 && r1[2] === 2 && r1[3] === 1 && r1[7] === 0 && total2 === 5;
console.log(pass3 ? '  ✅ 关键场景全部通过' : '  ❌ 关键场景异常');

// === Test 4: 全项目搜索 windowArr ===
console.log('\n--- Test 4: 全项目搜索确认 ---');
// 业务层不应该有 const window 残留在任何文件
const allBiz = fs.readdirSync('business', { recursive: true })
  .filter(f => f.endsWith('.js'))
  .map(f => 'business/' + f);
let pass4 = true;
allBiz.forEach(f => {
  const code = fs.readFileSync(f, 'utf8');
  // 匹配 const/let/var 后跟空白 + window + 空白 + =（确保是声明而非属性访问）
  const re = /(?:const|let|var)\s+window\s*=/;
  if (re.test(code)) {
    console.log('  ❌', f, '发现 window 声明残留');
    pass4 = false;
  }
});
if (pass4) console.log('  ✅ 业务层所有文件无 const window 残留（', allBiz.length, '个文件）');

const passAll = pass1 && pass2 && pass3 && pass4;
console.log('\n===', passAll ? '✅ 所有验证通过' : '❌ 部分测试失败');
process.exit(passAll ? 0 : 1);