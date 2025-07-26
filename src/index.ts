import { ConfigType } from './types'

export { mark } from './mark'
export { extract } from './extract'
export { markJsCode } from './mark-js'
export { markVueCode } from './mark-vue'
export { extractFromJsCode } from './extract-js'
export { extractFromVueCode } from './extract-vue'
export type { MarkConfigType, ExtractConfigType } from './types'

export function defineConfig(config: Partial<ConfigType>) {
  return config
}