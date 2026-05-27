/**
 * 项目优化后功能测试脚本（完整版）
 * 验证所有修复和新增的API是否正常工作
 */

// 模拟浏览器环境
global.document = {
  getElementById: () => null,
  querySelectorAll: () => ({ forEach: () => {} }),
  querySelector: () => null,
  createElement: (tag) => ({
    innerHTML: '',
    style: {},
    classList: { add: () => {}, remove: () => {}, toggle: () => false },
    appendChild: () => {},
    dataset: {}
  })
};

global.window = {
  location: { href: '' },
  addEventListener: () => {},
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval
};

global.console = {
  log: (...args) => process.stdout.write(args.join(' ') + '\n'),
  error: (...args) => process.stderr.write('ERROR: ' + args.join(' ') + '\n'),
  warn: (...args) => process.stdout.write('WARN: ' + args.join(' ') + '\n')
};

let testResults = [];
let passedCount = 0;
let failedCount = 0;

function test(name, fn) {
  try {
    fn();
    testResults.push({ name, status: '✅ PASS', message: '' });
    passedCount++;
    console.log(`✅ ${name}`);
  } catch(e) {
    testResults.push({ name, status: '❌ FAIL', message: e.message });
    failedCount++;
    console.log(`❌ ${name}: ${e.message}`);
  }
}

