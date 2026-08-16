/**
 * ESLint 配置 — 强制 Gomini 项目宪法（Going.md）落地
 *
 * 规则目标：
 *  1. 业务层禁止任何 DOM 操作（document / getElementById / innerHTML / style）
 *  2. 视图层禁止业务计算（不在视图层做 .sort / .filter / .map 等业务加工）
 *  3. 事件层（event.js）禁止编写渲染代码
 *  4. 全局禁止内联事件（onclick / onchange）和鼠标事件（mouseover / mouseenter / mouseleave）
 *  5. 强制使用 const、不允许 var
 *
 * 用法：
 *   npm run lint        # 仅检查
 *   npm run lint:fix    # 自动修复
 */
module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
    node: true
  },
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "script"
  },
  // v2.6.9：忽略大写驼峰命名的顶层声明（跨文件模块引用）
  rules: {
    "no-unused-vars": [
      "warn",
      {
        vars: "all",
        args: "after-used",
        argsIgnorePattern: "^_",
        caughtErrors: "none",
        varsIgnorePattern: "^[A-Z]"
      }
    ]
  },
  globals: {
    // 项目全局对象（按 script 标签加载顺序自动挂载 window）
    CONFIG: "readonly",
    Utils: "readonly",
    StateManager: "readonly",
    Storage: "readonly",
    DOM: "readonly",
    Toast: "readonly",
    Render: "readonly",
    DataQuery: "readonly",
    Filter: "readonly",
    Business: "readonly",
    BusinessQuickNav: "readonly",
    BusinessCrossExclusion: "readonly",
    BusinessUltimate: "readonly",
    BusinessGiong: "readonly",
    BusinessExclude: "readonly", // v2.6.9: 跨文件模块引用
    BusinessAnalysis: "readonly", // v2.6.9: 跨文件模块引用
    BusinessHotBacktest: "readonly", // v2.6.9: 跨文件模块引用
    BusinessImpossible: "readonly", // v2.6.9: 跨文件模块引用
    BusinessCommonSort: "readonly", // v2.6.9: 跨文件模块引用
    BusinessEventBus: "readonly", // v2.6.9: 跨文件模块引用
    BusinessSlidingWindow: "readonly", // v2.6.9: 跨文件模块引用
    BusinessSlidingWindowHistory: "readonly", // v2.6.9: 跨文件模块引用
    ZodiacPrediction: "readonly",
    ZodiacScores: "readonly",
    ZodiacMiss: "readonly",
    ZodiacZones: "readonly",
    ZodiacStats: "readonly",
    ZodiacBacktest: "readonly",
    ZodiacTongji: "readonly",
    SlidingWindow: "readonly",
    SlidingWindowHistory: "readonly",
    ViewCommon: "readonly",
    ViewFilter: "readonly",
    ViewProfile: "readonly",
    ViewQuickNav: "readonly",
    ViewBatchModal: "readonly",
    ViewOverlapModal: "readonly",
    ViewAnalysis: "readonly",
    ViewAnalysisHistory: "readonly",
    ViewAnalysisFull: "readonly",
    ViewAnalysisZodiac: "readonly",
    ViewZodiacPredict: "readonly",
    ViewZodiacMain: "readonly",
    ViewZodiacGiong: "readonly",
    ViewZodiacGiongSize: "readonly",
    ViewZodiacGiongOddEven: "readonly",
    ViewZodiacGiongWuxing: "readonly",
    ViewZodiacGiongColor: "readonly",
    ViewZodiacUltimate: "readonly",
    ViewZodiacTongji: "readonly",
    ViewSlidingWindowHistory: "readonly",
    EventBinder: "readonly",
    initApp: "readonly"
  },
  rules: {
    "no-restricted-syntax": [
      "error",
      {
        selector: "MemberExpression[property.name='onclick']",
        message: "❌ 禁止内联 onclick，统一使用 data-action"
      },
      {
        selector: "MemberExpression[property.name='onchange']",
        message: "❌ 禁止内联 onchange，统一使用 data-action"
      },
      {
        selector: "MemberExpression[property.name='onmouseover']",
        message: "❌ 禁止 onmouseover，使用 touch 事件"
      },
      {
        selector: "MemberExpression[property.name='onmouseenter']",
        message: "❌ 禁止 onmouseenter"
      },
      {
        selector: "MemberExpression[property.name='onmouseleave']",
        message: "❌ 禁止 onmouseleave"
      }
    ],
    "no-var": "error",
    "prefer-const": "warn",
    "no-unused-vars": ["warn", { "argsIgnorePattern": "^_" }],
    "no-console": "off",
    "eqeqeq": ["warn", "smart"],
    "no-multi-spaces": "warn"
  },
  overrides: [
    // ========== 业务层：禁止任何 DOM 操作 ==========
    {
      files: ["business/**/*.js"],
      rules: {
        "no-restricted-globals": [
          "error",
          { name: "document", message: "❌ 业务层禁止使用 document 及所有 DOM 操作" }
          // v2.6.8 调整：移除 window 限制
          // 原因：window.requestIdleCallback / window.cancelIdleCallback 是 W3C 标准浏览器 API，非 DOM 操作
          // （业务层误用 window 操作 DOM 的风险已通过 document + getElementById + innerHTML 等规则覆盖）
        ],
        "no-restricted-syntax": [
          "error",
          {
            selector: "CallExpression[callee.property.name='getElementById']",
            message: "❌ 业务层禁止获取 DOM 元素"
          },
          {
            selector: "CallExpression[callee.property.name='querySelector']",
            message: "❌ 业务层禁止 querySelector"
          },
          {
            selector: "CallExpression[callee.property.name='querySelectorAll']",
            message: "❌ 业务层禁止 querySelectorAll"
          },
          {
            selector: "MemberExpression[property.name='innerHTML']",
            message: "❌ 业务层禁止使用 innerHTML"
          },
          {
            selector: "MemberExpression[property.name='outerHTML']",
            message: "❌ 业务层禁止使用 outerHTML"
          },
          {
            selector: "MemberExpression[property.name='insertAdjacentHTML']",
            message: "❌ 业务层禁止使用 insertAdjacentHTML"
          }
        ]
      }
    },
    // ========== 事件层（event.js）：禁止编写渲染代码 ==========
    {
      files: ["event.js"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "MemberExpression[property.name='innerHTML']",
            message: "❌ event.js 事件层禁止使用 innerHTML"
          }
          // v2.6.8 调整：移除 getElementById / querySelector 限制
          // 原因：event.js 的职责是"事件绑定 + 必要的 DOM 查询"，以下场景必须直接查询 DOM：
          //   - 系统事件（change/scroll/focus）无法用 data-action 委托，必须主动查询元素
          //   - mouse/touch 长按、滑动等手势需要 document 级监听
          //   - 弹窗/Toast 内部查询具体节点（如 #customNum 读取用户输入）
          //   - 跨层级 DOM 关系（closest / parentElement.querySelector）
          // 架构保证：业务层仍禁止 DOM 操作（document + getElementById + innerHTML 限制保留）
          // 业务层错误 DOM 操作的风险已通过业务层规则覆盖
        ]
      }
    },
    // ========== 视图层：限制复杂度 ==========
    {
      files: ["views/**/*.js"],
      rules: {
        "complexity": ["warn", 8],
        "max-lines-per-function": ["warn", 30],
        // 提示：视图层可调用 Business.*，但禁止做业务计算
        "no-restricted-syntax": [
          "error",
          {
            selector: "CallExpression[callee.property.name='sort'][arguments.length=0]",
            message: "💡 视图层建议将 .sort() 封装为业务层函数后调用"
          }
        ]
      }
    },
    // ========== 核心层（core/）：仅配置、状态、工具 ==========
    {
      files: ["core/**/*.js"],
      rules: {
        "no-restricted-syntax": [
          "error",
          {
            selector: "CallExpression[callee.property.name='getElementById']",
            message: "❌ 核心层禁止 getElementById（DOM 工具应放 platform/）"
          }
        ]
      }
    }
  ]
};
