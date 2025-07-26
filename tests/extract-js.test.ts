import { describe, it, expect, beforeEach } from 'vitest'
import { extractFromJsCode } from '../src/extract-js'
import { DEFAULT_CONFIG } from '../src/config'

describe('extract-js', () => {
  describe('extractFromJsTs', () => {
    it('should extract simple i18n tagged template', () => {
      const code = `const message = i18n\`你好世界\`;`
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        key: '你好世界',
        text: '你好世界',
        variables: [],
        line: 1
      })
    })

    it('should extract i18n tagged template with variables', () => {
      const code = `const message = i18n\`你好 \${name}，欢迎来到 \${place}\`;`
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0]).toEqual({
        key: '你好 {a}，欢迎来到 {b}',
        text: '你好 {a}，欢迎来到 {b}',
        variables: ['a', 'b'],
        line: 1
      })
    })

    it('should extract multiple i18n entries', () => {
      const code = `
        const msg1 = i18n\`你好\`;
        const msg2 = i18n\`世界\`;
        const msg3 = i18n\`欢迎 \${user}\`;
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(3)
      expect(result[0].key).toBe('你好')
      expect(result[1].key).toBe('世界')
      expect(result[2].key).toBe('欢迎 {a}')
      expect(result[2].variables).toEqual(['a'])
    })

    it('should handle custom i18n tag', () => {
     
      
      const code = `const message = t\`你好世界\`;`
      const result = extractFromJsCode(code, {
        ...DEFAULT_CONFIG,
        i18nTag: 't'
      })
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('你好世界')
    })

    it('should not extract non-i18n tagged templates', () => {
      const code = `
        const message1 = \`你好世界\`;
        const message2 = other\`你好世界\`;
        const message3 = "你好世界";
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(0)
    })

    it('should extract from JSX context', () => {
      const code = `
        const component = (
          <div>
            {i18n\`你好世界\`}
            <span title={i18n\`标题\`}>
              {i18n\`内容 \${content}\`}
            </span>
          </div>
        );
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(3)
      expect(result[0].key).toBe('你好世界')
      expect(result[1].key).toBe('标题')
      expect(result[2].key).toBe('内容 {a}')
    })

    it('should handle complex template literals', () => {
      const code = `
        const message = i18n\`
          多行文本
          第二行 \${variable}
          第三行
        \`;
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toContain('多行文本')
      expect(result[0].key).toContain('第二行 {a}')
      expect(result[0].key).toContain('第三行')
      expect(result[0].variables).toEqual(['a'])
    })

    it('should generate correct variable names for multiple variables', () => {
      const code = `
        const msg1 = i18n\`变量1: \${a}, 变量2: \${b}\`;
        const msg2 = i18n\`变量3: \${c}, 变量4: \${d}, 变量5: \${e}\`;
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(2)
      expect(result[0].variables).toEqual(['a', 'b'])
      expect(result[1].variables).toEqual(['c', 'd', 'e'])
    })

    it('should handle nested function calls', () => {
      const code = `
        function getMessage() {
          return i18n\`嵌套函数中的消息\`;
        }
        
        const obj = {
          method() {
            return i18n\`对象方法中的消息\`;
          }
        };
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('嵌套函数中的消息')
      expect(result[1].key).toBe('对象方法中的消息')
    })

    it('should extract line numbers correctly', () => {
      const code = `
// Line 1
const msg1 = i18n\`第一个消息\`; // Line 3
// Line 4
// Line 5
const msg2 = i18n\`第二个消息\`; // Line 6
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(2)
      expect(result[0].line).toBe(3)
      expect(result[1].line).toBe(6)
    })

    it('should handle TypeScript syntax', () => {
      const code = `
        interface Message {
          text: string;
        }
        
        const message: Message = {
          text: i18n\`TypeScript 消息\`
        };
        
        function greet<T>(name: T): string {
          return i18n\`你好 \${name}\`;
        }
      `
      const result = extractFromJsCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('TypeScript 消息')
      expect(result[1].key).toBe('你好 {a}')
    })
  })
})