function assertEqual(actual, expected, msg = '') {
  if(JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${msg}\n期望: ${JSON.stringify(expected)}\n实际: ${JSON.stringify(actual)}`);
  }
}

function assertTrue(condition, msg = '') {
  if(!condition) throw new Error(msg || '条件应为true');
}

function assertFalse(condition, msg = '') {
  if(condition) throw new Error(msg || '条件应为false');
}

console.log('\n========================================');
console.log('🧪 开始功能测试验证');
console.log('========================================\n');

// 使用vm模块的createContext来正确处理作用域
const vm = require('vm');
const fs = require('fs');

// 创建沙箱上下文（使用globalThis）
const sandbox = vm.createContext({
  document: global.document,
  window: global.window,
  console: global.console,
  setTimeout,
  setInterval,
  clearTimeout,
  clearInterval,
  Math,
  JSON,
  Object,
  Array,
  String,
  Number,
  Boolean,
  Date,
  Error,
  Map,
  Set,
  RegExp,
  parseInt,
  parseFloat,
  isNaN,
  isFinite,
  undefined,
  NaN,
  Infinity,
  alert: () => {}
});

// 加载模块到沙箱并获取导出对象
try {
  // 包装代码以捕获全局变量
  const wrapCode = (code, varName) => `
    (function() {
      ${code}
      return typeof ${varName} !== 'undefined' ? ${varName} : null;
    })()
  `;

  const configCode = fs.readFileSync('./core/config.js', 'utf8');
  const CONFIG = vm.runInContext(wrapCode(configCode, 'CONFIG'), sandbox);
  if(CONFIG) global.CONFIG = CONFIG;
  console.log('✅ config.js 加载成功');

  const utilsCode = fs.readFileSync('./core/utils.js', 'utf8');
  const Utils = vm.runInContext(wrapCode(utilsCode, 'Utils'), sandbox);
  if(Utils) global.Utils = Utils;
  console.log('✅ utils.js 加载成功');

  const storageCode = fs.readFileSync('./core/storage.js', 'utf8');
  const Storage = vm.runInContext(wrapCode(storageCode, 'Storage'), sandbox);
  if(Storage) global.Storage = Storage;
  console.log('✅ storage.js 加载成功');

  const stateCode = fs.readFileSync('./core/state.js', 'utf8');
  const StateManager = vm.runInContext(wrapCode(stateCode, 'StateManager'), sandbox);
  if(StateManager) global.StateManager = StateManager;
  console.log('✅ state.js 加载成功');

} catch(e) {
  console.error('❌ 模块加载失败:', e.message);
  console.error(e.stack);
  process.exit(1);
}

// 从全局获取对象
const Utils = global.Utils;
const StateManager = global.StateManager;
const CONFIG = global.CONFIG;

if(!Utils || !StateManager) {
  console.error('❌ 关键模块加载失败');
  process.exit(1);
}

console.log('\n📦 模块加载完成\n');
console.log('Utils 对象属性:', Object.keys(Utils).join(', '));
console.log('StateManager 对象属性:', Object.keys(StateManager).join(', '));

// ==================== 测试1: Utils.TimerManager ====================
console.log('\n--- 测试1: TimerManager 统一定时器管理 ---\n');

test('1.1 TimerManager.setTimeout 创建定时器', () => {
  let executed = false;
  Utils.TimerManager.setTimeout('test1', () => { executed = true; }, 100);
  const stats = Utils.TimerManager.getStats();
  assertEqual(stats.timeouts, 1, '应有1个活跃timeout');
});

test('1.2 TimerManager.clearTimeout 清除定时器', () => {
  Utils.TimerManager.clearTimeout('test1');
  const stats = Utils.TimerManager.getStats();
  assertEqual(stats.timeouts, 0, '应清除后为0');
});

test('1.3 TimerManager.setInterval 创建循环定时器', () => {
  let count = 0;
  Utils.TimerManager.setInterval('interval1', () => count++, 100);
  const stats = Utils.TimerManager.getStats();
  assertEqual(stats.intervals, 1, '应有1个活跃interval');
  Utils.TimerManager.clearInterval('interval1'); // 清理
});

test('1.4 TimerManager.clearAll 清除所有定时器', () => {
  Utils.TimerManager.setTimeout('a', () => {}, 99999);
  Utils.TimerManager.setInterval('b', () => {}, 99999);
  Utils.TimerManager.setInterval('c', () => {}, 99999);

  Utils.TimerManager.clearAll();

  const stats = Utils.TimerManager.getStats();
  assertEqual(stats.timeouts, 0, 'timeouts应全部清除');
  assertEqual(stats.intervals, 0, 'intervals应全部清除');
});

// ==================== 测试2: Utils.Validator 数据验证 ====================
console.log('\n--- 测试2: Validator 数据验证工具 ---\n');

test('2.1 validateNumber 有效号码', () => {
  const result = Utils.Validator.validateNumber(25);
  assertTrue(result.valid, '应验证通过');
  assertEqual(result.value, 25, '值应为25');
});

test('2.2 validateNumber 无效号码(非数字)', () => {
  const result = Utils.Validator.validateNumber('abc');
  assertFalse(result.valid, '应验证失败');
});

test('2.3 validateNumber 超出范围', () => {
  const result = Utils.Validator.validateNumber(50);
  assertFalse(result.valid, '超出范围应失败');
  assertTrue(result.error.includes('1-49'), '错误信息应包含范围提示');
});

test('2.4 validateHistoryData 有效数据', () => {
  const data = [
    { expect: '2024001', openCode: '1,2,3,4,5,6,7' },
    { expect: '2024002', openCode: '8,9,10,11,12,13,14' }
  ];
  const result = Utils.Validator.validateHistoryData(data);
  assertTrue(result.valid, '有效数据应通过');
  assertEqual(result.data.length, 2, '应返回2条有效记录');
});

test('2.5 validateHistoryData 空数组', () => {
  const result = Utils.Validator.validateHistoryData([]);
  assertFalse(result.valid, '空数组应失败');
});

test('2.6 validateHistoryData 非数组输入', () => {
  const result = Utils.Validator.validateHistoryData(null);
  assertFalse(result.valid, 'null应失败');
  assertTrue(result.error.includes('数组'), '错误应提到数组');
});

test('2.7 safeExecute 正常执行', () => {
  const result = Utils.Validator.safeExecute((x) => x * 2, 5, '测试乘法');
  assertTrue(result.success, '应执行成功');
  assertEqual(result.result, 10, '结果应为10');
});

test('2.8 safeExecute 异常捕获', () => {
  const result = Utils.Validator.safeExecute(() => { throw new Error('测试异常'); }, null, '测试异常');
  assertFalse(result.success, '应捕获异常');
  assertTrue(result.error instanceof Error, '应返回Error对象');
});

// ==================== 测试3: Utils.SpecialCalculator 特码计算 ====================
console.log('\n--- 测试3: SpecialCalculator 特码计算器 ---\n');

test('3.1 getSpecial 完整数据项', () => {
  const item = {
    expect: '2024001',
    openCode: '1,2,3,4,5,6,49',
    zodiac: '鼠,牛,虎,兔,龙,蛇,马'
  };
  const special = Utils.SpecialCalculator.getSpecial(item);

  assertEqual(special.te, 49, '特码应为49');
  assertEqual(special.tail, 9, '尾数应为9');
  assertEqual(special.head, 4, '头数应为4');
  assertEqual(special.zod, '马', '生肖应为马');
  assertTrue(special.big, '49应为大号');
  assertFalse(special.odd, '49应为偶数');
});

test('3.2 getSpecial 空数据处理', () => {
  const special = Utils.SpecialCalculator.getSpecial(null);
  assertEqual(special.te, 0, '空数据特码应为0');
  assertEqual(special.zod, '-', '空数据生肖应为-');
});

test('3.3 batchGetSpecial 批量处理', () => {
  const items = [
    { openCode: '1,2,3,4,5,6,7', zodiac: ',,,,,,,' },
    { openCode: '11,22,33,44,55,66,77', zodiac: ',,,,,,,' }
  ];
  const results = Utils.SpecialCalculator.batchGetSpecial(items);
  assertEqual(results.length, 2, '应返回2条结果');
  assertEqual(results[0].te, 7, '第一条特码应为7');
});

// ==================== 测试4: StateManager 性能优化 ====================
console.log('\n--- 测试4: StateManager setState性能优化 ---\n');

test('4.1 setState 基本更新', () => {
  StateManager.setState({ testField: 'value' }, false); // 不渲染

  const newState = StateManager.getState();
  assertEqual(newState.testField, 'value', '字段应被更新');
});

test('4.2 flushRender 强制渲染', () => {
  // 设置渲染队列
  StateManager._renderQueue = [Date.now()];
  StateManager._renderTimer = setTimeout(() => {}, 9999);

  StateManager.flushRender();

  assertTrue(StateManager._renderQueue === null, '队列应清空');
  assertTrue(StateManager._renderTimer === null, '定时器应清除');
});

test('4.3 selectGroup 接收参数模式(新路径)', () => {
  StateManager.resetGroup('zodiac');
  const allValues = ['鼠', '牛', '虎'];
  StateManager.selectGroup('zodiac', allValues);

  const state = StateManager.getState();
  assertEqual(state.selected.zodiac.length, 3, '应选中3个值');
});

test('4.4 invertGroup 反选功能', () => {
  StateManager.resetGroup('num');
  StateManager.toggleTag('num', '1');
  StateManager.toggleTag('num', '2');

  const allValues = ['1', '2', '3'];
  StateManager.invertGroup('num', allValues);

  const state = StateManager.getState();
  assertTrue(state.selected.num.includes('3'), '反选后应包含未选中的3');
  assertFalse(state.selected.num.includes('1'), '反选后不应包含已选中的1');
});

// ==================== 测试5: 向后兼容性测试 ====================
console.log('\n--- 测试5: 向后兼容性测试 ---\n');

test('5.1 selectGroup 无参数降级路径', () => {
  try {
    StateManager.selectGroup('wave'); // 不传参数，使用降级路径
    assertTrue(true, '降级路径不应抛出异常');
  } catch(e) {
    throw new Error(`降级路径失败: ${e.message}`);
  }
});

test('5.2 invertGroup 无参数降级路径', () => {
  try {
    StateManager.invertGroup('head'); // 不传参数，使用降级路径
    assertTrue(true, '降级路径不应抛出异常');
  } catch(e) {
    throw new Error(`降级路径失败: ${e.message}`);
  }
});

// ==================== 测试6: 工具函数完整性 ====================
console.log('\n--- 测试6: 其他工具函数 ---\n');

test('6.1 debounce 防抖函数', () => {
  let callCount = 0;
  const debounced = Utils.debounce(() => callCount++, 50);

  debounced();
  debounced();
  debounced(); // 快速调用3次

  // 由于防抖，callCount应该还是0（在50ms内）
  assertEqual(callCount, 0, '防抖期间不应立即执行');
});

test('6.2 throttle 节流函数', () => {
  let callCount = 0;
  const throttled = Utils.throttle(() => callCount++, 100);

  throttled();
  throttled();
  throttled(); // 快速调用3次

  // 节流应至少执行1次
  assertTrue(callCount >= 1, '节流应至少执行1次');
});

test('6.3 deepClone 深拷贝', () => {
  const original = { a: 1, b: { c: [1, 2, 3] } };
  const cloned = Utils.deepClone(original);

  cloned.b.c.push(4);
  assertEqual(original.b.c.length, 3, '原对象不应受影响');
  assertEqual(cloned.b.c.length, 4, '克隆对象应可独立修改');
});

test('6.4 takeFirst 取前N个元素', () => {
  const arr = [1, 2, 3, 4, 5];
  const result = Utils.takeFirst(arr, 3);
  assertEqual(result.length, 3, '应返回3个元素');
  assertEqual(result[0], 1, '第一个元素应为1');
});

// ==================== 输出测试报告 ====================
console.log('\n========================================');
console.log('📊 测试结果汇总');
console.log('========================================\n');

console.log(`总测试数: ${passedCount + failedCount}`);
console.log(`✅ 通过: ${passedCount}`);
console.log(`❌ 失败: ${failedCount}`);
console.log(`通过率: ${((passedCount / (passedCount + failedCount)) * 100).toFixed(1)}%`);

if(failedCount > 0) {
  console.log('\n❌ 失败的测试:');
  testResults.filter(r => r.status === '❌ FAIL').forEach(r => {
    console.log(`  - ${r.name}: ${r.message}`);
  });
} else {
  console.log('\n🎉 所有测试通过！项目优化成功！');
}

console.log('\n========================================\n');

process.exit(failedCount > 0 ? 1 : 0);
