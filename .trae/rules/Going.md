# Gomini 项目宪法

## 第一章：核心原则

### 1.1 不可违反的铁律
1. **只能新增，禁止破坏**：只能新增、追加、扩展、优化代码，禁止删除、重构、覆盖、重写原有功能
2. **单向依赖**：只能上层调用下层，绝对禁止反向依赖或循环依赖
3. **单一职责**：每个文件只能承担单一职责，禁止跨职责混写代码

### 1.2 绝对禁止事项（红线）
1. ❌ 禁止修改 `index.html` 已有 DOM、id、class
2. ❌ 禁止修改 CONFIG、常量、映射表、基础配置
3. ❌ 禁止修改 State 原有结构、Storage 存储 KEY 和数据结构
4. ❌ 禁止覆盖/删除原有正常运行的函数
5. ❌ 禁止破坏样式基础（CSS变量、安全区、导航）
6. ❌ 禁止在 `business-*.js` 中出现任何 DOM 操作
7. ❌ 禁止在 `view-*.js` 中出现任何业务计算
8. ❌ 禁止在 HTML 中使用内联事件（onclick、onchange等）
9. ❌ 禁止在 `event.js` 中出现任何渲染代码
10. ❌ 禁止下层模块调用上层模块
11. ❌ 禁止添加任何鼠标悬停（hover）效果
12. ❌ 禁止添加任何鼠标相关事件（mouseover、mouseenter、mouseleave）
13. ❌ 所有元素保持静态展示，不允许随鼠标位置产生变化

### 1.3 修改保护规则
所有修改必须满足：
- ✅ 不破坏原有功能
- ✅ 不新增交互
- ✅ 不乱加代码

## 第二章：架构分层

### 2.1 调用顺序（严格单向）
```
平台层 → 核心层 → 业务层 → 视图层 → 事件层 → 入口层

platform/ (平台组件)
      ↓
   core/ (核心基础)
      ↓
business/ (业务层)
      ↓
  views/ (视图层)
      ↓
 event.js (事件层)
      ↓
 app.js (入口层)
```

### 2.2 分层职责

#### 平台层（/platform/web/）
- **DOM、弹窗、Toast 必须放这里**
- 后期转 APP → **只替换这个文件夹**，其他代码零改动
- **dom.js**：缓存和获取 DOM 元素
- **render.js**：通用渲染
- **toast.js**：Toast 组件
- **input-modal.js**：模态框

#### 核心层（/core/）
- **config.js**：常量、配置、枚举、映射表（禁止函数）
- **utils.js**：纯工具函数（深拷贝、防抖、节流等）
- **state.js**：全局状态管理
- **storage.js**：本地存储读写

#### 业务层（/business/）- **绝对禁止**
- ❌ 禁止 `document.getElementById`
- ❌ 禁止 `innerHTML / style / 样式`
- ❌ 禁止任何 DOM 操作
- ✅ 只做：计算、逻辑、算法、数据处理

#### 视图层（/views/）- **只允许**
- ✅ 渲染 DOM、更新界面
- ✅ 调用业务层拿数据
- ❌ 禁止写业务计算
- ❌ 禁止写复杂逻辑

#### 事件层（根目录 event.js）
- 统一事件委托（data-action）
- 禁止任何渲染代码

#### 入口层（根目录 app.js）
- 初始化应用、注册路由、启动定时器
- 禁止任何业务逻辑

### 2.3 目录约定
```
项目根目录/
├── index.html              # 入口 HTML（禁止修改已有 DOM）
├── style.css               # 全局样式
├── app.js                  # 入口层
├── event.js                # 事件层
│
├── platform/               # 平台层（APP切换只需替换这里）
│   └── web/
│       ├── dom.js        # DOM操作
│       ├── render.js     # 渲染
│       ├── toast.js      # 提示
│       └── input-modal.js
│
├── core/                   # 核心层
│   ├── config.js           # 【只读】常量、配置、映射表
│   ├── utils.js            # 纯工具函数
│   ├── state.js            # 【只读】全局状态
│   └── storage.js          # 【只读】本地存储
│
├── business/               # 业务层（禁止DOM）
│   └── business-*.js
│
├── data/                   # 数据层
│   ├── data-query.js
│   └── filter.js
│
├── views/                  # 视图层（禁止计算）
│   ├── view-common.js      # 视图通用工具
│   └── <页面名>/            # 每个页面一个子目录（多个文件时必须放入文件夹）
│       ├── view-<页面名>.js       # 页面共用逻辑
│       └── view-<页面名>-<标签名>.js  # 每个标签页一个文件
│
├── .trae/rules/
│   └── constitution.md     # 本文件
│
├── .vscode/                # IDE 配置
├── .eslintrc.js            # 代码强制校验规则
└── package.json            # 依赖配置
```

