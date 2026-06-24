# 视图层 Giong 通用渲染工具（view-common-giong.js）

> 新增日期：2026-06-24
> 拆分自：4 个 giong 子标签页视图文件（大小 / 单双 / 五行 / 波色）
> 抽取层级：视图层（views/），不涉及业务计算

## 一、抽取背景

`views/zodiac/` 目录下 4 个 giong 子标签页视图文件 95% 结构重复：

| 原文件 | 大小行数 | 替代方案 |
|---|---|---|
| `view-zodiac-giong-size.js` | ~145 | wrapper + `ViewCommonGiong.renderLatestBinaryStats` |
| `view-zodiac-giong-oddeven.js` | ~145 | wrapper + `ViewCommonGiong.renderLatestBinaryStats` |
| `view-zodiac-giong-wuxing.js` | ~138 | wrapper + `ViewCommonGiong.renderLatestMultiStats` |
| `view-zodiac-giong-color.js` | ~135 | wrapper + `ViewCommonGiong.renderLatestMultiStats` |

**4 个文件中 12 个函数**抽取为 **3 个通用方法**：
- `renderLatestBinaryStats`（替代 2 个二分类大面板渲染）
- `renderLatestMultiStats`（替代 2 个多分类大面板渲染）
- `showAnalysisBacktestModal`（替代 4 个回测弹窗）

---

## 二、API 清单

[views/view-common-giong.js](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/views/view-common-giong.js) 暴露 `ViewCommonGiong` 全局对象，包含 3 个方法：

| # | 方法 | 替代原函数 | 用途 |
|---|---|---|---|
| 1 | `renderLatestBinaryStats(data, config)` | `renderLatestSizeStats` / `renderLatestOddEvenStats` | 二分类大面板 |
| 2 | `renderLatestMultiStats(data, config)` | `renderLatestWuxingStats` / `renderLatestColorStats` | 多分类大面板 |
| 3 | `showAnalysisBacktestModal(backtestData, config)` | 4 个 `show*BacktestModal` | 回测追踪弹窗 |

---

## 三、配置项（config）设计

### 3.1 二分类 config

```js
{
  containerId:       'latestSizeStatsPanel',  // 容器 ID
  classPrefix:       'size',                  // CSS class 前缀
  title:             '大小分析',              // 标题
  dataKey:           'size',                  // 序列字段名
  labelA:            '大',                    // 类别 A
  labelB:            '小',                    // 类别 B
  cssClassA:         'size-big',              // 序列项 class A
  cssClassB:         'size-small',            // 序列项 class B
  statClassA:        'size-stat-big',         // 统计项 class A
  statClassB:        'size-stat-small',       // 统计项 class B
  statLabelA:        '大 (25-49)',            // 统计标签 A
  statLabelB:        '小 (1-24)',             // 统计标签 B
  patternStreakClass: 'pattern-streak',       // 规律"连出"标签 class
  patternAltClass:    'pattern-alternate',    // 规律"交替"标签 class
  trendAction:       'showSizeBacktest',      // data-action
  trendClassA:       'trend-big',             // 趋势结果 class A
  trendClassB:       'trend-small',           // 趋势结果 class B
  countKeyA:         'bigCount',              // 计数键 A
  countKeyB:         'smallCount',            // 计数键 B
  percentKeyA:       'bigPercent',            // 百分比键 A
  percentKeyB:       'smallPercent'           // 百分比键 B
}
```

### 3.2 多分类 config

```js
{
  containerId:    'latestWuxingStatsPanel',
  classPrefix:    'wuxing',
  title:          '五行分析',
  dataKey:        'wuxing',
  categories:     ['金', '木', '水', '火', '土'],
  colors: {
    '金': { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', text: '#B8860B', light: 'rgba(255,215,0,0.12)' },
    '木': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D', light: 'rgba(34,197,94,0.12)' },
    '水': { bg: 'linear-gradient(135deg, #0EA5E9, #06B6D4)', text: '#0369A1', light: 'rgba(14,165,233,0.12)' },
    '火': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C', light: 'rgba(239,68,68,0.12)' },
    '土': { bg: 'linear-gradient(135deg, #A78BFA, #8B5CF6)', text: '#7C3AED', light: 'rgba(167,139,250,0.12)' }
  },
  trendAction:   'showWuxingBacktest',
  fallbackColor: null  // 可选，缺省时取 categories[0] 的颜色
}
```

