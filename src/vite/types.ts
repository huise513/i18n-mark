import type { ExtractBaseType, MarkBaseType } from '../types';

/**
 * Vite i18n插件配置选项
 */
export interface ViteI18nMarkPluginOptions extends MarkBaseType, ExtractBaseType {
  enabled?: boolean;                 // 是否启用插件
  extensions?: string[];                // 支持的文件扩展名
  // 文件过滤
  include?: string[];                 // 包含的文件模式
  exclude?: string[];                 // 排除的文件模式
}

/**
 * 代码转换结果
 */
export interface TransformResult {
  code: string;                       // 转换后的代码
  map?: string;                       // Source map
}