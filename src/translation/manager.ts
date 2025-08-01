import { ConfigType, TranslationService, TranslationResult, TranslationRecord } from "../shared/types";
import { TranslationServiceFactory } from "./factory";
import { TranslationRecordManager } from "./record-manager";
import { logger } from "../shared/logger";
import { getCodeByPath, existFile, resolvePath } from "../utils";

/**
 * 翻译管理器
 * 负责协调翻译服务、记录管理和批量处理
 */
export class TranslationManager {
  private services: Map<string, TranslationService> = new Map();
  private recordManager: TranslationRecordManager;
  private config: ConfigType;

  constructor(config: ConfigType) {
    this.config = config;
    this.validateConfig();
    this.initializeServices();
    this.recordManager = new TranslationRecordManager(
      this.config.localeDir,
      this.config.translation?.translateMapping || 'translateMapping'
    );
  }

  /**
   * 验证配置
   */
  private validateConfig(): void {
    if (!this.config.translation) {
      throw new Error('Translation configuration is required');
    }

    if (!this.config.translation.services || this.config.translation.services.length === 0) {
      throw new Error('At least one translation service must be configured');
    }

    if (!this.config.translation.defaultService) {
      throw new Error('Default translation service must be specified');
    }

    // 验证默认服务是否在服务列表中
    const serviceNames = this.config.translation.services.map(s => s.name);
    if (!serviceNames.includes(this.config.translation.defaultService)) {
      throw new Error(`Default service '${this.config.translation.defaultService}' not found in services list`);
    }
  }

  /**
   * 初始化翻译服务
   */
  private initializeServices(): void {
    for (const serviceConfig of this.config.translation!.services) {
      try {
        const service = TranslationServiceFactory.create(serviceConfig);
        this.services.set(serviceConfig.name, service);
        logger.info(`Initialized translation service: ${serviceConfig.name}`);
      } catch (error) {
        logger.error(`Failed to initialize service ${serviceConfig.name}: ${error.message}`);
      }
    }

    if (this.services.size === 0) {
      throw new Error('No translation services were successfully initialized');
    }
  }

  /**
   * 获取翻译服务
   */
  private getService(serviceName?: string): TranslationService {
    const name = serviceName || this.config.translation!.defaultService;
    const service = this.services.get(name);
    
    if (!service) {
      throw new Error(`Translation service '${name}' not available`);
    }
    
    return service;
  }

  /**
   * 获取备用服务
   */
  private getFallbackService(excludeService: string): TranslationService | null {
    const fallbackServices = this.config.translation?.fallbackServices || [];
    
    for (const serviceName of fallbackServices) {
      if (serviceName !== excludeService && this.services.has(serviceName)) {
        return this.services.get(serviceName)!;
      }
    }
    
    // 如果没有配置备用服务，尝试使用其他可用服务
    for (const [name, service] of this.services) {
      if (name !== excludeService) {
        return service;
      }
    }
    
    return null;
  }

  /**
   * 加载语言文件
   */
  private loadLanguageFiles(): Record<string, Record<string, string>> {
    const languageFiles: Record<string, Record<string, string>> = {};
    const outputDir = resolvePath(this.config.localeDir);

    for (const lang of this.config.langs) {
      const filePath = `${outputDir}/${lang}.json`;
      
      try {
        if (existFile(filePath)) {
          const content = getCodeByPath(filePath);
          languageFiles[lang] = JSON.parse(content);
        } else {
          languageFiles[lang] = {};
          logger.warn(`Language file not found: ${filePath}`);
        }
      } catch (error) {
        logger.error(`Failed to load language file ${filePath}: ${error.message}`);
        languageFiles[lang] = {};
      }
    }

    return languageFiles;
  }

  /**
   * 查找需要翻译的键
   */
  private findKeysToTranslate(languageFiles: Record<string, Record<string, string>>, targetLang: string): string[] {
    const sourceLang = 'zh'; // 固定使用中文作为源语言
    const sourceKeys = Object.keys(languageFiles[sourceLang] || {});
    
    return this.recordManager.getKeysToTranslate(
      sourceKeys,
      targetLang,
      this.config.translation?.forceUpdate || false
    );
  }

