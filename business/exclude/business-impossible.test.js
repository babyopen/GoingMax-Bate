/**
 * 单元测试套件：business-impossible.js（v2.4.0 新增）
 *
 * 运行方式：在项目根目录执行 `node business/exclude/business-impossible.test.js`
 * 覆盖范围：
 *   1. _expDecayScore 半衰期语义（边界值 + 关键中间值）
 *   2. _calcReverseSignal 数字键比较（head/tail=0..9 兼容性）
 *   3. _calcReverseSignal 冷号回暖减分（下限保护）
 *   4. calculateBacktrack 数据不足保护
 *   5. calculateBacktrack 最新一期一定被包含（v2.1.1 修复回归）
 *   6. calculate 边界条件
 *
 * 说明：测试通过 mock SpecialCalculator 简化依赖
 */

'use strict';

const assert = require('assert');

// ============================================
// Mock 依赖
// ============================================

// 简化的 SpecialCalculator mock
const SPECIALS_BY_ZODIAC = {
  鼠: { te: 7,  tail: 7,  head: 0, colorName: '红', zod: '鼠', odd: true,  big: false, wuxing: '金' },
  牛: { te: 14, tail: 4,  head: 1, colorName: '蓝', zod: '牛', odd: false, big: false, wuxing: '木' },
  虎: { te: 28, tail: 8,  head: 2, colorName: '绿', zod: '虎', odd: false, big: true,  wuxing: '土' },
  兔: { te: 40, tail: 0,  head: 4, colorName: '红', zod: '兔', odd: false, big: true,  wuxing: '木' },
  龙: { te: 39, tail: 9,  head: 3, colorName: '蓝', zod: '龙', odd: true,  big: true,  wuxing: '土' },
  蛇: { te: 26, tail: 6,  head: 2, colorName: '绿', zod: '蛇', odd: false, big: true,  wuxing: '火' },
  马: { te: 25, tail: 5,  head: 2, colorName: '蓝', zod: '马', odd: true,  big: true,  wuxing: '火' },
  羊: { te: 11, tail: 1,  head: 1, colorName: '绿', zod: '羊', odd: true,  big: false, wuxing: '火' },
  猴: { te: 33, tail: 3,  head: 3, colorName: '绿', zod: '猴', odd: true,  big: true,  wuxing: '金' },
  鸡: { te: 21, tail: 1,  head: 2, colorName: '绿', zod: '鸡', odd: true,  big: false, wuxing: '金' },
  狗: { te: 9,  tail: 9,  head: 0, colorName: '蓝', zod: '狗', odd: true,  big: false, wuxing: '土' },
  猪: { te: 32, tail: 2,  head: 3, colorName: '绿', zod: '猪', odd: false, big: true,  wuxing: '水' }
};

global.Utils = {
  SpecialCalculator: {
    getSpecial: function(item) {
      if (!item) return null;
      // 简单 mock：根据 openCode 第 7 位决定生肖
      const code = (item.openCode || '0,0,0,0,0,0,0').split(',');
      const te = Number(code[6]);
      const zod = item.zodiac ? item.zodiac.split(',')[6] : null;
      if (zod && SPECIALS_BY_ZODIAC[zod]) {
        return Object.assign({}, SPECIALS_BY_ZODIAC[zod], { te });
      }
      // 默认返回基于 te 计算的特殊字段
      const colorMap = { 0: '红', 1: '红', 2: '蓝', 3: '蓝', 4: '绿', 5: '绿', 6: '红', 7: '红', 8: '蓝', 9: '蓝' };
      const wxMap = ['金', '木', '水', '火', '土'];
      return {
        te: te,
        tail: te % 10,
        head: Math.floor(te / 10),
        colorName: colorMap[te % 10] || '红',
        zod: zod || '-',
        odd: te % 2 === 1,
        big: te >= 25,
        wuxing: wxMap[Math.floor(te / 10)] || '金'
      };
    },
    batchGetSpecial: function(items) {
      return items.map(item => this.getSpecial(item));
    },
    clearCache: function() {}
  },
  formatNum: function(n) { return n < 10 ? '0' + n : '' + n; }
};

// 加载被测试模块（直接 eval 到全局，业务层代码顶层 const 暴露到 globalThis）
const fs = require('fs');
const path = require('path');

// v2.5.0 新增：BusinessCommonSpecials mock（被 business-impossible.js 依赖）
global.BusinessCommonSpecials = {
  _windowCache: null,
  buildWindowed: function(historyData) {
    const cache = global.BusinessCommonSpecials._windowCache;
    if (cache && cache.data === historyData) {
      return cache.specials;
    }
    const specials = global.Utils.SpecialCalculator.batchGetSpecial(historyData);
    global.BusinessCommonSpecials._windowCache = {
      data: historyData,
      specials: specials
    };
    return specials;
  },
  peekWindowed: function() {
    const cache = global.BusinessCommonSpecials._windowCache;
    return cache ? cache.specials : null;
  },
  clearWindowCache: function() {
    global.BusinessCommonSpecials._windowCache = null;
  }
};

