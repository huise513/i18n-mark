import { ConfigType } from "./shared/types";
import { resolveTranslateConfig } from "./config";
import { TranslationManager } from "./translation";
import { logger } from "./shared/logger";

/**
 * 翻译功能主入口
 * @param options 翻译配置选项
 */
export async function translate(options: Partial<ConfigType>) {
  try {
    const resolvedConfig = resolveTranslateConfig(options);
    const manager = new TranslationManager(resolvedConfig);
    
    // 如果设置了强制刷新，则直接刷新翻译文件
    if (resolvedConfig.translation?.refresh) {
      manager.refreshLanguageFiles();
      return;
    }
    
    await manager.translateProject();
  } catch (error) {
    logger.error(`Translation failed: ${error.message}`);
    throw error;
  }
}

/**
 * 增量翻译功能
 * @param options 翻译配置选项
 * @param keys 需要翻译的键数组
 */
export async function translateKeys(options: Partial<ConfigType>, keys: string[]) {
  try {
    const resolvedConfig = resolveTranslateConfig(options);
    const manager = new TranslationManager(resolvedConfig);
    
    await manager.translateKeys(keys);
  } catch (error) {
    logger.error(`Incremental translation failed: ${error.message}`);
    throw error;
  }
}