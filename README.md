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

## ✨ 特性

- 🎯 **智能识别**：自动识别代码中的中文字符串，无需手动标记
- 📁 **多文件支持**：支持 JS/TS/JSX/TSX/Vue 文件批量处理
- 🚫 **灵活忽略**：支持 `// i18n-ignore` 注释跳过指定代码行
- ⚙️ **配置灵活**：支持 CLI 参数、配置文件和编程式调用
- 🎨 **自定义标记**：可自定义 i18n 函数名和导入路径
- 📋 **Git 集成**：支持只处理 Git 暂存区文件

## 📦 安装

```bash
# 使用 npm
npm i i18n-mark

# 全局安装（CLI使用）
npm i i18n-mark -g
```

## 🚀 快速开始

### CLI 使用

```bash
# 标记中文字符串
i18n-mark mark

# 提取国际化字符串到JSON
i18n-mark extract

# 标记并提取
i18n-mark

# 查看帮助
i18n-mark -h
```

### 编程式使用

```typescript
import { mark, extract } from 'i18n-mark'

// 标记中文字符串
mark({
  entry: './src',
  extensions: ['js', 'ts', 'vue'],
  i18nTag: 'i18n'
})

// 提取国际化字符串
extract({
  entry: './src',
  output: './src/locale',
  langs: ['zh', 'en']
})
```

### 配置文件

创建 `i18n.config.js` 文件：

```javascript
export default {
  entry: './src',
  extensions: ['js', 'ts', 'vue'],
  i18nTag: 't',
  i18nImportPath: '@/utils/i18n',
  ignore: ['**/test/**', '**/node_modules/**'],
}
```

然后使用配置文件：

```bash
i18n-mark -c i18n.config.js
```
## ⚙️ 配置选项

### Mark 配置 (MarkConfigType)

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `entry` | `string` | `'./src'` | 入口目录路径 |
| `ignore` | `string[]` | `['**/node_modules/**', '**/dist/**']` | 忽略的目录和文件模式 |
| `extensions` | `string[]` | `['js', 'jsx', 'ts', 'tsx', 'vue']` | 处理的文件扩展名 |
| `i18nImportPath` | `string` | `undefined` | i18n 函数的导入路径，为空时不导入 |
| `i18nTag` | `string` | `'i18n'` | i18n 标记函数名 |
| `ignoreAttrs` | `string[]` | `[]` | Vue template 中忽略的属性 |
| `ignoreComment` | `string` | `'i18n-ignore'` | 忽略注释标记 |
| `staged` | `boolean` | `false` | 只处理 Git 暂存区文件 |

### Extract 配置 (ExtractConfigType)

| 选项 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `entry` | `string` | `'./src'` | 入口目录路径 |
| `ignore` | `string[]` | `['**/node_modules/**', '**/dist/**']` | 忽略的目录和文件模式 |
| `extensions` | `string[]` | `['js', 'jsx', 'ts', 'tsx', 'vue']` | 处理的文件扩展名 |
| `i18nTag` | `string` | `'i18n'` | i18n 标记函数名 |
| `output` | `string` | `'./src/locale'` | 输出目录路径 |
| `langs` | `string[]` | `['zh', 'en']` | 输出的语言列表 |
| `staged` | `boolean` | `false` | 只处理 Git 暂存区文件 |
| `fileMapping` | `string` | `'fileMapping'` | 文件映射文件名, 用于记录国际化字符串和文件路径的映射关系 |
| `placeholder` | [string, string?] | `['{', '}']` | 占位符格式配置, 默认为`{}` |

## 🔧 i18n 标签函数

### 变量占位符机制

当 `extract` 提取函数遇到包含变量的模板字符串时，变量会被自动替换为占位符：

**占位符命名规则**：`a`, `b`, `c` ... `z`, `aa`, `bb` ...

### 创建兼容的 i18n 函数

为了支持这种占位符机制，你的 i18n 函数需要能够处理模板字符串中的变量替换。

#### Vue-i18n 集成示例

```javascript
import { createI18nTag } from 'i18n-mark'
import { createI18n } from 'vue-i18n'

const vueI18n = createI18n({
  locale: 'zh',
  messages: {
    zh: {
      '你好，{a}，我叫{b}，今年{c}岁': '你好，{a}，我叫{b}，今年{c}岁'
    },
    en: {
      '你好，{a}，我叫{b}，今年{c}岁': 'Hello {a}, my name is {b}, I am {c} years old'
    }
  }
})

const i18n = createI18nTag(vueI18n.global.t)

const name = 'Alice'
const myName = 'Bob' 
const age = 25
const message = i18n`你好，${name}，我叫${myName}，今年${age}岁`
```

#### createI18nTag 函数， 可以参考自行实现
如果你使用其他国际化库，可以参考以下模式创建兼容函数：
```javascript
/**
 * 创建支持模板字符串的 i18n 标签函数
 * @param {Function} t - 翻译函数，如 Vue-i18n 的 $t 函数
 * @returns {Function} 标签模板函数
 */
function createI18nTag(t) {
   return function (temp: string[], ...values: any[]) {
    const template = temp.reduce((prev, cur, index) => `${prev}{${generateVarName(index)}}${cur}`);
    const params = values.reduce((prev, cur, index) => ({ ...prev, [generateVarName(index)]: cur }), {});
    return t(template, params);
  }
}

function generateVarName(index) {
  const charCode = 97 + (index % 26);
  const repeat = Math.floor(index / 26) + 1;
  return String.fromCharCode(charCode).repeat(repeat);
}
```