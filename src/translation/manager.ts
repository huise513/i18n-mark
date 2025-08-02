import { ConfigType, TranslationService, TranslationResult, TranslationRecord, TranslateConfigType } from "../shared/types";
import { TranslationServiceFactory } from "./factory";
import { TranslationRecordManager } from "./record-manager";
import { logger } from "../shared/logger";
import { getCodeByPath, existFile, resolvePath, delay } from "../utils";

/**
 * 翻译管理器
 * 负责协调翻译服务、记录管理和批量处理
 */
export class TranslationManager {
  private services: Map<string, TranslationService> = new Map();
  private recordManager: TranslationRecordManager;
  private config: TranslateConfigType;

  constructor(config: TranslateConfigType) {
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

    if (!this.config.translation.service) {
      throw new Error('Translation service must be configured');
    }

    if (!this.config.translation.service.name) {
      throw new Error('Translation service name must be specified');
    }
  }

  /**
   * 初始化翻译服务
   */
  private initializeServices(): void {
    const serviceConfig = this.config.translation!.service;
    try {
      const service = TranslationServiceFactory.create(serviceConfig);
      this.services.set(serviceConfig.name, service);
      logger.file(`Initialized translation service: ${serviceConfig.name}`);
    } catch (error) {
      throw new Error(`Translation service initialization failed: ${error.message}`);
    }
  }

  /**
   * 获取翻译服务
   */
  private getService(serviceName?: string): TranslationService {
    const name = serviceName || this.config.translation!.service.name;
    const service = this.services.get(name);

    if (!service) {
      throw new Error(`Translation service '${name}' not available`);
    }

    return service;
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
      this.config.translation?.update || false
    );
  }

  /**
   * 执行核心翻译逻辑
   * @param keysToTranslate 需要翻译的键数组
   * @param sourceTexts 源文本映射
   * @param sourceLang 源语言
   * @param targetLanguages 目标语言数组
   * @returns 翻译的总数量
   */
  private async executeTranslation(
    keysToTranslate: string[],
    sourceTexts: Record<string, string>,
    sourceLang: string,
    targetLanguages: string[]
  ): Promise<number> {
    let totalTranslated = 0;

    // 翻译到各目标语言
    for (const targetLang of targetLanguages) {
      if (targetLang === sourceLang) {
        continue; // 跳过源语言
      }

      logger.line(`Translating ${keysToTranslate.length} entries to ${targetLang}`);
      
      // 过滤出需要翻译的 key（排除已存在且不需要更新的）
      const filteredKeys = this.recordManager.getKeysToTranslate(
        keysToTranslate,
        targetLang,
        this.config.translation?.update || false
      );

      if (filteredKeys.length === 0) {
        logger.line(`No new translations needed for ${targetLang}`);
        continue;
      }

      const translatedCount = await this.batchTranslate(
        filteredKeys,
        sourceTexts,
        sourceLang,
        targetLang
      );

      totalTranslated += translatedCount;
      logger.line(`Translated ${translatedCount} entries to ${targetLang}`);
    }

    // 保存翻译记录
    this.recordManager.save();

    // 同步到语言文件
    this.recordManager.syncToLanguageFiles(this.config.localeDir, this.config.langs);

    return totalTranslated;
  }

  /**
   * 增量翻译指定的 key 和 text
   * @param entries 需要翻译的条目数组，每个条目包含 key 和 text
   */
  async translateKeys(keys: string[]): Promise<void> {
    if (!keys || keys.length === 0) {
      logger.warn('No keys to translate');
      return;
    }

    logger.info(`Starting incremental translation for ${keys.length} keys`); 
    const sourceLang = 'zh'; // 固定使用中文作为源语言
    const targetLanguages = this.config.langs || [];

    // 构建源文本映射
    const sourceTexts: Record<string, string> = {};
    const keysToTranslate: string[] = [];
    
    for (const key of keys) {
      sourceTexts[key] = key;
      keysToTranslate.push(key);
    }

    // 初始化源语言翻译记录
    for (const key of keysToTranslate) {
      this.recordManager.addTranslation(key, sourceLang, sourceTexts[key]);
    }

    // 执行核心翻译逻辑
    await this.executeTranslation(keysToTranslate, sourceTexts, sourceLang, targetLanguages);

    logger.info('Incremental translation completed');
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
    const allKeysToTranslate: string[] = [];

    // 收集所有需要翻译的 key
    for (const targetLang of targetLangs) {
      const keysToTranslate = this.findKeysToTranslate(languageFiles, targetLang);
      allKeysToTranslate.push(...keysToTranslate);
    }

    // 去重
    const uniqueKeys = [...new Set(allKeysToTranslate)];

    if (uniqueKeys.length === 0) {
      logger.info('No keys to translate');
      return;
    }

    logger.file(`Found ${uniqueKeys.length} unique keys to translate`);

    // 执行核心翻译逻辑
    const totalTranslated = await this.executeTranslation(uniqueKeys, sourceTexts, sourceLang, targetLangs);

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
    const batchSize = 10;
    const batches = this.createBatches(keys, batchSize);
    let translatedCount = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      logger.file(`Processing batch ${i + 1}/${batches.length} (${batch.length} items)`);

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
        await delay(1000);
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
    try {
      const results = await service.batchTranslate(texts, sourceLang, targetLang);
      logger.line(`Translation batch end: ${results.length}个 from ${sourceLang} to ${targetLang} using ${service.name}`);
      return results;
    } catch (error) {
      logger.warn(`Translation  failed: ${error.message}`);
      return texts.map(text => ({
        originalText: text,
        translatedText: text,
        confidence: 0,
        service: service.name
      }));
    }

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
   * 显示翻译统计
   */
  private showTranslationStats(): void {
    const stats = this.recordManager.getTranslationStats(this.config.langs);

    logger.file('\n📊 Translation Statistics:');
    logger.file(`Total keys: ${stats.totalKeys}`);

    for (const lang of this.config.langs) {
      const translated = stats.translatedKeys[lang] || 0;
      const rate = Math.round((stats.completionRate[lang] || 0) * 100);
      logger.line(`${lang}: ${translated}/${stats.totalKeys} (${rate}%)`);
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
  refreshLanguageFiles(): void {
    logger.file('Force refreshing all language files...');
    const outputDir = this.config.localeDir;
    const langs = this.config.langs;

    this.recordManager.forceRefreshLanguageFiles(outputDir, langs);
    logger.file('Force refresh completed.');
  }
}