### 2.4 文件拆分原则

1. **一个页面一个文件夹**：每个独立页面（即 HTML 中一个完整的可切换页面区域）必须独占一个子目录，禁止多个页面混写在同一个文件中
2. **多个文件必须放入文件夹**：如果一个页面有多个文件（标签页拆分等），必须全部放入该页面的子目录中，禁止散落在 views/ 根目录
3. **一个标签页一个文件**：如果页面内包含多个标签页（tab），每个标签页必须单独拆分为独立文件
   - 标签页切换逻辑可放在视图通用工具文件（如 `view-common.js`）中
   - 示例：
     ```
     views/
     ├── analysis/                       # 分析页（1 个页面 = 1 个目录）
     │   ├── view-analysis.js            # 共用逻辑（标签页切换、详情展开）
     │   ├── view-analysis-history.js    # 标签页：历史列表
     │   ├── view-analysis-full.js       # 标签页：全维度分析
     │   └── view-analysis-zodiac.js     # 标签页：生肖关联分析
     ├── zodiac/                         # 生肖资料页（1 个页面 = 1 个目录）
     │   ├── view-zodiac-predict.js      # 标签页：推荐
     │   ├── view-zodiac-main.js         # 标签页：主推
     │   ├── view-zodiac-giong.js        # 标签页：Giong
     │   ├── view-zodiac-giong-size.js   # 子标签页：大小分析
     │   ├── view-zodiac-giong-oddeven.js # 子标签页：单双分析
     │   ├── view-zodiac-giong-wuxing.js # 子标签页：五行分析
     │   ├── view-zodiac-giong-color.js  # 子标签页：波色分析
     │   └── view-zodiac-ultimate.js     # 标签页：终极算法
     └── view-common.js                  # 全局视图工具
     ```
4. **文件命名规范**：视图文件统一使用 `view-<页面名>-<标签页名>.js` 格式（无标签页时仅 `view-<页面名>.js`），业务文件使用 `business-<页面名>-<功能名>.js`

### 2.5 只读文件保护
以下文件为只读，禁止任何修改：
- `index.html` — 禁止修改已有 DOM/id/class
- `style.css` — 禁止修改基础样式/CSS变量
- `core/config.js` — 禁止修改常量、配置、映射表
- `core/state.js` — 禁止修改状态结构
- `core/storage.js` — 禁止修改存储 KEY 和数据结构

## 第三章：事件绑定规范

### 3.1 强制要求
1. 所有点击交互必须使用 `data-action` 方式
2. 所有事件统一写在 `event.js`（唯一事件中心）
3. 禁止内联事件（onclick、onchange 等）
4. 视图页面只允许渲染，不允许绑定事件

## 第四章：代码生成流程

### 4.1 生成前必须回答
1. 这段代码属于哪一层？
2. 应该放在哪个文件中？
3. 会依赖哪些模块？
4. 是否符合单一职责原则？
5. 是否有重复代码可以复用？

### 4.2 生成后必须自检
- [ ] 依赖方向正确（上层调用下层）
- [ ] 代码放在了正确的文件中
- [ ] business/ 中没有 DOM 操作
- [ ] views/ 中没有业务计算
- [ ] 没有使用内联事件
- [ ] 没有修改原有正常运行的代码
- [ ] 页面正常加载，控制台无报错
- [ ] 所有功能与修改前完全一致

## 第五章：IDE 与工程化配置

### 5.1 VS Code 配置

#### `.vscode/settings.json`
```json
{
  "explorer.sortOrder": "type",
  "workbench.editor.enablePreview": false,
  "workbench.editor.enablePreviewFromQuickOpen": false,
  "files.exclude": {
    "**/.git": true,
    "**/.DS_Store": true
  },
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "files.defaultNewFileLocation": "activeFileDirectory",
  "readOnly.files": [
    "index.html",
    "style.css",
    "core/config.js",
    "core/state.js",
    "core/storage.js"
  ]
}
```

#### `.vscode/extensions.json`
```json
{
  "recommendations": [
    "dbaeumer.vscode-eslint",
    "bierner.file-templates",
    "christian-kohler.path-intellisense",
    "hoovercj.vscode-read-only"
  ]
}
```

#### `.vscode/javascript.code-snippets`
```json
{
  "业务层基础结构": {
    "prefix": "bus",
    "body": [
      "// 业务层：纯数据逻辑，无DOM操作",
      "export default {",
      "\t$1",
      "}"
    ],
    "description": "Gomini 业务层标准代码"
  },
  "视图层基础结构": {
    "prefix": "view",
    "body": [
      "// 视图层：仅渲染，不写业务计算",
      "export default {",
      "\trender() {",
      "\t\t$1",
      "\t}",
      "}"
    ],
    "description": "Gomini 视图层标准代码"
  },
  "data-action 事件标识": {
    "prefix": "da",
    "body": [
      "data-action=\"$1\""
    ],
    "description": "统一事件绑定标识"
  }
}
```