### 3.3 回测弹窗 config

```js
{
  modalId:         'sizeBacktestModal',
  title:           '📊 大小回测追踪',
  closeBtnId:      'closeSizeBacktestBtn',
  highlightColor:  '#30D158',
  predictedKey:    'predictedSize',     // 明细中预测值字段
  actualKey:       'actualSize',        // 明细中实际值字段
  algorithmName:   '大小趋势预测算法',   // 用于 footerNote
  backtestType:    '大小'               // 可选
}
```

---

## 四、Wrapper 示例

### 4.1 view-zodiac-giong-size.js（改造后 ~30 行）

```js
const ViewZodiacGiongSize = {
  renderLatestSizeStats: function(data) {
    ViewCommonGiong.renderLatestBinaryStats(data, {
      containerId: 'latestSizeStatsPanel',
      classPrefix: 'size',
      title: '大小分析',
      dataKey: 'size',
      labelA: '大', labelB: '小',
      cssClassA: 'size-big', cssClassB: 'size-small',
      statClassA: 'size-stat-big', statClassB: 'size-stat-small',
      statLabelA: '大 (25-49)', statLabelB: '小 (1-24)',
      patternStreakClass: 'pattern-streak',
      patternAltClass: 'pattern-alternate',
      trendAction: 'showSizeBacktest',
      trendClassA: 'trend-big', trendClassB: 'trend-small',
      countKeyA: 'bigCount', countKeyB: 'smallCount',
      percentKeyA: 'bigPercent', percentKeyB: 'smallPercent'
    });
  },
  
  showSizeBacktestModal: function(backtestData) {
    ViewCommonGiong.showAnalysisBacktestModal(backtestData, {
      modalId: 'sizeBacktestModal',
      title: '📊 大小回测追踪',
      closeBtnId: 'closeSizeBacktestBtn',
      highlightColor: '#30D158',
      predictedKey: 'predictedSize',
      actualKey: 'actualSize',
      algorithmName: '大小趋势预测算法',
      backtestType: '大小'
    });
  },
  
  _renderSizeContent: function(sizeData) {
    if (!sizeData) return '<div style="padding:20px;text-align:center;color:var(--sub-text);">暂无数据</div>';
    return ViewCommon.renderCombinedAnalysisContent({
      sequence: sizeData.sequence,
      typePrefix: 'sz',
      valueKey: 'size',
      colors: { '大': '#FF6B6B', '小': '#4ECDC4' },
      stats: { '大': sizeData.bigCount, '小': sizeData.smallCount },
      total: sizeData.period,
      patterns: sizeData.patterns,
      trend: sizeData.trend,
      trendAction: 'showSizeBacktest'
    });
  }
};
```

### 4.2 view-zodiac-giong-wuxing.js（改造后 ~35 行）

