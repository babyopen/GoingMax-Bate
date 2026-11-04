# Apple 设计原则完整参考

源自 Apple WWDC 设计讲座（Designing Fluid Interfaces, WWDC 2018 等），翻译为 Web 平台可执行的设计规则。

> "当界面与我们的思维和运动方式对齐时，就会发生一些神奇的事情 —— 它不再像一台电脑，而是我们自身无缝的延伸。"

界面的"活"感来自：运动从当前屏幕值启动、继承用户速度、投影动量前进、任何时刻都能被抓住逆转。弹簧（spring）是让这一切自然发生的工具，因为它天然可中断、对速度敏感。

Apple 将设计服务于四种人类需求：**安全/可预测、理解、成就、愉悦**。以下每条规则都服务于其中之一。

---

## 1. Response — 消灭延迟

延迟一出现，直接感就"掉下悬崖"。响应是一切其他的基础。

- **pointerdown 就反馈，不是 release**。按钮一按下就高亮，等 click/touch-up 才显示反馈会让人感觉"死"。
- **警惕每一个延迟**。审查 debounce、人为计时器、transition 等待、~300ms tap delay。输入路径上任何非必需的东西都是回归。
- **反馈必须在交互过程中持续，不只是结束时**。对拖拽、滑块、drawer，全程 1:1 跟随指针更新 UI —— 绝不是手势完成才动画。

```css
/* 反馈就在按下瞬间，而且是即时的 */
.button:active {
  transform: scale(0.97);
  transition: transform 100ms ease-out;
}
```

## 2. Direct manipulation — 1:1 跟踪

> "触摸和内容应该一起移动。"

用户拖拽东西时，它必须紧贴手指 —— 并且尊重**抓的位置**。一抓就跳到元素中心会瞬间打破幻觉。

- 用 Pointer Events + `setPointerCapture`，即使指针离开元素边界跟踪也继续。
- 跟踪短**速度/位置历史**（最近几个 `pointermove`），不要只存当前点 —— 释放时需要速度。

```js
el.addEventListener('pointerdown', (e) => {
  el.setPointerCapture(e.pointerId);
  const grabOffset = e.clientY - el.getBoundingClientRect().top; // 尊重抓的位置
  // ...跟踪 position + timestamp 历史用于速度计算
});
```

## 3. Interruptibility — 最重要的原则

> "思考和手势是并行发生的。"

每个动画必须在任何时刻都能被中断和重定向。用户必须能在飞行中抓住一个移动的元素并反转它，而不是等动画结束。一个被用户再次抓住的关闭中的 modal 应该跟随手指 —— 不是先关完再重开。

- **永远不要在 transition 期间锁死输入**。
- **永远从呈现（屏幕上的实际）值动画，不要从目标值**。中断时，读取元素当前屏幕 transform 并从那里开始新动画。从逻辑/目标值开始会导致可见的跳变。
- **对手势驱动的任何东西避免 CSS transition 和 @keyframes** —— 它们不能在飞行中被平滑抓住和逆转。弹簧默认从当前值动画，这正是可中断性需要的。
- **手势反转时，混合速度 —— 不要硬切断它**。在反转时替换一个动画会产生速度不连续（"砖墙"效果）。能在重新目标时延续速度的弹簧库可以避免它。
- **把 2D 运动分解为独立的 X 和 Y 弹簧**。单个弹簧上距离 desync 当 X 和 Y 有不同速度时。

## 4. Behavior over animation — 用弹簧

> "把动画当作你和物体之间的对话，不是界面预先写好的剧本。"

预写好的、固定时长的动画不能响应新输入。弹簧可以 —— 新输入只是改变目标，运动保持连续。对用户能触摸的任何东西优先选择弹簧。

Apple 把物理三元组（mass/stiffness/damping）换成两个设计师友好的参数：

- **Damping ratio（阻尼比）** — 控制过冲。`1.0` = 临界阻尼，无弹跳，平滑收敛。`< 1.0` = 过冲并振荡。越低越弹。
- **Response（响应）** — 数值到达目标的速度，单位秒。越低越快。**这不是"时长"** —— 弹簧没有固定时长；它的收敛时间由参数自然产生。

**默认值**：

- 大多数 UI 从 **damping `1.0`（临界阻尼）** 开始 —— 优雅不打扰。
- 只在**手势本身带有动量**（flick、throw、drag release）时才加 bounce（**damping ~`0.8`**）。菜单只是淡入就 overshoot 感觉不对；卡被 flicked 出去 overshoot 感觉对。

**Apple 实际产品中的具体值**：

| 交互 | Damping | Response |
|------|---------|----------|
| 移动/重新定位（如 PiP） | 1.0 | 0.4 |
| 旋转 | 0.8 | 0.4 |
| Drawer / Sheet | 0.8 | 0.3 |

