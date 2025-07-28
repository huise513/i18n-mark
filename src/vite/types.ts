import { LogMode } from '../logger';
import type { ExtractBaseType, MarkBaseType, FileMatchConfigType } from '../types';

/**
 * Vite 插件基础配置类型
 * 继承标记和提取功能的基础配置
 */
export type BaseMarkType = Omit<FileMatchConfigType, 'staged'> & Partial<MarkBaseType> & Partial<ExtractBaseType>

/**
 * Vite i18n插件配置选项
 * 继承文件匹配配置，保持与主配置一致
 */
export interface ViteI18nMarkPluginOptions extends BaseMarkType {
  enabled?: boolean;                  // 是否启用插件
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