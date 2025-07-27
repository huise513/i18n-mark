import type { Plugin } from 'vite';
import { Transformer } from './transform';
import type { ViteI18nMarkPluginOptions } from './types';
import { resolveOptions } from './utils';
import { extname, relative } from 'node:path';
import micromatch from 'micromatch';
import { logger } from '../logger';

/**
 * Vite i18n插件主入口
 * 在开发环境中动态转换代码而不修改源文件，在构建环境中使用现有的mark和extract功能
 * @param options 插件配置选项
 * @returns Vite插件对象
 */
export function vitePluginI18nMark(options?: ViteI18nMarkPluginOptions): Plugin {
  const resolvedOptions = resolveOptions(options);
  let currentTransformer: Transformer | null = null;
  logger.configure(resolvedOptions.log);
  return {
    name: 'vite-plugin-i18n-mark',
    enforce: 'pre',
    configResolved() {
      if (resolvedOptions?.enabled !== false) {
        currentTransformer = new Transformer(resolvedOptions);
      }
    },

    transform(code, id) {
      const filePath = id.split('?')[0]
      if (!currentTransformer || !shouldTransform(filePath, resolvedOptions)) {
        return null;
      }
      try {
        const result = currentTransformer.transform(code, filePath);
        if (!result) {
          return null;
        }
        return {
          code: result.code,
          map: result.map
        };
      } catch (error) {
        console.error(`[vite-i18n-mark-plugin] Transform error in ${filePath}:`, error);
        return null;
      }
    }
  };
}

/**
 * 检查文件是否需要转换
 * @param id 文件ID
 * @param options 解析后的选项
 * @returns 是否需要转换
 */
function shouldTransform(filePath: string, options: ViteI18nMarkPluginOptions): boolean {
  if (filePath.includes('node_modules')) {
    return false;
  }
  const ext = extname(filePath).slice(1);
  const resolvePath = relative(process.cwd(), filePath)
  const hasValidExtension = options.extensions.some(v => v === ext);
  if (!hasValidExtension) {
    return false;
  }

  if (options.include && options.include.length > 0) {
    const isIncluded = micromatch.isMatch(resolvePath, options.include);
    if (!isIncluded) {
      return false;
    }
  }

  if (options.exclude && options.exclude.length > 0) {
    const isExcluded = micromatch.isMatch(resolvePath, options.exclude);
    if (isExcluded) {
      return false;
    }
  }

  return true;
}

// 导出类型和工具函数
export type { ViteI18nMarkPluginOptions } from './types';
export { resolveOptions } from './utils';

// 默认导出
export default vitePluginI18nMark;
