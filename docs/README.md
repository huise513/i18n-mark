# Vite Plugin for i18n-mark

🚀 Vite 插件，为 i18n-mark 提供开发时的实时代码转换支持。

## ✨ 特性

- 🔥 **开发时实时转换**：在开发环境中动态转换代码，无需修改源文件
- 📁 **多文件支持**：支持 JS/TS/JSX/TSX/Vue 文件
- ⚡ **高性能**：基于 Vite 的转换机制，快速响应
- 🎯 **智能过滤**：支持 include/exclude 模式匹配
- ⚙️ **灵活配置**：继承 i18n-mark 的配置选项

## 📦 安装

```bash
npm install i18n-mark
# 或
pnpm add i18n-mark
# 或
yarn add i18n-mark
```

## 🚀 快速开始

### 基础配置

在 `vite.config.js` 中添加插件：

```javascript
import { defineConfig } from 'vite'
import vitePluginI18nMark from 'i18n-mark/vite'

export default defineConfig({
  plugins: [
    vitePluginI18nMark({
      // 基础配置
      i18nTag: 'i18n',
      i18nImport: {
        path: '@/utils/i18n',
        type: 'default'
      }
    })
  ]
})
```

## ⚙️ 配置选项

插件配置继承了 i18n-mark 的所有配置选项，并添加了以下 Vite 特定选项：

### 插件特定选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `enabled` | `boolean` | `true` | 是否启用插件 |

### 继承 i18n-mark 选项

## 🔧 工作原理

通过 transform 转换代码，将中文替换为 i18n 标记, 并对转换后的代码做提取，生成语言文件。

### 开发环境

在开发环境中，插件会：

1. **实时转换**：监听文件变化，自动转换包含中文的代码
2. **内存处理**：转换结果只存在于内存中，不修改源文件
3. **Source Map**：保持完整的 Source Map 支持，便于调试

