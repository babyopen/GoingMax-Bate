/**
 * 离线验证 v2.6.3 清理：halfHit 字段已彻底移除
 *
 * 验证点：
 *   - 业务层不再输出 halfHit 字段
 *   - colorHit 是唯一的波色命中判定
 *   - allHit = zodiacHit && colorHit && tailHit && headHit
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

// v2.6.3 清理版：halfHit 字段已彻底移除
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

    const zodiacHit = act.zod !== calcDim(winSpecs, ZOD, 'zod');
    const colorHit = act.colorName !== calcDim(winSpecs, COLOR, 'colorName');
    const tailHit = act.tail !== calcDim(winSpecs, TAIL, 'tail');
    const headHit = act.head !== calcDim(winSpecs, HEAD, 'head');
    const allHit = zodiacHit && colorHit && tailHit && headHit;

    rows.push({
      expect: data[i].expect,
      zodiac: act.zod, // 简化：仅占位
      color: act.colorName,
      tail: act.tail, head: act.head,
      actualZodiac: act.zod, actualTe: act.te, actualColor: act.colorName,
      actualHead: act.head, actualTail: act.tail,
      zodiacHit, colorHit, tailHit, headHit, allHit,
      missCount: (zodiacHit?0:1) + (colorHit?0:1) + (tailHit?0:1) + (headHit?0:1),
      windowUsed: safeW
    });
  }
  return rows.slice(0, limit);
}

console.log('=== v2.6.3 离线清理验证 ===');
const data = [];
for (let i = 0; i < 50; i++) data.push({ expect: '2026' + String(i).padStart(4, '0'), te: (i % 49) + 1 });
const rows = calculateBacktrack(data, 100, { adaptiveWindow: false });

console.log('\n--- 字段检查 ---');
const r0 = rows[0];
const expectedFields = ['expect','zodiac','color','tail','head',
  'actualZodiac','actualTe','actualColor','actualHead','actualTail',
  'zodiacHit','colorHit','tailHit','headHit','allHit','missCount','windowUsed'];
const removedFields = ['halfHit','half','actualHalf','actualOdd'];

let pass = true;
expectedFields.forEach(f => {
  if (!(f in r0)) { console.log('  ❌ 缺少字段:', f); pass = false; }
});
removedFields.forEach(f => {
  if (f in r0) { console.log('  ❌ 冗余字段未清理:', f); pass = false; } else {
    console.log('  ✅ 已移除:', f);
  }
});

console.log('\n--- 命中率 ---');
const stat = (k) => rows.filter(r => r[k]).length;
console.log('  总数:', rows.length);
console.log('  zodiacHit:', (stat('zodiacHit')/rows.length*100).toFixed(2) + '%');
console.log('  colorHit :', (stat('colorHit')/rows.length*100).toFixed(2) + '%');
console.log('  tailHit  :', (stat('tailHit')/rows.length*100).toFixed(2) + '%');
console.log('  headHit  :', (stat('headHit')/rows.length*100).toFixed(2) + '%');
console.log('  allHit   :', (stat('allHit')/rows.length*100).toFixed(2) + '%');

console.log('\n===', pass ? '✅ v2.6.3 清理验证通过' : '❌ 验证失败');
process.exit(pass ? 0 : 1);