import { ConfigType } from './shared/types'
import { generateVarName } from './utils'

export { mark } from './mark'
export { extract } from './extract'
export { translate } from './translate'
export { markJsCode } from './mark/mark-js'
export { markVueCode } from './mark/mark-vue'
export { extractFromJsCode } from './extract/extract-js'
export { extractFromVueCode } from './extract/extract-vue'

export { LogMode } from './shared/logger'
export type { MarkConfigType, ExtractConfigType, I18nImportConfig, TranslationOptions, TranslationServiceConfig } from './shared/types'
export { I18nImportType, TranslationServiceName } from './shared/types'

export function defineConfig(config: Partial<ConfigType>) {
  return config
}

/**
 * 创建i18n标签函数，支持Vue-i18n/i18next等t函数
 * @param t (template: string, params: Record<string, any>) => string
 * @returns 
 */
export function createI18nTag(t: (template: string, params: Record<string, any>) => string) {
  return function (temp: string[], ...values: any[]) {
    const template = temp.reduce((prev, cur, index) => `${prev}{${generateVarName(index)}}${cur}`);
    const params = values.reduce((prev, cur, index) => ({ ...prev, [generateVarName(index)]: cur }), {});
    return t(template, params);
  }
}