**Web 映射（Motion / Framer Motion）**：`bounce` + `duration` 弹簧 API 与 Apple 的 damping + response 非常接近。安全的 house style 是所有地方都用 `damping: 1.0` 弹簧；bounce 留给动量驱动的物理交互。

```js
import { animate } from 'motion';

// 临界阻尼默认（无过冲）
animate(el, { y: 0 }, { type: 'spring', bounce: 0, duration: 0.4 });

// 动量交互 —— 轻微 bounce，只因为前面有 flick
animate(el, { y: target }, { type: 'spring', bounce: 0.2, duration: 0.4 });
```

## 5. Velocity handoff — 拖拽和动画之间的接缝

手势结束时，动画必须**以手指的精确速度继续**，所以拖拽和动画之间没有可见接缝。这是让"流畅"与"还不错"分开的细节。

把指针的释放速度作为弹簧的初始速度传递。有些弹簧 API 要**相对**速度 —— 按到目标的剩余距离归一化：

```
relativeVelocity = gestureVelocity / (targetValue - currentValue)
```

例子：元素在 `y=50`，目标 `y=150`（还要走 100px），手指移动 50px/s → 初始弹簧速度 = `50 / 100 = 0.5`。Framer Motion / Motion 直接接收绝对 px/s 速度（`velocity` 选项），所以通常传原始值。

## 6. Momentum projection — 动画到手势**要去**的地方

> "用小输入产生大输出。"

不要从**释放点** snap 到最近边界。用速度来**投影静止位置** —— 完全像滚动减速 —— 然后 snap 到距离那个投影点最近的目标。这就是让 flick 感觉像把元素扔出去的原因。

Apple 精确的投影函数（来自 *Designing Fluid Interfaces* 示例代码）：

```js
// decelerationRate ≈ 0.998 正常滚动感觉；0.99 更灵敏
function project(initialVelocity /* px/s */, decelerationRate = 0.998) {
  return (initialVelocity / 1000) * decelerationRate / (1 - decelerationRate);
}

const projectedEndpoint = currentPosition + project(releaseVelocity);
const target = nearestSnapPoint(projectedEndpoint);    // 从投影点选择目标
animateSpringTo(target, { velocity: releaseVelocity }); // 然后交接速度（§5）
```

注意：教科书的 `v²/(2·decel)` 不是 Apple 实际用的 —— 用上面指数衰减形式。这是好的 bottom-sheets 和 carousels（Vaul、Embla）的标准行为。

## 7. Spatial consistency — 对称路径，锚定原点

> "如果某物从一边消失，我们期待它从那个方向出来。"

- **沿同一路径进入和退出**。从右边滑入的 panel 必须 dismiss 到右边。in-from-right / out-the-bottom 感觉脱节和困惑。
- **把交互锚定到源**。菜单、popover、sheet 应该从触发它的元素那里产生 —— 把 `transform-origin` 设为触发按钮，这样按钮和内容之间的空间关系很明显。
- **镜像可逆过渡上的 easing**，这样出站路径匹配回路（用反向 cubic-bézier 控制点用于两个方向）。

## 8. Hint in the direction of the gesture

人类从轨迹预测最终状态。中间帧应该 telegraph 东西要去哪里 —— Control Center 模块"朝你手指方向向上向外增长"。让中间帧指向结果，不要只是盲目插值到它。

## 9. Rubber-banding — 软边界

在边缘，渐进阻力而不是硬停。硬停止读起来像"冻结"；连续阻力读起来像"响应，但没有更多了"。应用增加的阻尼，用户越拖过边界越慢。

```js
// 越过界，元素跟得越少 —— 真实的东西停下之前先减速
function rubberband(overshoot, dimension, constant = 0.55) {
  return (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));
}
```

## 10. Gesture design details — "手感"检查清单

- **Tap**：touch-_down_ 就高亮（即时），touch-_up_ 才 commit。围绕目标加 ~10px 的 hysteresis/hit padding，允许 cancel-by-dragging-away-and-back。
- **Drag/swipe**：方向明确前要求小的移动阈值（hysteresis，~10px），然后 1:1 跟踪。
- **从第一次移动就并行检测所有合理手势**，然后一旦意图明确就自信地取消失败者。避免只报告**最终**状态的识别器（`swipeleft` 型事件）—— 它们丢弃了你需要的持续跟踪反馈。
- **最小化消歧延迟**。双指检测不可避免地延迟单指 tap；只有真正存在双指的地方才付出这个代价。

## 11. Frame-level smoothness

流畅度是关于**帧里有什么**，不只是帧率。