const code = fs.readFileSync(path.join(__dirname, 'business-impossible.js'), 'utf8');
// 业务层使用 const 在脚本作用域，浏览器中 const 不挂到 window；但 vm 脚本中 const 不会暴露
// 解决方法：用 Function 包装并返回所需对象
const wrapper = new Function(
  'Utils',
  code + '\nreturn typeof BusinessImpossible !== "undefined" ? BusinessImpossible : null;'
);
const BizImpossible = wrapper(global.Utils);

if (!BizImpossible) {
  console.error('无法加载 BusinessImpossible 模块');
  process.exit(1);
}
// 替换直接引用
global.BusinessImpossible = BizImpossible;

// ============================================
// 测试辅助
// ============================================

let passCount = 0;
let failCount = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passCount++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failCount++;
    failures.push({ name, err });
    console.log('  ✗ ' + name);
    console.log('    ' + err.message);
  }
}

function describe(suite, fn) {
  console.log('\n' + suite);
  fn();
}

// ============================================
// 测试用例
// ============================================

describe('1. _expDecayScore 半衰期语义（v2.4.0 关键修复）', () => {
  test('miss=0 → 0', () => {
    assert.strictEqual(BusinessImpossible._expDecayScore(0), 0);
  });

  test('miss<0 → 0（防御）', () => {
    assert.strictEqual(BusinessImpossible._expDecayScore(-1), 0);
    assert.strictEqual(BusinessImpossible._expDecayScore(-100), 0);
  });

  test('miss=8 → 接近 63（半衰期=8）', () => {
    const score = BusinessImpossible._expDecayScore(8);
    assert.ok(score >= 62 && score <= 64, 'expected 62~64, got ' + score);
  });

  test('miss=16 → 接近 86（2 个半衰期）', () => {
    const score = BusinessImpossible._expDecayScore(16);
    assert.ok(score >= 85 && score <= 88, 'expected 85~88, got ' + score);
  });

  test('miss=24 → 接近 95（3 个半衰期）', () => {
    const score = BusinessImpossible._expDecayScore(24);
    assert.ok(score >= 94 && score <= 96, 'expected 94~96, got ' + score);
  });

  test('miss 越大 → score 越大（单调性）', () => {
    const a = BusinessImpossible._expDecayScore(4);
    const b = BusinessImpossible._expDecayScore(8);
    const c = BusinessImpossible._expDecayScore(12);
    assert.ok(a < b && b < c, 'expected a<b<c, got ' + a + '<' + b + '<' + c);
  });

  test('score 上限 = 100', () => {
    assert.strictEqual(BusinessImpossible._expDecayScore(1000), 100);
    assert.strictEqual(BusinessImpossible._expDecayScore(99999), 100);
  });
});

describe('2. _calcReverseSignal 数字键兼容（v2.4.0 关键修复）', () => {
  test('跳过连出项 latest=3（数字键）', () => {
    const specials = [
      { head: 3 }, { head: 3 }, { head: 3 },
      { head: 0 }, { head: 1 }, { head: 5 }, { head: 7 }
    ];
    const out = BusinessImpossible._calcReverseSignal(specials, 'head');
    assert.strictEqual(out._streakKey, 3);
    // 数字键 3 直接赋值（不通过 Object.keys 路径）
    assert.strictEqual(out[3], 75, '3 连出应得 75 分（3*25）');
    // 数字 3 也会作为 Object.keys 的 key（'3'）返回，所以不应是 undefined
    assert.strictEqual(out['3'], 75, '字符串键 3 也应有值');
  });

  test('回暖减分应用到字符串键（数字键 0-9）', () => {
    // specials[0]=1 (recent), specials[1]=1, specials[2..]=其他
    const specials = [
      { head: 1 }, { head: 2 }, { head: 3 }, { head: 4 },
      { head: 5 }, { head: 6 }, { head: 7 }, { head: 8 },
      { head: 9 }, { head: 0 }, { head: 1 }, { head: 2 }
    ];
    const out = BusinessImpossible._calcReverseSignal(specials, 'head');
    // 数字键 '0' / '1' / '2' 至少有一个应有非零减分
    const hasWarmDecay = Object.keys(out).some(k => k !== '_streakKey' && out[k] < 0);
    assert.ok(hasWarmDecay, '数字键应该有回暖减分，got ' + JSON.stringify(out));
  });

  test('生肖（字符串键）正常工作', () => {
    const specials = [
      { zod: '鼠' }, { zod: '鼠' }, { zod: '鼠' },
      { zod: '牛' }, { zod: '虎' }, { zod: '兔' }
    ];
    const out = BusinessImpossible._calcReverseSignal(specials, 'zod');
    assert.strictEqual(out._streakKey, '鼠');
    assert.strictEqual(out['鼠'], 75);
  });
});

