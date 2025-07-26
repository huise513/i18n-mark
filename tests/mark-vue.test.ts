import { describe, it, expect, vi, beforeEach } from 'vitest'
import { markVueCode } from '../src/mark-vue'
import { DEFAULT_CONFIG } from '../src/config'

describe('mark-vue', () => {

  describe('processVueCode', () => {
    it('should mark Chinese text in template', () => {
      const code = `
<template>
  <div>你好世界</div>
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('{{ i18n`你好世界` }}')
    })

    it('should mark Chinese text in attributes', () => {
      const code = `
<template>
  <div title="你好">内容</div>
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain(':title="i18n`你好`"')
      expect(result).toContain('{{ i18n`内容` }}')
    })

    it('should mark Chinese text in script section', () => {
      const code = `
<template>
  <div>{{ message }}</div>
</template>

<script>
export default {
  data() {
    return {
      message: "你好世界"
    }
  }
}
</script>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('message: i18n`你好世界`')
    })

    it('should mark Chinese text in script setup', () => {
      const code = `
<template>
  <div>{{ message }}</div>
</template>

<script setup>
const message = "你好世界"
</script>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('const message = i18n`你好世界`')
    })

    it('should handle v-bind with Chinese strings', () => {
      const code = `
<template>
  <div :title="'你好'">内容</div>
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain(':title="i18n`你好`"')
    })

    it('should handle v-bind with template literals', () => {
      const code = `
<template>
  <div :title="\`你好 \${name}\`">内容</div>
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain(':title="i18n`你好 ${name}`"')
    })

    it('should skip ignored attributes', () => {
      const code = `
<template>
  <div data-test="你好" title="世界">内容</div>
</template>
      `
      const result = markVueCode(code, {
        ...DEFAULT_CONFIG,
        ignoreAttrs: ['data-test']
      })
      
      expect(result).toContain('data-test="你好"') // Should remain unchanged
      expect(result).toContain(':title="i18n`世界`"') // Should be marked
    })

    it('should handle ignore comments in template', () => {
      const code = `
<template>
  <div>
    <!-- i18n-ignore -->
    <span>你好</span>
    <span>世界</span>
  </div>
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('<span>你好</span>') // Should remain unchanged due to comment
      expect(result).toContain('{{ i18n`世界` }}') // Should be marked
    })

    it('should preserve whitespace in text nodes', () => {
      const code = `
<template>
  <div>
    你好世界
  </div>
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      // Should preserve leading and trailing whitespace
      expect(result).toMatch(/\s+\{\{ i18n`你好世界` \}\}\s+/)
    })

    it('should handle complex nested structures', () => {
      const code = `
<template>
  <div>
    <h1>标题</h1>
    <ul>
      <li v-for="item in items" :key="item.id">
        {{ item.name }}
      </li>
    </ul>
    <button @click="handleClick">点击我</button>
  </div>
</template>

<script setup>
const items = [
  { id: 1, name: "项目一" },
  { id: 2, name: "项目二" }
]

function handleClick() {
  alert("按钮被点击了")
}
</script>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('{{ i18n`标题` }}')
      expect(result).toContain('{{ i18n`点击我` }}')
      expect(result).toContain('name: i18n`项目一`')
      expect(result).toContain('name: i18n`项目二`')
      expect(result).toContain('alert(i18n`按钮被点击了`)')
    })

    it('should handle custom i18n tag', () => {
      const code = `
<template>
  <div>你好世界</div>
</template>
      `
      const result = markVueCode(code, {
        ...DEFAULT_CONFIG,
        i18nTag: 't'
      })
      
      expect(result).toContain('{{ t`你好世界` }}')
    })

    it('should handle interpolations with Chinese text', () => {
      const code = `
<template>
  <div>{{ "你好" + name }}</div>
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain('{{ i18n`你好` + name }}')
    })

    it('should handle v-model and other directives', () => {
      const code = `
<template>
  <input v-model="value" placeholder="请输入内容" />
</template>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toContain(':placeholder="i18n`请输入内容`"')
    })

    it('should not mark non-Chinese content', () => {
      const code = `
<template>
  <div>Hello World</div>
</template>

<script>
export default {
  data() {
    return {
      message: "Hello"
    }
  }
}
</script>
      `
      const result = markVueCode(code, DEFAULT_CONFIG)
      
      // Should return the original code unchanged
      expect(result).toBeUndefined()
    })
  })
})