- 让每帧的位置变化低于感知阈值以避免频闪。
- 对非常快的运动，微妙的**运动模糊/stretch** 编码速度比硬锐利条带看起来好。
- `requestAnimationFrame` 是 web 的 display-synced 时钟（Apple 用 `CADisplayLink`）。只动画 compositor-friendly 属性 —— `transform` 和 `opacity` —— 在运动即将发生的地方 hint `will-change`。

## 12. Materials & depth — 半透明传达层级

Apple 用半透明材料作为带来结构但不抢焦点的浮动功能层。在 web 上用 `backdrop-filter` 近似。

- **把 nav/toolbars/sheets 建成半透明层**（`backdrop-filter: blur()` + 半透明底），内容在下面滚动 —— 不是消费固定条的不透明栏。
- **材料重量编码层级**：更暗/重的材料分隔结构区域（sidebars）；更轻的材料吸引注意力到交互元素（按钮）。**永远不要把浅色半透明表面叠在另一个上面** —— 可读性崩溃。
- **更大的表面应该看起来更厚**：比小 chip 更强的 blur + 更深的 shadow。考虑上下文感知 shadow —— 繁忙/文本内容上方更重以分离，简单背景上方更轻。
- **暗化来聚焦，分离来保持流**。模态任务把表面和 dim scrim 配对，把背景推后/向下。并行、非阻塞面板用半透明 + offset _不要_ scrim 这样流不会被打断。对堆叠 sheets，渐进地 dim 并推后每个父层。
- **Vibrancy 保持文字在变化的背景上清晰**。在模糊/半透明表面上，不要用扁平灰文字 —— 用更高对比度、稍重字重、加一点 letter-spacing bump。把颜色放在实底层，不是半透明前景上。
- **滚动边缘效果，不是硬 divider**。不是 sticky header 下 1px border，在内容和浮动 chrome 相遇的地方淡出小 blur/gradient mask —— 只在浮动 UI 实际覆盖内容的地方。
- **Materialize，不要只 fade**。对 glass/blur 表面，进入/退出时 blur 半径和 scale 一起动画，这样表面读起来像真实材料到达，不是普通 opacity fade。

```css
.toolbar {
  background: rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(20px) saturate(180%);
  border-top: 1px solid rgba(255, 255, 255, 0.4); /* 明亮上沿 = 光打到材料上 */
}
```

## 13. Multimodal feedback — motion + sound + haptics

组合多感官反馈的三条规则（来自 *Designing Audio-Haptic Experiences*）：

1. **Causality（因果）** —— 反馈原因必须明显。在实际因果事件（toggle 翻转、item snap 到家）上触发，匹配其物理特性。
2. **Harmony（和谐）** —— 视觉、声音和 haptic 必须在**同一帧**触发。它们之间的延迟破坏幻觉。不要让 CSS transition 滞后 audio/haptic（Vibration API）。
3. **Utility（实用）** —— 只在值得加的地方加反馈。为有意义的时刻（成功、错误、commit、snap）保留 haptics/sound。过度反馈训练用户忽略所有反馈。

## 14. Reduced motion & accessibility

Reduced motion 不是 _不要_ 反馈 —— 是更温和、非前庭的等价物。响应三个独立信号并把它们烤进组件：

- **`prefers-reduced-motion: reduce`** —— 把 slides/springs/parallax 换成短 opacity **cross-fades 或静态过渡**。去掉 elastic/overshoot。保留帮助理解的 opacity/color 变化。
- **`prefers-reduced-transparency: reduce`** —— 让半透明表面更 frostier/实底：提高背景 opacity，去掉 blur。
- **`prefers-contrast: more`** —— 近实底背景带定义明确、对比的 border。

另外：避免全屏移动背景、缓慢循环振荡（近 0.2 Hz / 5s 一个周期）、突然亮度跳变（ease 深浅主题切换）。让大移动物体在旅行时半透明，大表面在大重定位时淡出并在稳定后淡入回来。

```css
@media (prefers-reduced-motion: reduce) {
  .sheet { transition: opacity 200ms ease; transform: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .toolbar { background: white; backdrop-filter: none; }
}
```

## 15. Typography — optical sizing, tracking, leading

Apple 设计的字体会随尺寸改变形状；同样的纪律适用于 web（来自 *The Details of UI Typography*, WWDC 2020）。

- **Tracking（letter-spacing）是尺寸相关的 —— 永远不要一个值用于所有尺寸**。大的 display 文本要 _负_ tracking（字母随尺寸变大看起来离太远了）；小字要稍微 _正_ tracking 以提高可读性。固定 `letter-spacing` 在某处总是错的。收紧标题，让正文接近 `0`。
- **Leading（line-height）与尺寸成反比**。大标题上紧，正文上松。为有高 ascender/descender 的脚本增加；为密集、信息量大的 UI 收紧。
- **从 weight + size + leading 作为集合构建层级**，不是大小 alone。用 weight 强调 —— 它增加存在感但不占更多空间。
- **尊重用户的字号设置**（Dynamic Type）。用 `rem`/`em` scale 布局 _跟着_ 文本 —— 不是固定 px —— 这样大字体不会破坏布局。
- **优先用平台的系统字体**在自定义字体之前；它已经有 optical sizing、tracking tables 和可读性调优。只在有理由时覆盖。