### 5.2 ESLint 强制校验规则（`.eslintrc.js`）

```js
module.exports = {
  env: {
    browser: true,
    es2021: true
  },
  parserOptions: {
    ecmaVersion: "latest"
  },
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[property.name='onclick']",
        message: "❌ 禁止内联onclick，统一使用 data-action"
      },
      {
        selector: "MemberExpression[property.name='onchange']",
        message: "❌ 禁止内联onchange，统一使用 data-action"
      },
      {
        selector: "*[name=/mouseover|mouseenter|mouseleave|hover/]",
        message: "❌ 禁止鼠标事件、hover交互，元素保持静态"
      }
    ],
    "no-var": "error",
    "prefer-const": "error",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }]
  },
  overrides: [
    {
      files: ["business/**/*.js"],
      rules: {
        "no-restricted-globals": [
          "error",
          { name: "document", message: "❌ 业务层禁止使用 document 及所有DOM操作" },
          { name: "window", message: "❌ 业务层禁止直接操作window DOM API" }
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[property.name='getElementById']",
            message: "❌ 业务层禁止获取DOM元素"
          },
          {
            selector: "MemberExpression[property.name='innerHTML']",
            message: "❌ 业务层禁止使用 innerHTML"
          },
          {
            selector: "MemberExpression[property.name='style']",
            message: "❌ 业务层禁止操作样式 style"
          }
        ]
      }
    },
    {
      files: ["event.js"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[property.name=/render/]",
            message: "❌ event.js 事件层禁止编写渲染代码"
          }
        ]
      }
    },
    {
      files: ["views/**/*.js"],
      rules: {
        "complexity": ["warn", 4],
        "max-lines-per-function": ["warn", 15]
      }
    }
  ]
};
```

### 5.3 package.json（提交校验）

```json
{
  "name": "gomini-project",
  "version": "1.0.0",
  "scripts": {
    "lint": "eslint .",
    "lint:fix": "eslint . --fix"
  },
  "devDependencies": {
    "eslint": "^8.57.0",
    "lint-staged": "^15.2.2"
  },
  "lint-staged": {
    "*.js": [
      "eslint --fix",
      "eslint"
    ]
  }
}
```

安装依赖：`npm install`

### 5.4 WebStorm / IDEA 配置（JetBrains 系列）

#### 项目模板
1. 按目录结构建好空项目
2. `Tools → Save Project as Template`，命名 `Gomini 标准模板`
3. 新建项目直接选用该模板

#### 文件模板
打开 `File → Settings → Editor → File and Code Templates`

**Gomini-Business**
```javascript
// 【业务层】仅计算、算法、数据处理
// ❌ 禁止 DOM / innerHTML / style / 渲染
export default {

}
```

**Gomini-View**
```javascript
// 【视图层】仅渲染界面、调用业务数据
// ❌ 禁止业务计算、复杂逻辑
export default {
  render() {

  }
}
```

**Gomini-Platform**
```javascript
// 【平台层】DOM、渲染、弹窗、模态框
export default {

}
```

#### 代码检查规则（Inspection 强制报错）
`File → Settings → Editor → Inspections → JavaScript and TypeScript`
1. **Restricted identifiers**：添加 `onclick`、`onchange`、`mouseover`、`mouseenter`、`mouseleave`，级别 `Error`
2. **Restricted expressions**：添加 `document.getElementById`、`*.innerHTML`、`*.style`，级别 `Error`

#### 只读文件
选中以下文件 → 右键 `File → Make File Read-Only`：
- index.html
- style.css
- core/config.js
- core/state.js
- core/storage.js

## 第六章：使用说明

1. **目录**：严格使用标准结构，禁止新增一级目录、跨目录放文件
2. **新建文件**：必须使用 IDE 预设模板，自动归类+规范命名
3. **编码约束**
   - business 目录：出现 DOM 相关代码 → 直接报错
   - views 目录：限制复杂逻辑，只做渲染
   - event.js：禁止渲染代码
   - 全局：禁止内联事件、鼠标事件、hover 效果
4. **保护文件**：index.html、core 下配置文件为只读，无法编辑
5. **提交校验**：执行 `npm run lint` 检查，违规禁止提交
6. **命名规范**：视图 `view-xxx.js`、业务 `business-xxx.js`；单页面/单标签页独立文件

## 第七章：违规处理

如果违反以上任何一条规则，立即停止生成代码，重新按照规则修改。
