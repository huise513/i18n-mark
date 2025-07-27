import type { ResolvedOptions, ViteI18nMarkPluginOptions } from './types';
import { DEFAULT_CONFIG } from '../config';

/**
 * 默认插件配置
 */
const DEFAULT_PLUGIN_OPTIONS: ViteI18nMarkPluginOptions = {
  ...DEFAULT_CONFIG,
  enabled: true,
  include: ['src/**/*.{vue,js,ts,jsx,tsx}'],
  exclude: ['node_modules/**', 'dist/**']
};

/**
 * 解析插件配置选项
 * @param options 用户提供的配置选项
 * @returns 解析后的完整配置
 */
export function resolveOptions(options?: ViteI18nMarkPluginOptions): ResolvedOptions {
  const resolved = {
    ...DEFAULT_PLUGIN_OPTIONS,
    ...options,
  } as ResolvedOptions
  return resolved;
}