import { ConfigType } from "./types";
import { resolveTranslateConfig } from "./config";
import { TranslationManager } from "./translation";
import { logger } from "./logger";

/**
 * 翻译功能主入口
 * @param options 翻译配置选项
 */
export async function translate(options: Partial<ConfigType>) {
  try {
    const resolvedConfig = resolveTranslateConfig(options);
    const manager = new TranslationManager(resolvedConfig);
    
    // 如果设置了强制刷新，则直接刷新翻译文件
    if (resolvedConfig.translation?.forceRefresh) {
      logger.info('Force refresh mode enabled');
      manager.forceRefreshLanguageFiles();
      return;
    }
    
    await manager.translateProject();
  } catch (error) {
    logger.error(`Translation failed: ${error.message}`);
    throw error;
  }
}