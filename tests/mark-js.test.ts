import { describe, it, expect, beforeEach } from 'vitest'
import { markJsCode } from '../src/mark-js'
import { DEFAULT_CONFIG } from '../src/config'
import { I18nImportType } from '../src/types'

describe('mark-js', () => {
  describe('markJsCode', () => {
    it('should mark Chinese string literals', () => {
      const code = `const message = "你好世界";`
      const result = markJsCode(code, DEFAULT_CONFIG) 
      
      expect(result).toBe(`const message = i18n\`你好世界\`;`)
    })

    it('should mark Chinese template literals', () => {
      const code = `const message = \`你好\${name}\`;`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toBe(`const message = i18n\`你好\${name}\`;`)
    })

    it('should mark JSX text content', () => {
      const code = `const element = <div>你好世界</div>;`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toBe(`const element = <div>{i18n\`你好世界\`}</div>;`)
    })

    it('should mark JSX attribute values', () => {
      const code = `const element = <div title="你好">content</div>;`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toBe(`const element = <div title={i18n\`你好\`}>content</div>;`)
    })

    it('should not mark non-Chinese strings', () => {
      const code = `const message = "Hello World";`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toBeUndefined()
    })

    it('should skip strings with ignore comment', () => {
      const code = `// i18n-ignore\nconst message = "你好世界";`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toBeUndefined()
    })

    it('should handle custom i18n tag', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nTag: 't'
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`const message = t\`你好世界\`;`)
    })

    it('should add import when needImport is true', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: '@/utils/i18n'
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import i18n from '@/utils/i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should not add duplicate import', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: '@/utils/i18n'
      }
      
      const code = `import i18n from '@/utils/i18n';\nconst message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import i18n from '@/utils/i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should handle complex JSX with nested elements', () => {
      const code = `
        const component = (
          <div>
            <h1>标题</h1>
            <p>这是一段文字</p>
          </div>
        );
      `
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('{i18n`标题`}')
      expect(result).toContain('{i18n`这是一段文字`}')
    })

    it('should escape special characters in template literals', () => {
      const code = `const message = "包含 \`反引号\` 的文字";`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toBe(`const message = i18n\`包含 \\\`反引号\\\` 的文字\`;`)
    })

    it('should handle template literal with variables', () => {
      const code = `const message = \`你好 \${name}，欢迎\`;`
      const result = markJsCode(code, DEFAULT_CONFIG)

      
      expect(result).toBe(`const message = i18n\`你好 \${name}，欢迎\`;`)
    })

    it('should skip already tagged template literals', () => {
      const code = `const message = i18n\`你好世界\`;`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toBeUndefined()
    })

    it('should handle multiple strings in one file', () => {
      const code = `
        const msg1 = "你好";
        const msg2 = "世界";
        const msg3 = "Hello"; // English, should not be marked
      `
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('i18n`你好`')
      expect(result).toContain('i18n`世界`')
      expect(result).toContain('"Hello"') // Should remain unchanged
    })

    it('should handle JSX expression containers', () => {
      const code = `const element = <div title={\`你好 \${name}\`}>内容</div>;`
      const result = markJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('title={i18n`你好 ${name}`}')
      expect(result).toContain('{i18n`内容`}')
    })

    it('should respect ignoreAttrs for JSX attributes', () => {
      const config = {
        ...DEFAULT_CONFIG,
        ignoreAttrs: ['src', 'href', 'className', 'data-test']
      }
      
      const code = `
        const element = (
          <div>
            <img src="图片路径" alt="图片描述" title="图片标题" />
            <input placeholder="请输入内容" value="默认值" data-test="测试数据" />
            <button onClick={handleClick} className="按钮样式">点击按钮</button>
            <a href="链接地址" target="_blank">链接文本</a>
          </div>
        );
      `
      const result = markJsCode(code, config)
      
      // Should ignore specified attributes
      expect(result).toContain('src="图片路径"') // ignored
      expect(result).toContain('href="链接地址"') // ignored
      expect(result).toContain('className="按钮样式"') // ignored
      expect(result).toContain('data-test="测试数据"') // ignored
      
      // Should transform non-ignored attributes
      expect(result).toContain('alt={i18n`图片描述`}') // transformed
      expect(result).toContain('title={i18n`图片标题`}') // transformed
      expect(result).toContain('placeholder={i18n`请输入内容`}') // transformed
      expect(result).toContain('value={i18n`默认值`}') // transformed
      
      // Should transform JSX text content
      expect(result).toContain('{i18n`点击按钮`}')
      expect(result).toContain('{i18n`链接文本`}')
    })
  })

  describe('i18nImport configuration', () => {
    it('should support string mode (backward compatibility)', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: '@/utils/i18n'
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import i18n from '@/utils/i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should support default import configuration', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: '@/utils/i18n',
          type: I18nImportType.DEFAULT,
          name: 't'
        }
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import t from '@/utils/i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should support named import configuration', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: 'vue-i18n',
          type: I18nImportType.NAMED,
          name: 'useI18n'
        }
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import { useI18n } from 'vue-i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should support namespace import configuration', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: 'vue-i18n',
          type: I18nImportType.NAMESPACE,
          name: 'I18n'
        }
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import * as I18n from 'vue-i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should not add duplicate import for default import', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: '@/utils/i18n',
          type: I18nImportType.DEFAULT,
          name: 'i18n'
        }
      }
      
      const code = `import i18n from '@/utils/i18n';\nconst message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import i18n from '@/utils/i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should not add duplicate import for named import', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: 'vue-i18n',
          type: I18nImportType.NAMED,
          name: 'useI18n'
        }
      }
      
      const code = `import { useI18n } from 'vue-i18n';\nconst message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import { useI18n } from 'vue-i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should not add duplicate import for namespace import', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: 'vue-i18n',
          type: I18nImportType.NAMESPACE,
          name: 'I18n'
        }
      }
      
      const code = `import * as I18n from 'vue-i18n';\nconst message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import * as I18n from 'vue-i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should handle named import with custom name', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: 'vue-i18n',
          type: I18nImportType.NAMED,
          name: 'useI18n'
        }
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import { useI18n } from 'vue-i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should not add import when no Chinese text found', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImport: {
          path: '@/utils/i18n',
          type: I18nImportType.DEFAULT
        }
      }
      
      const code = `const message = "Hello World";`
      const result = markJsCode(code, config)
      
      expect(result).toBeUndefined()
    })

    it('should work with i18nTag and named import', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nTag: 't',
        i18nImport: {
          path: 'vue-i18n',
          type: I18nImportType.NAMED,
          name: 't'
        }
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import { t } from 'vue-i18n';\nconst message = t\`你好世界\`;`)
    })
  })
})