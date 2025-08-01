# 翻译功能使用示例

## 基本使用

### 1. 配置翻译服务

在 `i18nMark.config.js` 中添加翻译配置：

```javascript
export default {
  // 基础配置
  include: ['src/**/*.{js,ts,vue}'],
  output: './src/locale/',
  langs: ['zh', 'en', 'ja'],
  
  // 翻译配置
  translation: {
    services: [
      {
        name: 'baidu',
        apiKey: 'your-baidu-app-id',
        apiSecret: 'your-baidu-secret-key'
      }
    ],
    defaultService: 'baidu',
    batchSize: 10,
    skipExisting: true,
    translateMapping: 'translateMapping'
  }
}
```

### 2. 准备语言文件

确保源语言文件存在：

```json
// src/locale/zh.json
{
  "你好世界": "你好世界",
  "欢迎使用": "欢迎使用",
  "用户名": "用户名"
}
```

### 3. 执行翻译

```bash
# 使用 CLI 命令
i18n-mark translate

# 或者使用编程方式
import { translate } from 'i18n-mark'

await translate({
  output: './src/locale/',
  langs: ['zh', 'en', 'ja'],
  translation: {
    services: [{ name: 'baidu', apiKey: '...', apiSecret: '...' }],
    defaultService: 'baidu'
  }
})
```

## 高级功能

### 强制更新翻译

```bash
i18n-mark translate --force-update
```

### 指定翻译服务

```bash
i18n-mark translate --service tencent
```

### 批量导入翻译

```bash
i18n-mark translate --import-file translations.xlsx
```

## 翻译记录管理

翻译功能会自动在输出目录中创建 `translateMapping.json` 文件来跟踪翻译状态：

```json
{
  "你好世界": {
    "zh": "你好世界",
    "en": "Hello World",
    "ja": "こんにちは世界"
  },
  "用户名": {
    "zh": "用户名",
    "en": "Username"
  }
}
```

## 完整工作流

```bash
# 1. 标记中文字符串
i18n-mark mark

# 2. 提取到语言文件
i18n-mark extract

# 3. 自动翻译
i18n-mark translate
```

## 注意事项

1. **API 密钥安全**：不要将 API 密钥提交到版本控制系统
2. **频率限制**：注意翻译服务的 API 调用频率限制
3. **翻译质量**：自动翻译结果可能需要人工审核
4. **成本控制**：大量翻译可能产生费用，建议先小规模测试