```js
const ViewZodiacGiongWuxing = {
  renderLatestWuxingStats: function(data) {
    ViewCommonGiong.renderLatestMultiStats(data, {
      containerId: 'latestWuxingStatsPanel',
      classPrefix: 'wuxing',
      title: '五行分析',
      dataKey: 'wuxing',
      categories: ['金', '木', '水', '火', '土'],
      colors: {
        '金': { bg: 'linear-gradient(135deg, #FFD700, #FFA500)', text: '#B8860B' },
        '木': { bg: 'linear-gradient(135deg, #22C55E, #16A34A)', text: '#15803D' },
        '水': { bg: 'linear-gradient(135deg, #0EA5E9, #06B6D4)', text: '#0369A1' },
        '火': { bg: 'linear-gradient(135deg, #EF4444, #DC2626)', text: '#B91C1C' },
        '土': { bg: 'linear-gradient(135deg, #A78BFA, #8B5CF6)', text: '#7C3AED' }
      },
      trendAction: 'showWuxingBacktest'
    });
  },
  
  showWuxingBacktestModal: function(backtestData) {
    ViewCommonGiong.showAnalysisBacktestModal(backtestData, {
      modalId: 'wuxingBacktestModal',
      title: '📊 五行回测追踪',
      closeBtnId: 'closeWuxingBacktestBtn',
      highlightColor: '#A78BFA',
      predictedKey: 'predictedWuxing',
      actualKey: 'actualWuxing',
      algorithmName: '五行趋势预测算法',
      backtestType: '五行'
    });
  },
  
  _renderWuxingContent: function(wuxingData) {
    return ViewCommon.renderCombinedAnalysisContent({
      sequence: wuxingData && wuxingData.sequence ? wuxingData.sequence : [],
      typePrefix: 'wx',
      valueKey: 'wuxing',
      colors: { '金': '#FFD700', '木': '#22C55E', '水': '#0EA5E9', '火': '#EF4444', '土': '#A78BFA' },
      stats: wuxingData ? wuxingData.count : null,
      total: wuxingData ? wuxingData.period : 0,
      patterns: wuxingData && wuxingData.patterns ? wuxingData.patterns : [],
      trend: wuxingData && wuxingData.trend ? wuxingData.trend : null,
      trendAction: 'showWuxingBacktest'
    });
  }
};
```

---

## 五、与原文件的差异

按"只能新增"原则，**原文件保留不变**。通用方法与原方法在以下方面：

| 维度 | 状态 |
|---|---|
| 渲染 HTML 结构 | ✅ 100% 一致 |
| data-action 触发 | ✅ 100% 一致（保持原有 action 名） |
| CSS class 命名 | ✅ 100% 一致（保持 classPrefix 模式） |
| 文案 | ✅ 100% 一致 |
| 弹窗 ID / 关闭按钮 | ✅ 100% 一致 |

**唯一改动**：4 个原文件中 130+ 行重复代码 → wrapper 调用通用函数，每个文件从 ~140 行缩减到 ~30 行。

---

## 六、与业务层协同

`ViewCommonGiong` 与 `BusinessCommonStats` / `BusinessCommonBacktest` 完美协同：

```js
// 业务层
const sizeData = BusinessCommonStats.getLatestBinaryStats(historyData, {
  fieldName: 'size', labelA: '大', labelB: '小',
  valueOf: function(special) { return special.te >= 25 ? '大' : '小'; }
});
const backtestData = BusinessCommonBacktest.runGeneric(historyData, { ... });

// 视图层（仅 1 行 + config）
ViewCommonGiong.renderLatestBinaryStats(sizeData, { ... });
ViewCommonGiong.showAnalysisBacktestModal(backtestData, { ... });
```

---

## 七、迁移指南

### 7.1 渐进式迁移（推荐）

按"只能新增"原则，**建议**：
1. `view-common-giong.js` 通用方法已就绪
2. 4 个 giong 文件**保留原函数**作为兜底
3. 新代码中尝试在 wrapper 内部改用通用方法
4. 验证 100% 等价后，再考虑替换

### 7.2 完全替换（需修改原文件）

如需将 4 个 giong 文件中的 12 个方法体改为通用函数调用：

1. 修改 `view-zodiac-giong-size.js` / `oddeven.js` / `wuxing.js` / `color.js` 中的对应方法体
2. HTML / CSS / 事件无需任何修改
3. 视图层调用方（`view-zodiac-giong.js`）无需任何修改（API 兼容）

> ⚠️ 完全替换属于"修改原文件"，违反"只能新增"原则。建议**保留原方法**，新代码使用 wrapper 调用通用函数。

---

## 八、未来工作

- [ ] 4 个 giong 文件**保留**作为兜底；新代码优先使用通用版本
- [ ] 通用回测函数（`BusinessCommonBacktest.runGeneric`）已被 `view-common-giong.js` 通过 `formatValue` 间接使用
- [ ] 通用统计函数（`BusinessCommonStats.getLatestBinaryStats / getLatestMultiStats`）已被 `view-common-giong.js` 通过字段约定使用
- [ ] 后续可考虑将 `card-rank-1/2/3` 重复判断抽取到 `ViewCommon.getRankCardClass`（**第 6 步延伸**）
