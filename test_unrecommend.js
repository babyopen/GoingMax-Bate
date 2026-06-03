/**
 * 模拟数据测试：calcUnrecommendedZodiacs 合并逻辑（最终版）
 * 模拟真实生产数据格式：v1/v2/v3 都是 [{zodiac,...}] 对象数组
 */
'use strict';

const ZODIAC_ORDER = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪'];
const ZODIAC_EMOJI = {
  '鼠': '🐭', '牛': '🐮', '虎': '🐯', '兔': '🐰',
  '龙': '🐲', '蛇': '🐍', '马': '🐎', '羊': '🐏',
  '猴': '🐒', '鸡': '🐔', '狗': '🐶', '猪': '🐷'
};
function getZodiacEmoji(z) { return ZODIAC_EMOJI[z] || '❓'; }

// ============ 拷贝业务层函数（最终生产版）============
function calcUnrecommendedZodiacs(v1List, v2List, ultimateList) {
  const all = ZODIAC_ORDER;
  const sources = { v1: {}, v2: {}, ultimate: {} };

  function markSource(list, srcKey) {
    if (!list || !list.length) return;
    list.forEach(function(item) {
      const z = typeof item === 'string' ? item : item.zodiac;
      if (z && all.indexOf(z) !== -1) sources[srcKey][z] = true;
    });
  }
  markSource(v1List, 'v1');
  markSource(v2List, 'v2');
  markSource(ultimateList, 'ultimate');

  const allRecommended = [];
  all.forEach(function(z) {
    if (sources.v1[z] || sources.v2[z] || sources.ultimate[z]) {
      allRecommended.push(z);
    }
  });

  const unrecommended = [];
  all.forEach(function(z) {
    if (!sources.v1[z] && !sources.v2[z] && !sources.ultimate[z]) {
      unrecommended.push({ zodiac: z, emoji: getZodiacEmoji(z) });
    }
  });

  return {
    v1: Object.keys(sources.v1),
    v2: Object.keys(sources.v2),
    ultimate: Object.keys(sources.ultimate),
    allRecommended: allRecommended,
    unrecommended: unrecommended
  };
}

// ============ 模拟生产环境真实数据 ============
console.log('========== 场景：浏览器实际显示的推荐数据 ==========\n');

// 模拟 v1 renderPrediction 的数据：[{zodiac, score, ...}]
const v1List = [
  { zodiac: '狗', score: 95 },
  { zodiac: '鼠', score: 90 },
  { zodiac: '龙', score: 85 },
  { zodiac: '羊', score: 80 },
  { zodiac: '猴', score: 75 },
  { zodiac: '牛', score: 70 }
];

// 模拟 v2 renderZoneRecommend 的数据：[{zodiac, zone, count, ...}]
const v2List = [
  { zodiac: '猴', zone: '热号区', count: 3 },
  { zodiac: '兔', zone: '穿插区', count: 1 },
  { zodiac: '蛇', zone: '冷号区', count: 0 },
  { zodiac: '鸡', zone: '热号区', count: 2 },
  { zodiac: '狗', zone: '热号区', count: 2 },
  { zodiac: '鼠', zone: '穿插区', count: 1 }
];

// 模拟终极 renderUltimateAlgorithm 的数据：formatNumbersToDisplay 返回 [{num, zodiac}]
// 主推 4 码 + 备选 1 码
const ultimateList = [
  { num: 1, zodiac: '鼠' },
  { num: 14, zodiac: '兔' },
  { num: 38, zodiac: '狗' },
  { num: 23, zodiac: '马' },
  { num: 7, zodiac: '鸡' }  // 备选
];

const result = calcUnrecommendedZodiacs(v1List, v2List, ultimateList);

console.log('① 终极推荐:', result.ultimate.join(' '));
console.log('② v1 推荐:', result.v1.join(' '));
console.log('③ v2 推荐:', result.v2.join(' '));
console.log('\n合并去重（共 ' + result.allRecommended.length + ' 个）:', result.allRecommended.join(' '));
console.log('\n未推荐生肖（共 ' + result.unrecommended.length + ' 个）:');
result.unrecommended.forEach(item => {
  console.log('  ' + item.emoji + ' ' + item.zodiac);
});

// ============ 断言验证 ============
console.log('\n========== 断言验证 ==========\n');

function assertEqual(actual, expected, label) {
  const actualStr = JSON.stringify(actual.slice().sort());
  const expectedStr = JSON.stringify(expected.slice().sort());
  const pass = actualStr === expectedStr;
  console.log((pass ? '✅' : '❌') + ' ' + label);
  if (!pass) {
    console.log('   期望:', expectedStr);
    console.log('   实际:', actualStr);
  }
  return pass;
}

let allPass = true;

allPass &= assertEqual(result.v1, ['狗', '鼠', '龙', '羊', '猴', '牛'], 'v1 集合');
allPass &= assertEqual(result.v2, ['猴', '兔', '蛇', '鸡', '狗', '鼠'], 'v2 集合');
allPass &= assertEqual(result.ultimate, ['鼠', '兔', '狗', '马', '鸡'], '终极集合');
allPass &= assertEqual(
  result.allRecommended,
  ['鼠', '牛', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗'],
  '合并去重 10 个'
);
allPass &= assertEqual(
  result.unrecommended.map(i => i.zodiac),
  ['虎', '猪'],
  '未推荐生肖（虎+猪）'
);

// ============ 边界测试 ============
console.log('\n========== 边界测试 ==========\n');

// 测试：v1/v2/v3 都是空
const r1 = calcUnrecommendedZodiacs(null, [], undefined);
allPass &= assertEqual(r1.unrecommended.map(i => i.zodiac), ZODIAC_ORDER, '空数据 → 全部未推荐');

// 测试：终极是混合主推+备选
const mixed = [
  { zodiac: '鼠' }, { zodiac: '牛' }, { zodiac: '虎' }
];
const r2 = calcUnrecommendedZodiacs([], [], mixed);
allPass &= assertEqual(r2.ultimate, ['鼠', '牛', '虎'], '混合推荐源');

// 测试：v1 字符串数组、v2 对象数组、v3 对象数组
const r3 = calcUnrecommendedZodiacs(['鼠', '牛'], [{ zodiac: '虎' }], [{ zodiac: '兔' }]);
allPass &= assertEqual(r3.allRecommended, ['鼠', '牛', '虎', '兔'], '混合输入格式');

console.log('\n========== 总结 ==========');
console.log(allPass ? '🎉 所有断言通过，业务层逻辑正确' : '⚠️ 有断言失败');
process.exit(allPass ? 0 : 1);