describe('3. _calcReverseSignal 减分下限保护（v2.4.0 修复）', () => {
  test('多个回暖信号叠加不超过 -100', () => {
    // 模拟一个值在近期反复出现
    const specials = [];
    for (let i = 0; i < 6; i++) specials.push({ zod: '牛' });
    for (let i = 0; i < 12; i++) specials.push({ zod: '鼠' });
    const out = BusinessImpossible._calcReverseSignal(specials, 'zod');
    Object.keys(out).forEach(k => {
      if (k !== '_streakKey') {
        assert.ok(out[k] >= -100, 'key ' + k + ' score ' + out[k] + ' 应该 >= -100');
      }
    });
  });
});

describe('4. calculateBacktrack 数据不足保护', () => {
  test('historyData 为空返回空数组', () => {
    assert.deepStrictEqual(BusinessImpossible.calculateBacktrack([], 10), []);
    assert.deepStrictEqual(BusinessImpossible.calculateBacktrack(null, 10), []);
    assert.deepStrictEqual(BusinessImpossible.calculateBacktrack(undefined, 10), []);
  });

  test('n < 25 返回空数组', () => {
    const data = Array(20).fill({ expect: '1', openCode: '1,2,3,4,5,6,7', zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' });
    assert.deepStrictEqual(BusinessImpossible.calculateBacktrack(data, 10), []);
  });

  test('n >= 25 返回 limit 条', () => {
    const data = Array(30).fill(0).map((_, i) => ({
      expect: String(1000 - i),
      openCode: '1,2,3,4,5,6,' + (i % 10),
      zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
    }));
    const rows = BusinessImpossible.calculateBacktrack(data, 5);
    assert.strictEqual(rows.length, 5);
  });

  test('limit 超出会被截断', () => {
    const data = Array(50).fill(0).map((_, i) => ({
      expect: String(1000 - i),
      openCode: '1,2,3,4,5,6,7',
      zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
    }));
    const rows = BusinessImpossible.calculateBacktrack(data, 36);
    assert.strictEqual(rows.length, 26, 'n=50, W=24 → 最多 26 期');
  });
});

describe('5. calculateBacktrack 最新一期回归（v2.1.1 修复）', () => {
  test('rows[0].expect 应该是最新一期（不含被预测期本身）', () => {
    const data = Array(30).fill(0).map((_, i) => ({
      expect: String(1000 + i),  // 1000, 1001, ..., 1029（最新）
      openCode: '1,2,3,4,5,6,7',
      zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
    }));
    // 最新一期是 data[0].expect = 1000
    const rows = BusinessImpossible.calculateBacktrack(data, 5);
    assert.ok(rows.length > 0, 'rows 不应为空');
    assert.strictEqual(rows[0].expect, '1000', 'rows[0] 应该是 data[0]（最新期）');
    assert.strictEqual(rows[0].actualExpect, '1000');
  });
});

describe('6. calculate 边界条件', () => {
  test('historyData 为空返回 null', () => {
    assert.strictEqual(BusinessImpossible.calculate([], [], {}), null);
    assert.strictEqual(BusinessImpossible.calculate(null, null, {}), null);
  });

  test('window 强制最小值 6', () => {
    // window=2 会被强制为 6，实际窗口大小取 min(windowSize, historyData.length)
    const data = Array(10).fill({ expect: '1', openCode: '1,2,3,4,5,6,7', zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' });
    const result = BusinessImpossible.calculate(data, [], { window: 2 });
    assert.ok(result !== null);
    assert.strictEqual(result.windowSize, 6, 'windowSize 应为强制后的最小值 6');
  });

  test('数据不足 6 期返回 null', () => {
    const data = Array(3).fill({ expect: '1', openCode: '1,2,3,4,5,6,7' });
    assert.strictEqual(BusinessImpossible.calculate(data, [], {}), null);
  });

  test('返回 nextExpect = historyData[0].expect + 1', () => {
    // 注意：calculate 至少需要 6 期数据
    const data = [
      { expect: '2026202', openCode: '1,2,3,4,5,6,7', zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' },
      { expect: '2026201', openCode: '1,2,3,4,5,6,8', zodiac: '牛,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' },
      { expect: '2026200', openCode: '1,2,3,4,5,6,9', zodiac: '虎,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' },
      { expect: '2026199', openCode: '1,2,3,4,5,6,1', zodiac: '兔,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' },
      { expect: '2026198', openCode: '1,2,3,4,5,6,2', zodiac: '龙,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' },
      { expect: '2026197', openCode: '1,2,3,4,5,6,3', zodiac: '蛇,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪' }
    ];
    const result = BusinessImpossible.calculate(data, [], {});
    assert.ok(result, 'result 应非空');
    assert.strictEqual(result.nextExpect, 2026203);
  });

  test('返回结果含 5 个维度的 top', () => {
    const data = Array(30).fill({ expect: '1', openCode: '1,2,3,4,5,6,7' });
    const result = BusinessImpossible.calculate(data, [], {});
    ['zodiac', 'color', 'head', 'tail', 'wuxing'].forEach(k => {
      assert.ok(result[k], '缺少维度 ' + k);
      assert.ok(result[k].top, '维度 ' + k + ' 缺少 top');
      assert.ok(typeof result[k].top.name !== 'undefined', '维度 ' + k + ' top.name 缺失');
      assert.ok(typeof result[k].top.score === 'number', '维度 ' + k + ' top.score 应为数字');
    });
  });
});

describe('7. calculateBacktrack 缓存命中（v2.5.0 优化）', () => {
  test('相同 historyData 多次调用，结果应一致', () => {
    const data = Array(30).fill(0).map((_, i) => ({
      expect: String(1000 + i),
      openCode: '1,2,3,4,5,6,7',
      zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
    }));
    const r1 = BusinessImpossible.calculateBacktrack(data, 5);
    const r2 = BusinessImpossible.calculateBacktrack(data, 5);
    assert.deepStrictEqual(r1, r2, '相同输入应返回相同结果');
  });

  test('窗口缓存命中（同一次调用内）', () => {
    const data = Array(40).fill(0).map((_, i) => ({
      expect: String(1000 + i),
      openCode: '1,2,3,4,5,6,7',
      zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
    }));
    // 重置缓存
    BusinessCommonSpecials.clearWindowCache();
    const r1 = BusinessImpossible.calculateBacktrack(data, 10);
    // 第二次调用应命中缓存
    const cacheAfter1 = BusinessCommonSpecials.peekWindowed();
    assert.ok(cacheAfter1, '缓存应该被填充');
    // 再次调用验证结果一致
    const r2 = BusinessImpossible.calculateBacktrack(data, 10);
    assert.deepStrictEqual(r1, r2, '相同 data 应返回相同结果');

    // 验证缓存引用（通过 peekWindowed 获取）
    const cacheAfter2 = BusinessCommonSpecials.peekWindowed();
    assert.ok(cacheAfter2, '缓存应仍存在');
  });

  test('不同 historyData 引用触发缓存失效', () => {
    const data1 = Array(30).fill(0).map((_, i) => ({
      expect: String(1000 + i),
      openCode: '1,2,3,4,5,6,7',
      zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
    }));
    const data2 = data1.slice(); // 不同引用，内容相同
    BusinessCommonSpecials.clearWindowCache();
    BusinessImpossible.calculateBacktrack(data1, 5);
    assert.ok(BusinessCommonSpecials.peekWindowed(), 'calculateBacktrack 后缓存应被填充');
    assert.strictEqual(BusinessCommonSpecials._windowCache.data, data1, 'data1 应被缓存');

    BusinessImpossible.calculateBacktrack(data2, 5);
    // 应该重建缓存（data1 !== data2）
    assert.strictEqual(BusinessCommonSpecials._windowCache.data, data2, '引用变化应触发缓存重建');
  });

  test('clearWindowCache 主动清空', () => {
    const data = Array(30).fill(0).map((_, i) => ({
      expect: String(1000 + i),
      openCode: '1,2,3,4,5,6,7',
      zodiac: '鼠,牛,虎,兔,龙,蛇,马,羊,猴,鸡,狗,猪'
    }));
    BusinessImpossible.calculateBacktrack(data, 5);
    assert.ok(BusinessCommonSpecials.peekWindowed(), '缓存应有值');
    BusinessCommonSpecials.clearWindowCache();
    assert.strictEqual(BusinessCommonSpecials.peekWindowed(), null, '应清空');
  });
});

// ============================================
// 报告
// ============================================

console.log('\n' + '='.repeat(60));
console.log('测试报告：' + passCount + ' 通过 / ' + failCount + ' 失败');
if (failCount > 0) {
  console.log('\n失败详情：');
  failures.forEach(function(f) {
    console.log('  - ' + f.name + ': ' + f.err.message);
  });
  process.exit(1);
} else {
  console.log('全部通过 ✓');
  process.exit(0);
}