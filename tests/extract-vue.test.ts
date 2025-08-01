import { describe, it, expect, beforeEach } from 'vitest'
import { extractFromVueCode } from '../src/extract/extract-vue'
import { DEFAULT_CONFIG } from '../src/config'

describe('extract-vue', () => {

  describe('extractFromVue', () => {
    it('should extract from template interpolations', () => {
      const code = `
<template>
  <div>{{ i18n\`你好世界\` }}</div>
</template>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('你好世界')
    })

    it('should extract from template v-bind expressions', () => {
      const code = `
<template>
  <div :title="i18n\`标题文本\`">内容</div>
</template>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('标题文本')
    })

    it('should extract from script section', () => {
      const code = `
<template>
  <div>{{ message }}</div>
</template>

<script>
export default {
  data() {
    return {
      message: i18n\`脚本中的消息\`
    }
  }
}
</script>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('脚本中的消息')
    })

    it('should extract from script setup', () => {
      const code = `
<template>
  <div>{{ message }}</div>
</template>

<script setup>
const message = i18n\`Setup 脚本消息\`
</script>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('Setup 脚本消息')
    })

    it('should extract from both template and script', () => {
      const code = `
<template>
  <div>
    <h1>{{ i18n\`模板标题\` }}</h1>
    <p :title="i18n\`提示文本\`">{{ content }}</p>
  </div>
</template>

<script setup>
const content = i18n\`脚本内容\`
const greeting = i18n\`问候语 \${name}\`
</script>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(4)
      
      const keys = result.map(r => r.key)
      expect(keys).toContain('模板标题')
      expect(keys).toContain('提示文本')
      expect(keys).toContain('脚本内容')
      expect(keys).toContain('问候语 {a}')
    })

    it('should handle complex template expressions', () => {
      const code = `
<template>
  <div>
    <span v-if="showMessage">{{ i18n\`条件消息\` }}</span>
    <ul>
      <li v-for="item in items" :key="item.id">
        {{ i18n\`列表项: \${item.name}\` }}
      </li>
    </ul>
  </div>
</template>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('条件消息')
      expect(result[1].key).toBe('列表项: {a}')
      expect(result[1].variables).toEqual(['a'])
    })

    it('should handle object expressions in directives', () => {
      const code = `
<template>
  <div :style="{ color: 'red' }">
    <span :class="{ active: isActive }">文本</span>
  </div>
</template>

<script setup>
const obj = { message: i18n\`对象中的消息\` }
</script>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(1)
      expect(result[0].key).toBe('对象中的消息')
    })

    it('should extract from nested components', () => {
      const code = `
<template>
  <div>
    <CustomComponent :title="i18n\`组件标题\`">
      <template #header>
        {{ i18n\`插槽标题\` }}
      </template>
      <template #default>
        {{ i18n\`默认插槽内容\` }}
      </template>
    </CustomComponent>
  </div>
</template>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(3)
      
      const keys = result.map(r => r.key)
      expect(keys).toContain('组件标题')
      expect(keys).toContain('插槽标题')
      expect(keys).toContain('默认插槽内容')
    })

    it('should handle both script and script setup', () => {
      const code = `
<template>
  <div>{{ message1 }} {{ message2 }}</div>
</template>

<script>
export default {
  data() {
    return {
      message1: i18n\`普通脚本消息\`
    }
  }
}
</script>

<script setup>
const message2 = i18n\`Setup 脚本消息\`
</script>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(2)
      
      const keys = result.map(r => r.key)
      expect(keys).toContain('普通脚本消息')
      expect(keys).toContain('Setup 脚本消息')
    })

    it('should handle custom i18n tag', () => {
      const code = `
<template>
  <div>{{ t\`自定义标签\` }}</div>
</template>

<script setup>
const message = t\`脚本中的自定义标签\`
</script>
      `
      const result = extractFromVueCode(code, {
        ...DEFAULT_CONFIG,
        i18nTag: 't'
      })
      
      expect(result).toHaveLength(2)
      expect(result[0].key).toBe('自定义标签')
      expect(result[1].key).toBe('脚本中的自定义标签')
    })

    it('should not extract non-i18n tagged content', () => {
      const code = `
<template>
  <div>
    {{ \`普通模板字符串\` }}
    {{ other\`其他标签\` }}
    <span title="普通属性">普通文本</span>
  </div>
</template>

<script setup>
const message = "普通字符串"
const template = \`普通模板字符串\`
</script>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result).toHaveLength(0)
    })

    it('should handle complex mixed content', () => {
      const code = `
<template>
  <div class="container">
    <header>
      <h1>{{ i18n\`页面标题\` }}</h1>
      <nav>
        <a href="#" @click="handleClick">{{ i18n\`导航链接\` }}</a>
      </nav>
    </header>
    
    <main>
      <form @submit="handleSubmit">
        <input 
          v-model="form.name" 
          :placeholder="i18n\`请输入姓名\`"
          :title="i18n\`姓名输入框\`"
        />
        <button type="submit">{{ i18n\`提交按钮\` }}</button>
      </form>
      
      <div v-if="showMessage">
        {{ i18n\`动态消息: \${dynamicContent}\` }}
      </div>
    </main>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const form = ref({
  name: ''
})

const showMessage = ref(false)
const dynamicContent = ref(i18n\`动态内容\`)

function handleClick() {
  alert(i18n\`点击提示\`)
}

function handleSubmit() {
  console.log(i18n\`表单提交: \${form.value.name}\`)
}
</script>
      `
      const result = extractFromVueCode(code, DEFAULT_CONFIG)
      
      expect(result.length).toBeGreaterThan(5)
      
      const keys = result.map(r => r.key)
      expect(keys).toContain('页面标题')
      expect(keys).toContain('导航链接')
      expect(keys).toContain('请输入姓名')
      expect(keys).toContain('姓名输入框')
      expect(keys).toContain('提交按钮')
      expect(keys).toContain('动态消息: {a}')
      expect(keys).toContain('动态内容')
      expect(keys).toContain('点击提示')
      expect(keys).toContain('表单提交: {a}')
    })
  })
})