```css
:root { font: 100%/1.5 system-ui, sans-serif; } /* body: system font, comfortable leading */

.display {
  font-size: clamp(2rem, 5vw, 4rem);
  line-height: 1.05;        /* 大文本紧 leading */
  letter-spacing: -0.02em;  /* 随增长加负 tracking */
  font-optical-sizing: auto;
}
```

## 16. Design foundations — the eight principles

以上的 motion 和 craft 服务于 Apple 的设计八原则（*Principles of Great Design*, WWDC 2026）。用这些作为你推理时的术语：

1. **Purpose**。有意识地做；决定 _不_ 建什么。每个功能都要用户的时间、注意力和信任 —— 只在值得付的地方花这个预算。
2. **Agency**。让人保持控制：给选项，不要逼单一路径。用 forgiveness 支持它 —— 对 slips 容易 undo，确认对话框只对真正破坏性、不可逆的操作用（谨慎使用；过度使用训练用户点击跳过）。
3. **Responsibility**。为用户的利益行事。隐私：在正确时刻要，只为需要的，透明。安全：预判误用和伤害 —— 特别是 AI（一个过敏感知的食谱 App 不能建议有害成分）。加预览、确认、免责；砍掉风险大于价值的功能。
4. **Familiarity**。建立在人们已知的东西上。用既不太字面也不太抽象的隐喻（垃圾桶=删除），并尊重他们的物理。保持一致：看起来一样的东西必须行为一样、住在同一个地方（close 在 macOS 上总是 top-left）这样人们能预测下一步发生什么。只有在能证明更好时打破熟悉模式 —— 然后测试它，不要假设。
5. **Flexibility**。为不同上下文、设备和完整的能力范围设计。适配平台（iPhone = quick touch；desktop = deep workflows with precise pointer control）和情况。设计包容性（年龄、语言、专长、accessibility）。当没有一个单独布局适合每个人时，让人们个性化 —— 重新排列控件，隐藏不用的东西。
6. **Simplicity — not minimalism**。剥掉不必要的让核心目的发光；把所有东西堆在一处看起来极简但不是 simple。简洁（plain language, no jargon, fewer steps）和清晰（用层级 — order, spacing, contrast — 所以最重要的东西最明显）。每个元素都要证明自己有位置；有时 _加_ 上下文反而简化（视频 scrubber 显示剩余时间）。先展示常见路径，高级选项深一层。
7. **Craft**。不妥协的注意力到细节建立信任。漂亮的 typography、适配深浅的颜色、清晰的 iconography 和给出即时、自然反馈的响应动画。没有什么是随机的 —— 每个 spacing、timing 和 alignment 值都是你能辩护的有意识选择。jittery 滚动、错位 icon 和旋转时断了的布局读起来像粗心。Craft 需要迭代和长寿 —— 随着功能和硬件变化持续演进设计。
8. **Delight**。其他七个都做对了的结果，不是事后贴上去的彩纸。决定你想让人们感受到的情绪（calm, confident, excited）并在每个决策中强化它。

服务这些原则的战术规则：

- **Feedback 有四种**：status、completion、warning、error。确认有意义的动作，暴露正在进行的 status，在问题前警告，inline 验证（不是 submit 时）。
- **Wayfinding（寻路）**。每个屏幕应该回答：我在哪？能去哪？那有什么？怎么出去？永远不要困住用户。
- **Grouping & mapping（分组 & 映射）**。proximity 暗示关系；把控件放在它影响的东西附近并按它改变的方式排列。如果需要 label 来解释一个控件，映射就很弱。
- **Direct, specific labels beat safe generic ones**。把 nav items 按它们的内容命名（"Progress", "Library"），不是模糊的 umbrella（"Home"）。specificity 创造可预测性。

## 17. Process — 流程

- **交互式原型 — 可交互 demo 胜过"一百万静态设计"**。你通过构建和玩来发现界面；一个 working prototype 也设了一个具体 bar 来防止平庸的最终实现。
- **设计交互和视觉一起做**。"你不应该能说出哪一端结束哪一端开始。"Motion 不是像素之后加的一层。
- **用真实的人在真实上下文中测试**，并以新鲜眼光审查 motion —— 用慢动作/逐帧播放来抓满速时看不见的东西。
