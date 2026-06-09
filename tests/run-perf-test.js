/**
 * 性能测试运行脚本（Node.js 模拟）
 * 验证 Utils.memoize / LRU / SpecialCalculator 缓存等优化效果
 */

// 模拟浏览器环境
global.window = {};
global.document = {
  createElement: () => ({ id: '', style: {}, appendChild: () => {}, addEventListener: () => {} }),
  getElementById: () => null,
  querySelectorAll: () => [],
  body: { appendChild: () => {} },
  head: { appendChild: () => {} }
};
global.performance = { now: () => Date.now() };
global.navigator = { clipboard: null };
global.CONFIG = {
  COLOR_NAME_TO_EN: { '红': 'red', '蓝': 'blue', '绿': 'green' },
  ANALYSIS: { HOME_ZODIAC: ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'] }
};

// 加载 utils.js
const fs = require('fs');
const utilsCode = fs.readFileSync('./core/utils.js', 'utf-8');
// 替换 const 为 var 以便在 eval 后全局可见
const code = utilsCode.replace(/^const Utils/gm, 'var Utils');
eval(code);
global.Utils = Utils;

const results = [];
function log(msg, isPass) {
  results.push({ msg, isPass });
  console.log((isPass ? '✅' : '❌') + ' ' + msg);
}

function section(title) {
  console.log('\n=== ' + title + ' ===');
}

// 准备测试数据
const mockHistory = [];
for (let i = 0; i < 500; i++) {
  mockHistory.push({
    expect: '2025001-' + i,
    openCode: [1,2,3,4,5,6,(i%49)+1].join(','),
    zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
  });
}

// ============================================================
// 1. memoize 测试
// ============================================================
section('1. memoize 缓存（Utils.memoize）');
let callCount = 0;
const expensive = Utils.memoize((x) => {
  callCount++;
  return x * 2;
});

expensive(5); expensive(5); expensive(5); expensive(5); expensive(5);
expensive(10); expensive(10);

log('memoize 调用 7 次，实际执行 ' + callCount + ' 次（应为 2）', callCount === 2);

// ============================================================
// 2. LRU 缓存测试
// ============================================================
section('2. LRU 缓存（Utils.createLRU）');
const lru = Utils.createLRU(3);
lru.set('a', 1);
lru.set('b', 2);
lru.set('c', 3);
lru.set('d', 4);

log('LRU 容量限制：a 应被淘汰', lru.get('a') === undefined);
log('LRU 数据 b 仍存在', lru.get('b') === 2);
log('LRU 数据 d 已添加', lru.get('d') === 4);

// LRU 重新访问测试（使用新的独立实例）
const lru2 = Utils.createLRU(3);
lru2.set('a', 1);
lru2.set('b', 2);
lru2.set('c', 3);
lru2.get('b');  // 访问 b 提升为最近使用
lru2.set('d', 4);  // 应淘汰 a（最久未使用），保留 b
log('LRU 重新访问 b 后，再添加 d 应淘汰 a（最久未使用）', lru2.get('a') === undefined);
log('LRU 数据 b 仍存在（被重新访问过）', lru2.get('b') === 2);
log('LRU 数据 d 已添加', lru2.get('d') === 4);

// ============================================================
// 3. SpecialCalculator 缓存测试
// ============================================================
section('3. SpecialCalculator 缓存优化');

// 模拟 getColorName 和 getWuxing
Utils.getColorName = (n) => n % 3 === 0 ? '红' : (n % 3 === 1 ? '蓝' : '绿');
Utils.getWuxing = (n) => ['金','木','水','火','土'][n % 5];
Utils.parseZodiacArr = (item) => (item.zodiac || ',,,,,,,,,,,,').split(',');

// 第一次调用：实际计算
const start1 = process.hrtime.bigint();
mockHistory.forEach(item => Utils.SpecialCalculator.getSpecial(item));
const firstTime = Number(process.hrtime.bigint() - start1) / 1e6;

// 第二次调用：走缓存
const start2 = process.hrtime.bigint();
mockHistory.forEach(item => Utils.SpecialCalculator.getSpecial(item));
const secondTime = Number(process.hrtime.bigint() - start2) / 1e6;

const speedup = firstTime / Math.max(secondTime, 0.001);
log('首次计算 500 条: ' + firstTime.toFixed(2) + 'ms', true);
log('缓存命中 500 条: ' + secondTime.toFixed(2) + 'ms', true);
log('缓存加速比: ' + speedup.toFixed(1) + 'x', speedup >= 1);

// 验证结果正确性
const sample = Utils.SpecialCalculator.getSpecial(mockHistory[0]);
log('缓存结果正确性：包含 te 属性', sample.te !== undefined);
log('缓存结果正确性：包含 zod 属性', sample.zod !== undefined);

Utils.SpecialCalculator.clearCache();
log('SpecialCalculator.clearCache 可调用', true);

// ============================================================
// 4. createLRU 性能对比
// ============================================================
section('4. LRU 性能测试（10000 次读写）');
const lruPerf = Utils.createLRU(1000);  // 容量设为 1000 以确保 key_0~key_49 不会淘汰

const lruWriteStart = process.hrtime.bigint();
for (let i = 0; i < 10000; i++) {
  lruPerf.set('key_' + (i % 50), i);  // 实际只写入 50 个 key
}
const lruWriteTime = Number(process.hrtime.bigint() - lruWriteStart) / 1e6;

const lruReadStart = process.hrtime.bigint();
let totalSum = 0;
for (let i = 0; i < 10000; i++) {
  const v = lruPerf.get('key_' + (i % 50));
  if (v !== undefined) totalSum += v;
}
const lruReadTime = Number(process.hrtime.bigint() - lruReadStart) / 1e6;

log('LRU 10000 次写入: ' + lruWriteTime.toFixed(2) + 'ms', lruWriteTime < 100);
log('LRU 10000 次读取: ' + lruReadTime.toFixed(2) + 'ms', lruReadTime < 100);
log('LRU 读取结果校验: totalSum=' + totalSum, totalSum > 0);

// ============================================================
// 5. memoize 性能对比
// ============================================================
section('5. memoize 性能优化对比');

// 不使用缓存
let uncachedCalls = 0;
const uncachedFn = (x) => { uncachedCalls++; return x * 2 + Math.sqrt(x); };

const uncachedStart = process.hrtime.bigint();
for (let i = 0; i < 10000; i++) {
  uncachedFn(i % 100);
}
const uncachedTime = Number(process.hrtime.bigint() - uncachedStart) / 1e6;

// 使用缓存
let cachedCalls = 0;
const cachedFn = Utils.memoize((x) => { cachedCalls++; return x * 2 + Math.sqrt(x); });

const cachedStart = process.hrtime.bigint();
for (let i = 0; i < 10000; i++) {
  cachedFn(i % 100);
}
const cachedTime = Number(process.hrtime.bigint() - cachedStart) / 1e6;

log('无缓存 10000 次调用: ' + uncachedTime.toFixed(2) + 'ms（' + uncachedCalls + ' 次实际执行）', true);
log('有缓存 10000 次调用: ' + cachedTime.toFixed(2) + 'ms（' + cachedCalls + ' 次实际执行）', true);
log('memoize 实际执行次数降低: ' + ((1 - cachedCalls/uncachedCalls) * 100).toFixed(1) + '%', cachedCalls < uncachedCalls);

// ============================================================
// 汇总
// ============================================================
const passedCount = results.filter(r => r.isPass).length;
const totalCount = results.length;
console.log('\n' + '='.repeat(50));
console.log('汇总：通过 ' + passedCount + ' / ' + totalCount);
if (passedCount === totalCount) {
  console.log('🎉 全部通过！');
} else {
  console.log('⚠️  有 ' + (totalCount - passedCount) + ' 项失败');
}
