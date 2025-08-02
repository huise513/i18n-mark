import type { Plugin } from 'vite';
import { Transformer } from './transform';
import type { ResolvedOptions, ViteI18nMarkPluginOptions } from './types';
import { resolveOptions } from './utils';
import { logger } from '../shared/logger';
import { matchFile, toUnixPath, existFile, resolvePath } from '../utils';
import { generateLocaleFiles } from '../extract';
import { translate } from '../translate';

/**
 * Vite i18n插件主入口
 * 在开发环境中动态转换代码而不修改源文件，在构建环境中使用现有的mark和extract功能
 * @param options 插件配置选项
 * @returns Vite插件对象
 */

export default function vitePluginI18nMark(options?: ViteI18nMarkPluginOptions): Plugin {
  let resolvedOptions: ResolvedOptions;
  let currentTransformer: Transformer;
  return {
    name: 'vite-plugin-i18n-mark',
    enforce: 'pre',
    async configResolved(config) {
      resolvedOptions = resolveOptions(options);
      logger.configure(resolvedOptions.log);
      if (resolvedOptions?.enabled !== false) {
        currentTransformer = new Transformer(resolvedOptions);
      }
      resolvedOptions.isProduction = config.isProduction;
      generateLocaleFiles(resolvedOptions);
      
      // 检测并自动执行翻译
      await checkAndAutoTranslate(resolvedOptions);
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
    },

    async generateBundle() {
      // 在生产环境中，等待所有提取和翻译操作完成
      if (resolvedOptions.isProduction && currentTransformer) {
        await currentTransformer.extractQueue.waitForAllOperations();
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
  filePath = toUnixPath(filePath)
  if (options.include && options.include.length > 0) {
    const isIncluded = matchFile(filePath, options.include);
    if (!isIncluded) {
      return false;
    }
  }
  if (options.exclude && options.exclude.length > 0) {
    const isExcluded = matchFile(filePath, options.exclude);
    if (isExcluded) {
      return false;
    }
  }

  return true;
}

/**
 * 检测翻译文件并自动执行翻译
 * @param options 解析后的配置选项
 */
async function checkAndAutoTranslate(options: ResolvedOptions): Promise<void> {
  try {
    // 检查是否配置了翻译服务
    if (!options.translation?.service) {
      return;
    }

    // 检查是否有源语言文件（中文）
    const outputDir = resolvePath(options.localeDir);
    const sourceLangFile = `${outputDir}/zh.json`;
    
    if (!existFile(sourceLangFile)) {
      logger.debug('Source language file (zh.json) not found, skipping auto translation');
      return;
    }

    // 检查是否缺少目标语言文件
    const missingLangs: string[] = [];
    const targetLangs = options.langs.filter(lang => lang !== 'zh');
    
    for (const lang of targetLangs) {
      const langFile = `${outputDir}/${lang}.json`;
      if (!existFile(langFile)) {
        missingLangs.push(lang);
      }
    }

    // 检查translateMapping文件是否存在
    const translateMappingFile = `${outputDir}/${options.translation.translateMapping || 'translateMapping'}.json`;
    const hasTranslateMapping = existFile(translateMappingFile);

    // 如果有缺少的语言文件或者没有translateMapping文件，则执行翻译
    if (missingLangs.length > 0 || !hasTranslateMapping) {
      if (missingLangs.length > 0) {
        logger.info(`🔍 检测到缺少翻译文件: ${missingLangs.join(', ')}.json`);
      }
      if (!hasTranslateMapping) {
        logger.info('🔍 检测到缺少翻译映射文件');
      }
      
      logger.info('🚀 自动执行翻译...');
      
      // 执行翻译
      await translate(options);
      
      logger.success('✅ 自动翻译完成');
    }
  } catch (error) {
    logger.warn(`自动翻译失败: ${error.message}`);
    logger.debug('继续启动开发服务器...');
  }
}

export type { ViteI18nMarkPluginOptions } from './types';