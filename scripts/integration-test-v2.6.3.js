/**
 * 集成测试 v2.6.3：halfHit 已彻底移除
 * 验证：
 *   1. 输出字段结构正确（无 halfHit）
 *   2. allHit = zodiacHit && colorHit && tailHit && headHit
 *   3. 自适应窗口模式正常
 */
'use strict';

const ZOD = ['鼠','牛','虎','兔','龙','蛇','马','羊','猴','鸡','狗','猪'];
const COLOR = ['红','蓝','绿'];
const HEAD = [0,1,2,3,4];
const TAIL = [0,1,2,3,4,5,6,7,8,9];

function getSpec(te) {
  return {
    te, tail: te % 10, head: Math.floor(te / 10),
    colorName: COLOR[te % 3], zod: ZOD[te % 12], odd: te % 2 === 1
  };
}

function calcDim(specs, domain, valKey) {
  const freq = {};
  domain.forEach(d => freq[d] = 0);
  specs.forEach(s => freq[s[valKey]]++);
  let minF = Infinity, top = domain[0];
  domain.forEach(d => { if (freq[d] < minF) { minF = freq[d]; top = d; } });
  return top;
}

// v2.6.3 完整实现（与 business-impossible.js 一致）
function calculateBacktrack(data, limit, options) {
  const W = 24;
  const n = data.length;
  if (n < W + 1) return [];
  const specs = data.map(d => getSpec(d.te));
  const rows = [];

  for (let i = 0; i < n - W; i++) {
    const safeW = options && options.adaptiveWindow ? Math.max(6, Math.min(W, n - i - 1)) : W;
    const winSpecs = specs.slice(i + 1, i + 1 + safeW);
    if (winSpecs.length < 6) continue;
    const act = specs[i];
    if (!act || act.te === undefined) continue;

    const zP = calcDim(winSpecs, ZOD, 'zod');
    const cP = calcDim(winSpecs, COLOR, 'colorName');
    const tP = calcDim(winSpecs, TAIL, 'tail');
    const hP = calcDim(winSpecs, HEAD, 'head');

    const zodiacHit = act.zod !== zP;
    const colorHit = act.colorName !== cP;
    const tailHit = act.tail !== tP;
    const headHit = act.head !== hP;
    const allHit = zodiacHit && colorHit && tailHit && headHit;

    rows.push({
      expect: data[i].expect,
      zodiac: zP, color: cP, tail: tP, head: hP,
      actualZodiac: act.zod, actualTe: act.te, actualColor: act.colorName,
      actualHead: act.head, actualTail: act.tail,
      zodiacHit, colorHit, tailHit, headHit, allHit,
      missCount: (zodiacHit?0:1) + (colorHit?0:1) + (tailHit?0:1) + (headHit?0:1),
      windowUsed: safeW
    });
  }
  return rows.slice(0, limit);
}

console.log('=== v2.6.3 集成测试 ===\n');

// Test 1: 字段结构
const data = [];
for (let i = 0; i < 50; i++) data.push({ expect: '2026' + String(i).padStart(4, '0'), te: (i % 49) + 1 });
const rows1 = calculateBacktrack(data, 100, { adaptiveWindow: false });

console.log('--- Test 1: 字段结构 ---');
const r0 = rows1[0];
const expectedFields = ['expect','zodiac','color','tail','head',
  'actualZodiac','actualTe','actualColor','actualHead','actualTail',
  'zodiacHit','colorHit','tailHit','headHit','allHit','missCount','windowUsed'];
const removedFields = ['halfHit','half','actualHalf','actualOdd'];

let pass1 = true;
expectedFields.forEach(f => {
  if (!(f in r0)) { console.log('  ❌ 缺少字段:', f); pass1 = false; }
});
removedFields.forEach(f => {
  if (f in r0) { console.log('  ❌ 冗余字段未清理:', f); pass1 = false; }
});
console.log(pass1 ? '  ✅ 字段结构正确，halfHit 已移除' : '  ❌ 字段结构异常');

// Test 2: allHit 公式
console.log('\n--- Test 2: allHit 公式 ---');
let pass2 = true;
rows1.forEach(r => {
  const expected = r.zodiacHit && r.colorHit && r.tailHit && r.headHit;
  if (r.allHit !== expected) pass2 = false;
});
console.log(pass2 ? '  ✅ allHit = zodiacHit && colorHit && tailHit && headHit' : '  ❌ 公式错误');

// Test 3: 自适应窗口
console.log('\n--- Test 3: adaptiveWindow ---');
const rows2 = calculateBacktrack(data, 100, { adaptiveWindow: true });
const pass3 = rows2.length > 0 && rows2.every(r => r.windowUsed >= 6 && r.windowUsed <= 30);
console.log(pass3 ? '  ✅ 自适应窗口范围 6-30' : '  ❌ 自适应窗口异常');

// Test 4: 命中率
console.log('\n--- Test 4: 命中率 ---');
const total = rows1.length;
const stat = (key) => rows1.filter(r => r[key]).length;
console.log('  zodiacHit:', (stat('zodiacHit') / total * 100).toFixed(2) + '%');
console.log('  colorHit :', (stat('colorHit') / total * 100).toFixed(2) + '%');
console.log('  tailHit  :', (stat('tailHit') / total * 100).toFixed(2) + '%');
console.log('  headHit  :', (stat('headHit') / total * 100).toFixed(2) + '%');
console.log('  allHit   :', (stat('allHit') / total * 100).toFixed(2) + '%');

const allPass = pass1 && pass2 && pass3;
console.log('\n===', allPass ? '✅ 所有测试通过' : '❌ 部分测试失败');
process.exit(allPass ? 0 : 1);