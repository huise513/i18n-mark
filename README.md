# i18n-mark

🌍 自动化国际化代码处理工具，支持 JavaScript/TypeScript 和 Vue 文件的中文字符串标记与提取。

## 🎯 核心功能

**标记（Mark）**：自动识别代码中的中文字符串并添加国际化标记
```javascript
// 转换前
const message = "你好世界";

// 转换后  
const message = i18n`你好世界`;
```

**提取（Extract）**：从已标记的代码中提取国际化字符串到JSON文件
```javascript
// 从代码中提取
i18n`你好世界` -> { "你好世界": "你好世界" }
```

**翻译（Translate）**：自动翻译提取的字符串到多种语言
```javascript
// 自动翻译
{ "你好世界": "你好世界" } -> { "你好世界": "Hello World" }
```
## ✨ 特性

- 🎯 **智能识别**：自动识别代码中的中文字符串，无需手动标记
- 📁 **多文件支持**：支持 JS/TS/JSX/TSX/Vue 文件批量处理
- 🚫 **灵活忽略**：支持 `// i18n-ignore` 注释跳过指定代码行
- ⚙️ **配置灵活**：支持 CLI 参数、配置文件和编程式调用
- 🎨 **自定义标记**：可自定义 i18n 函数名和导入路径
- 📋 **Git 集成**：支持只处理 Git 暂存区文件
- 🌐 **自动翻译**：支持百度、腾讯、阿里、有道等翻译服务
- 📊 **智能管理**：翻译记录管理，避免重复翻译

## 📦 安装

```bash
npm install i18n-mark

# 全局安装（CLI使用）
npm install i18n-mark -g
```

## 🚀 快速开始

### CLI 使用

```bash
# 标记中文字符串
i18n-mark mark

# 提取国际化字符串
i18n-mark extract

# 翻译国际化字符串
i18n-mark translate

# 标记、提取、翻译（一步完成）
i18n-mark

# 使用配置文件
i18n-mark -c i18n.config.js

```

### 编程式使用

```typescript
import { mark, extract } from 'i18n-mark'

// 标记中文字符串
mark({
  include: ['src/**/*.{js,ts,vue}'],
  i18nTag: 'i18n',
  i18nImport: '@/utils/i18n'
})

// 提取国际化字符串
extract({
  include: ['src/**/*.{js,ts,vue}'],
  localeDir: './src/locale/',
  langs: ['zh', 'en']
})

// 翻译国际化字符串
translate({
  localeDir: './src/locale/',
  langs: ['zh', 'en'],
  translation: {
    service: {
      name: 'baidu',
      apiKey: 'your-api-key',
      apiSecret: 'your-api-secret'
    }
  }
})
```

### 配置文件

创建 `i18n.config.js` 文件：

```javascript
export default {
  include: ['src/**/*.{js,ts,vue}'],
  exclude: ['**/test/**'],
  i18nTag: 'i18n',
  i18nImport: '@/utils/i18n',
  localeDir: './src/locale/',
  langs: ['zh', 'en'],
  
  // 翻译配置
  translation: {
    service: {
      name: 'baidu',
      apiKey: 'your-baidu-api-key',
      apiSecret: 'your-baidu-api-secret'
    },
    translateMapping: 'translateMapping'
  }
}
```

## ⚙️ 配置 API

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `include` | `string[]` | `['src/**/*']` | 包含的文件模式（glob），只支持js/ts/jsx/tsx/vue/mjs文件 |
| `exclude` | `string[]` | `['**/node_modules/**', '**/dist/**']` | 排除的文件模式（glob） |
| `staged` | `boolean` | `false` | 只处理 Git 暂存区文件 |
| `i18nTag` | `string` | `'i18n'` | i18n 标记函数名 |
| `i18nImport` | `string \| object` | `undefined` | i18n 函数导入配置 |
| `ignoreComment` | `string` | `'i18n-ignore'` | 忽略注释标记 |
| `ignoreAttrs` | `string[]` | `[]` | Vue/JSX 中忽略的属性 |
| `localeDir` | `string` | `'./src/locale/'` | 输出目录 |
| `langs` | `string[]` | `['zh', 'en']` | 支持的语言列表 |
| `fileMapping` | `string` | `'fileMapping'` | 文件映射配置 |
| `placeholder` | `[string, string?]` | `['{', '}']` | 占位符配置 |
| `translation` | `object` | `undefined` | 翻译服务配置 |

