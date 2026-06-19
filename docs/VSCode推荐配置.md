# VSCode 推荐配置（2026-06-20）

> ⚠️ 由于 IDE 限制 `.vscode/` 目录无法由 AI 自动创建，请手动复制以下配置到对应文件。

## 1. `.vscode/settings.json`

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
    "source.fixAll.eslint": "explicit"
  },
  "files.defaultNewFileLocation": "activeFileDirectory",
  "files.associations": {
    "*.js": "javascript"
  },
  "javascript.suggest.autoImports": false,
  "javascript.updateImportsOnFileMove.enabled": "never",
  "eslint.enable": true,
  "eslint.validate": [
    "javascript"
  ],
  "readOnly.files": [
    "index.html",
    "core/config.js",
    "core/state.js",
    "core/storage.js"
  ],
  "search.exclude": {
    "**/node_modules": true,
    "**/.DS_Store": true
  }
}
```

## 2. `.vscode/extensions.json`

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

## 3. `.vscode/javascript.code-snippets`

```json
{
  "业务层基础结构": {
    "prefix": "bus",
    "body": [
      "// 【业务层】仅计算、算法、数据处理",
      "// ❌ 禁止 DOM / innerHTML / style / 渲染",
      "const BusinessXxx = {",
      "\t$1",
      "};"
    ],
    "description": "Gomini 业务层标准代码"
  },
  "视图层基础结构": {
    "prefix": "view",
    "body": [
      "// 【视图层】仅渲染界面、调用业务数据",
      "// ❌ 禁止业务计算、复杂逻辑",
      "const ViewXxx = {",
      "\trender() {",
      "\t\t$1",
      "\t}",
      "};"
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

## 4. 安装依赖

```bash
npm install
```

## 5. 启动 lint

```bash
# 检查全部
npm run lint

# 自动修复
npm run lint:fix
```
