---
name: apple-design
description: Apply Apple's WWDC fluid interface principles. Use when designing touch feedback gesture interactions spring animations or reviewing whether an interface feels natural and responsive.
---

# Apple 设计原则 · Gomini 移动端 Web App

本 Skill 将 Apple 的 WWDC 流体界面设计原则（Designing Fluid Interfaces, WWDC 2018）翻译为 Gomini 项目可执行的检查清单。完整原则与物理公式见 [`references/apple-design-principles.md`](references/apple-design-principles.md)。

## 何时触发

- 设计触摸反馈（按下高亮、缩放、弹性）
- 设计手势交互（拖拽、滑动、Sheet 弹出）
- 设计过渡动画（页面切换、模态框、列表重排）
- 评审某个界面是否"自然、有物理感、响应及时"
- 检查新功能是否符合 Apple 设计八原则

## 核心检查清单

每次动效/交互设计时逐条确认：

### 即时响应（Response）

| # | 检查项 | 通过标准 |
|---|--------|----------|
| ✓ | 按下即反馈 | `pointerdown`（或 `:active`）立刻出现高亮/缩放，不等 `click` |
| ✓ | 消除人为延迟 | 无多余 debounce、无 `setTimeout` 伪延迟、无 ~300ms tap 延迟 |
| ✓ | 交互中持续反馈 | 拖拽/滚动时 UI 实时跟随，不是结束才动画 |

### 可中断性（Interruptibility）

| # | 检查项 | 通过标准 |
|---|--------|----------|
| ✓ | 动画从当前值启动 | 被中断时读取**屏幕上的实际 transform** 作为新起点 |
| ✓ | 手势可反转 | 关闭中的 Sheet 被再次抓住 → 跟随手指，不是先关完再开 |
| ✓ | 避免 CSS transition 做手势动画 | 用弹簧（spring），不用固定时长 transition —— 弹簧天然从当前值续接 |

### 弹簧默认值

| 场景 | Damping | Response | 说明 |
|------|---------|----------|------|
| 位置/移动（默认 UI） | 1.0（临界阻尼） | 0.3~0.4s | 无过冲，优雅收敛 |
| 手势释放带速度（flick/drag-release） | ~0.8（欠阻尼） | 0.3~0.4s | 只有用户甩出去了才加 bounce |
| Drawer / Sheet | 0.8 | 0.3s | 弹簧带轻微弹性 |

**Web 映射（Framer Motion / Motion）**：`bounce` + `duration` ≈ Apple 的 damping + response。

### 速度交接（Velocity handoff）

| # | 检查项 | 实现 |
|---|--------|------|
| ✓ | 记录速度历史 | 跟踪最近 3~5 个 `pointermove` 的 timestamp+position |
| ✓ | 释放时传给弹簧 | 把 `releaseVelocity px/s` 作为 spring 的 `velocity` 参数 |
| ✓ | 动量投影 | flick 时用 `project(v) = (v/1000)·0.998/(1-0.998)` 算预测落点，吸附到最近边界 |

### 空间一致性（Spatial consistency）

| # | 检查项 |
|---|--------|
| ✓ | 进入/退出同路径（右进右出，上进下出） |
| ✓ | `transform-origin` 锚定触发按钮（popover 从按钮位置 scale，不是中心） |
| ✓ | 可逆过渡用反向贝塞尔（inverse cubic-bézier） |

### 软边界（Rubber-banding）

```js
// 超出边界时渐进阻尼，不是硬停
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

### 毛玻璃层级（Materials & depth）

| # | 做法 |
|---|------|
| ✓ | 导航栏/Sheet 用 `backdrop-filter: blur(20px) saturate(180%)` + 半透明底 |
| ✓ | 毛玻璃上放高对比度文字，别用浅灰 |
| ✓ | 大表面强 blur + 深 shadow，小 chip 弱 blur + 浅 shadow |
| ✓ | 滚动边缘用 gradient mask 而非硬 border |

### 无障碍（Reduced motion & accessibility）

```css
@media (prefers-reduced-motion: reduce) {
  * { animation-duration: 0.01ms !important; transition-duration: 0.01ms !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: var(--card); backdrop-filter: none; }
}
```

## 设计八原则（决策时的思考框架）

1. **Purpose** — 不想要的就不建，为用户的注意力预算负责
2. **Agency** — 用户永远在控制，给确认只对真正不可逆操作
3. **Responsibility** — 预判误用，加预览/确认/免责
4. **Familiarity** — 沿用已知隐喻和物理，打破熟悉模式前先验证更好
5. **Flexibility** — 适配不同设备/场景/能力
6. **Simplicity — not minimalism** — 剥掉不必要的让核心突出，不是什么都堆一起叫极简
7. **Craft** — 间距/字号/对齐都是有意识的选择
8. **Delight** — 前七个都对了自然就有愉悦感

## 快速参考

| 需要 | 技术 | 具体值 |
|------|------|--------|
| 默认 UI 弹簧 | 临界阻尼无过冲 | damping 1.0, response 0.3~0.4 |
| 动量 flick 弹簧 | 欠阻尼轻微 bounce | damping ~0.8, response 0.3~0.4 |
| 手势→弹簧速度交接 | 释放速度传参 | Framer Motion `velocity` 选项直接传 px/s |
| flick 落点 | 动量投影 | `current + (v/1000)·d/(1-d), d≈0.998` |
| 中断干净续接 | 从屏幕当前值启动 | 读 `getBoundingClientRect()` / 当前 transform |
| 反转无缝 | 速度穿透重定向 | 弹簧库自带 re-target 时 carry velocity |
| 可逆过渡 | 反向贝塞尔 | 两个方向用 inverse cubic-bézier |
| 1:1 拖拽 | Pointer Events + capture | 尊重 grab offset |
| 反馈 | pointerdown 即时持续 | 绝不是只在结束时 |
| 边界 | 软阻尼不硬停 | rubberband 函数 |
| 毛玻璃 | backdrop-filter 层 | 内容滚动在下方 |
| 字体间距 | 尺寸相关不固定 | 大字 -0.02em，正文接近 0 |

## Gomini 现有实现对照

Gomini 项目中符合本原则的已有实践（无需改动）：

- ✅ `:active` scale 反馈 —— button 按下去立刻缩放（符合原则 1）
- ✅ `:focus-visible` 键盘可中断性 —— 任何时刻 Tab 都能抓住焦点（符合原则 3）
- ✅ 毛玻璃导航栏 —— `backdrop-filter` + 半透明底（符合原则 12）
- ✅ 深色模式适配 —— 同一套设计在深浅都 work（符合原则 14）
- ✅ 简化动画时长 —— 已有 `prefers-reduced-motion` 媒体查询（符合原则 14）
- ✅ 系统字体优先 —— 用 `-apple-system, BlinkMacSystemFont`（符合原则 15）

Gomini 项目中可以改进的地方：

- ⚠️ 没有弹簧库 —— 当前全部用固定时长 transition，可以考虑引入 Motion (framer-motion) 以获得可中断动画
- ⚠️ Sheet/Modal 没有速度交接 —— 拖拽关闭时没有 momentum projection，只是 snap 到边界
- ⚠️ 边界是硬停而非 rubber-band —— 列表滚动到底部时是硬停，没有渐进阻尼反馈
