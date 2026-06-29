# Gemini 彩票预测分析前端

> Gomini 架构标准实现 / 多层单向依赖 / 严格分层

## 项目简介

本项目是一个面向生肖彩票数据的预测分析前端，基于 **Gomini 架构**（平台层 / 核心层 / 业务层 / 视图层 / 事件层 / 入口层）实现，支持：

- 生肖号码排除 / 标记 / 锁定
- 多窗口频率评级（12/24/36 期滑动窗口）
- 全维度分析（号码统计 / 冷热 / 遗漏 / 跟随）
- 生肖关联分析
- 终极算法预测
- 历史开奖数据回测

## 架构宪法

完整规则见 [.trae/rules/Going.md](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/.trae/rules/Going.md)，核心红线：

| 层级 | 允许 | 禁止 |
|---|---|---|
| 平台层 `platform/web/` | DOM / 弹窗 / Toast | 业务计算 |
| 核心层 `core/` | 配置 / 工具 / 状态 / 存储 | DOM 操作 |
| 业务层 `business/` | 计算 / 算法 / 数据处理 | **任何 DOM 操作** |
| 视图层 `views/` | 渲染 DOM / 调用业务数据 | 业务计算 |
| 事件层 `event.js` | 事件委托（data-action） | 渲染代码 |
| 入口层 `app.js` | 初始化 / 注册路由 | 业务逻辑 |

## 工程化命令

```bash
# 安装依赖
npm install

# 代码规范检查
npm run lint

# 自动修复
npm run lint:fix

# 仅检查业务层（核心规则）
npm run lint:business
```

## 目录结构

```
项目根目录/
├── index.html              # 入口 HTML（只读）
├── app.js                  # 入口层
├── event.js                # 事件层
│
├── platform/               # 平台层（替换此层即可迁移到 APP）
│   └── web/
│       ├── dom.js
│       ├── render.js
│       ├── toast.js
│       ├── performance-monitor.js  # ⭐ 性能监控（v2.0.9）
│       ├── input-modal.js
│       └── modals/
│
├── core/                   # 核心层（只读）
│   ├── config.js
│   ├── config-module.js    # ⭐ ES Module模板（v2.0.9）
│   ├── utils.js
│   ├── state.js
│   └── storage.js
│
├── business/               # 业务层（禁止 DOM）
│   ├── business-*.js       # 通用业务
│   ├── business-event-bus.js  # ⭐ 事件总线（v2.0.9）
│   ├── business-exclude.js    # ⭐ 排除号码模块（v2.0.9）
│   ├── business-analysis.js   # ⭐ 分析模块（v2.0.9）
│   ├── business-filter.js     # ⭐ 方案管理模块（v2.0.9）
│   ├── business-view-helper.js  # ⭐ 视图辅助工具（v2.0.9）
│   ├── zodiac/             # 生肖类业务
│   └── sliding-window/     # 滑动窗口业务
│
├── data/                   # 数据层
│   ├── data-query.js
│   └── filter.js
│
├── views/                  # 视图层
│   ├── view-common.js
│   ├── <页面名>/           # 每页一个子目录
│   └── modals/             # 弹窗视图
│
├── docs/                   # 项目文档与优化建议
│   ├── 事件总线使用说明.md  # ⭐ v2.0.9
│   └── 优化全面完成报告.md  # ⭐ v2.0.9 最终版
│
├── tests/                  # 测试文件
│   ├── test-event-bus.html        # ⭐ 事件总线测试（10用例）
│   ├── test-business-common.html  # ⭐ 业务工具测试（12用例）
│   ├── test-core-utils.html       # ⭐ 核心工具测试（14用例）
│   └── test-performance-monitor.html  # ⭐ 性能监控测试（10用例）
│
├── .trae/rules/            # 架构宪法与规则
├── .eslintrc.js            # ESLint 强制校验
├── .eslintignore
└── package.json
```

## 修改规范

1. **只能新增，禁止破坏**：禁止删除 / 重构 / 覆盖原有功能
2. **单向依赖**：上层调用下层，禁止反向
3. **单一职责**：一个文件只做一件事
4. **不破坏只读文件**：`index.html` / `style.css` / `core/config.js` / `core/state.js` / `core/storage.js`

## 文档

### 核心文档
- [项目优化完整指南](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/docs/项目优化完整指南.md) ⭐ **v2.0.9 推荐**
- [事件总线使用说明](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/docs/事件总线使用说明.md) - API参考
- [优化验证清单](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/docs/优化验证清单.md) - 验证步骤

### 参考资料
- [架构宪法](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/.trae/rules/Going.md)
- [项目优化建议](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/docs/项目优化建议.md)
- [文档清理报告](file:///Users/macbook/Documents/Gemini-app/Bate/1.2版本/-3-1/docs/文档清理报告.md)