### 翻译配置选项

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `services` | `array` | `[]` | 翻译服务配置列表 |
| `defaultService` | `string` | - | 默认翻译服务名称 |
| `update` | `boolean` | `false` | 强制更新已有翻译, 否则只更新缺失的翻译 |
| `refresh` | `boolean` | `false` | 将translateMapping数据刷新到各个语言文件 |
| `translateMapping` | `string` | `'translateMapping'` | 翻译记录文件名（保存在 localeDir 目录中） |

### i18nImport 配置

支持字符串或对象配置：

```javascript
// 字符串形式（推荐）
i18nImport: '@/utils/i18n'

// 对象形式（高级配置）
i18nImport: {
  path: '@/utils/i18n',    // 导入路径
  type: 'default',        // 导入类型：'default' | 'named' | 'namespace'
  name: 'i18n'            // 导入名称，默认使用 i18nTag
}
```

### 翻译服务配置

**服务名称支持**：支持枚举常量和字符串两种方式，提供灵活性和类型安全：

```javascript
import { TranslationServiceName } from 'i18n-mark';

// ✅ 方式1：使用枚举常量（推荐，有 IDE 自动补全）
translation: {
  service: {
    name: TranslationServiceName.BAIDU,  // 'baidu'
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret'
  }
}

// ✅ 方式2：直接使用字符串（简洁）
translation: {
  service: {
    name: 'baidu',  // 等效于上面的枚举常量
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret'
  }
}

// ✅ 方式3：自定义服务名称
translation: {
  service: {
    name: 'my-custom-service',  // 支持任意字符串
    apiKey: 'your-api-key',
    apiSecret: 'your-api-secret'
  }
}


支持的翻译服务：

#### 百度翻译
```javascript
{
  name: 'BAIDU',
  apiKey: 'your-app-id',
  apiSecret: 'your-secret-key'
}
```

## 🔧 i18n 标签函数

### 变量占位符

模板字符串中的变量会被自动替换为占位符（`a`, `b`, `c` ...）：

```javascript
// 原始代码
const message = i18n`你好，${name}，我叫${myName}`

// 提取结果
{ "你好，{a}，我叫{b}": "你好，{a}，我叫{b}" }
```

### 创建 i18n 函数

```javascript
// 简单示例
function createI18nTag(t) {
  return function (strings, ...values) {
    const template = strings.reduce((prev, cur, i) => 
      prev + `{${String.fromCharCode(97 + i)}}` + cur
    )
    const params = values.reduce((obj, val, i) => {
      obj[String.fromCharCode(97 + i)] = val
      return obj
    }, {})
    return t(template, params)
  }
}

// 使用示例
const i18n = createI18nTag(yourTranslateFunction)
const message = i18n`你好，${name}`
```

## 🔌 Vite 插件

在 Vite 项目中使用插件进行开发时实时转换：

```javascript
// vite.config.js
import { defineConfig } from 'vite'
import { vitePluginI18nMark } from 'i18n-mark/vite'

export default defineConfig({
  plugins: [
    vitePluginI18nMark({
      include: ['src/**/*.{js,ts,vue}'],
      i18nTag: 'i18n',
      i18nImport: '@/utils/i18n'
    })
  ]
})
```

> 📖 **详细文档**：[Vite 插件使用指南](https://github.com/huise513/i18n-mark/blob/main/docs/README_VITE.md)