  /**
   * 执行翻译项目
   */
  async translateProject(): Promise<void> {
    logger.info('Starting translation project...');
    
    const languageFiles = this.loadLanguageFiles();
    const sourceLang = 'zh'; // 固定使用中文作为源语言
    
    // 验证源语言文件
    if (!languageFiles[sourceLang] || Object.keys(languageFiles[sourceLang]).length === 0) {
      logger.warn(`Source language file (${sourceLang}) is empty or not found`);
      return;
    }

    // 确保源语言的翻译也被记录到translateMapping中
    const sourceTexts = languageFiles[sourceLang];
    this.recordManager.initializeSourceTranslations(sourceTexts, sourceLang);

    const targetLangs = this.config.langs.filter(lang => lang !== sourceLang);
    let totalTranslated = 0;

    for (const targetLang of targetLangs) {
      logger.info(`Translating to ${targetLang}...`);
      
      const keysToTranslate = this.findKeysToTranslate(languageFiles, targetLang);
      
      if (keysToTranslate.length === 0) {
        logger.info(`No keys to translate for ${targetLang}`);
        continue;
      }

      logger.info(`Found ${keysToTranslate.length} keys to translate for ${targetLang}`);
      
      const translatedCount = await this.batchTranslate(
        keysToTranslate,
        languageFiles[sourceLang],
        sourceLang,
        targetLang
      );
      
      totalTranslated += translatedCount;
      logger.info(`Translated ${translatedCount} keys for ${targetLang}`);
    }

    // 保存翻译记录
    this.recordManager.save();
    
    // 同步到语言文件
    this.recordManager.syncToLanguageFiles(this.config.localeDir, this.config.langs);
    
    logger.success(`✅ Translation completed. Total translated: ${totalTranslated} entries`);
    
    // 显示翻译统计
    this.showTranslationStats();
  }

  /**
   * 批量翻译
   */
  private async batchTranslate(
    keys: string[],
    sourceTexts: Record<string, string>,
    sourceLang: string,
    targetLang: string
  ): Promise<number> {
    const batchSize = this.config.translation?.batchSize || 10;
    const batches = this.createBatches(keys, batchSize);
    let translatedCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.fileStart(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);
      
      const batchTexts = batch.map(key => sourceTexts[key]);
      const batchResults = await this.translateBatch(batchTexts, sourceLang, targetLang);
      
      // 保存翻译结果
      for (let j = 0; j < batch.length; j++) {
        const key = batch[j];
        const result = batchResults[j];
        
        if (result && result.translatedText !== result.originalText) {
          this.recordManager.addTranslation(key, targetLang, result.translatedText);
          translatedCount++;
        }
      }
      
      // 添加延迟以避免频率限制
      if (i < batches.length - 1) {
        const delay = this.config.translation?.retryDelay || 1000;
        await this.delay(delay);
      }
    }

    return translatedCount;
  }

  /**
   * 翻译单个批次
   */
  private async translateBatch(
    texts: string[],
    sourceLang: string,
    targetLang: string,
    serviceName?: string
  ): Promise<TranslationResult[]> {
    const service = this.getService(serviceName);
    const retryAttempts = this.config.translation?.retryAttempts || 3;
    logger.info(`Translating batch start: ${texts.length}个 from ${sourceLang} to ${targetLang} using ${service.name}`);
    for (let attempt = 1; attempt <= retryAttempts; attempt++) {
      try {
        const results = await service.batchTranslate(texts, sourceLang, targetLang);
        logger.info(`Translation batch end: ${results.length}个 from ${sourceLang} to ${targetLang} using ${service.name}`);
        return results;
      } catch (error) {
        logger.warn(`Translation attempt ${attempt} failed: ${error.message}`);
        if (attempt === retryAttempts) {
          // 尝试使用备用服务
          const fallbackService = this.getFallbackService(service.name);
          if (fallbackService) {
            logger.info(`Trying fallback service: ${fallbackService.name}`);
            try {
              return await fallbackService.batchTranslate(texts, sourceLang, targetLang);
            } catch (fallbackError) {
              logger.error(`Fallback service also failed: ${fallbackError.message}`);
            }
          }
          
          // 返回失败结果
          logger.error(`All translation attempts failed, returning original texts`);
          return texts.map(text => ({
            originalText: text,
            translatedText: text,
            confidence: 0,
            service: service.name
          }));
        }
        await this.delay(1000 * attempt);
      }
    }
    
    // 不应该到达这里
    return [];
  }

  /**
   * 创建批次
   */
  private createBatches<T>(items: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    
    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 显示翻译统计
   */
  private showTranslationStats(): void {
    const stats = this.recordManager.getTranslationStats(this.config.langs);
    
    logger.info('\n📊 Translation Statistics:');
    logger.info(`Total keys: ${stats.totalKeys}`);
    
    for (const lang of this.config.langs) {
      const translated = stats.translatedKeys[lang] || 0;
      const rate = Math.round((stats.completionRate[lang] || 0) * 100);
      logger.info(`${lang}: ${translated}/${stats.totalKeys} (${rate}%)`);
    }
  }

  /**
   * 获取翻译记录管理器
   */
  getRecordManager(): TranslationRecordManager {
    return this.recordManager;
  }

  /**
   * 获取可用的翻译服务列表
   */
  getAvailableServices(): string[] {
    return Array.from(this.services.keys());
  }

  /**
   * 强制刷新所有翻译文件
   * 根据translateMapping中的数据重新生成所有语言文件
   */
  forceRefreshLanguageFiles(): void {
    logger.info('Force refreshing all language files...');
    const outputDir = this.config.localeDir;
    const langs = this.config.langs;
    
    this.recordManager.forceRefreshLanguageFiles(outputDir, langs);
    logger.info('Force refresh completed.');
  }
}