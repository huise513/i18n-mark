import { LogMode } from '../logger';
import type { ExtractBaseType, MarkBaseType } from '../types';

export type BaseMarkType = Partial<MarkBaseType> & Partial<ExtractBaseType> 

/**
 * Vite i18n插件配置选项
 */
export interface ViteI18nMarkPluginOptions extends BaseMarkType {
  log?: LogMode;
  enabled?: boolean;                 // 是否启用插件
  extensions?: string[];                // 支持的文件扩展名
  include?: string[];                 // 包含的文件模式
  exclude?: string[];                 // 排除的文件模式
}

export type ResolvedOptions  = ViteI18nMarkPluginOptions & Required<BaseMarkType> & {
  log: LogMode;
  isProduction: boolean;
}


/**
 * 代码转换结果
 */
export interface TransformResult {
  code: string;                       // 转换后的代码
  map?: string;                       // Source map
}