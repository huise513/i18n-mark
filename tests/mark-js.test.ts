import { describe, it, expect, beforeEach } from 'vitest'
import { markJsCode } from '../src/mark-js'
import { DEFAULT_CONFIG } from '../src/config'

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
        i18nImportPath: '@/utils/i18n'
      }
      
      const code = `const message = "你好世界";`
      const result = markJsCode(code, config)
      
      expect(result).toBe(`import i18n from '@/utils/i18n';\nconst message = i18n\`你好世界\`;`)
    })

    it('should not add duplicate import', () => {
      const config = {
        ...DEFAULT_CONFIG,
        i18nImportPath: '@/utils/i18n'
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
  })
})