import { LogMode } from '../shared/logger';
import type { ConfigType } from '../shared/types';

/**
 * Vite 插件基础配置类型
 * 继承标记和提取功能的基础配置
 */
export type BaseConfigType = Partial<Omit<ConfigType, 'staged'>>

/**
 * Vite i18n插件配置选项
 * 继承文件匹配配置，保持与主配置一致
 */
export interface ViteI18nMarkPluginOptions extends BaseConfigType {
  enabled?: boolean;                  // 是否启用插件
  isProduction?: boolean;             // 是否生产环境
}

export type ResolvedOptions  = ViteI18nMarkPluginOptions & Required<BaseConfigType> & {
  log: LogMode;
  isProduction?: boolean;
}


/**
 * 代码转换结果
 */
export interface TransformResult {
  code: string;                       // 转换后的代码
  map?: string;                       // Source map
}