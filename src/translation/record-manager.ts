import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { TranslationRecord } from "../types";
import { resolvePath, writeFileByCode, getCodeByPath, existFile } from "../utils";
import { logger } from "../logger";

/**
 * 翻译记录管理器
 * 负责管理翻译记录文件的读写和状态跟踪
 */
export class TranslationRecordManager {
  private recordFilePath: string;
  private record: TranslationRecord = {};

  constructor(outputDir: string, fileName: string = 'translateMapping') {
    const resolvedOutputDir = resolvePath(outputDir);
    this.recordFilePath = `${resolvedOutputDir}/${fileName}.json`;
    this.load();
  }

  /**
   * 加载翻译记录文件
   */
  load(): TranslationRecord {
    try {
      if (existFile(this.recordFilePath)) {
        const content = getCodeByPath(this.recordFilePath);
        this.record = JSON.parse(content);
        logger.info(`Loaded translation record from ${this.recordFilePath}`);
      } else {
        this.record = {};
        logger.info('Translation record file not found, starting with empty record');
      }
    } catch (error) {
      logger.error(`Failed to load translation record: ${error.message}`);
      this.record = {};
    }
    
    return this.record;
  }

  /**
   * 保存翻译记录文件
   */
  save(record?: TranslationRecord): void {
    if (record) {
      this.record = record;
    }

    try {
      // 确保目录存在
      const dir = dirname(this.recordFilePath);
      if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true });
      }

      // 保存文件
      writeFileByCode(this.recordFilePath, JSON.stringify(this.record, null, 2));
      logger.info(`Saved translation record to ${this.recordFilePath}`);
    } catch (error) {
      logger.error(`Failed to save translation record: ${error.message}`);
      throw error;
    }
  }

  /**
   * 检查指定 key 和语言是否已翻译
   */
  isTranslated(key: string, targetLang: string): boolean {
    return !!(this.record[key] && this.record[key][targetLang]);
  }

  /**
   * 添加翻译结果
   */
  addTranslation(key: string, targetLang: string, translatedText: string): void {
    if (!this.record[key]) {
      this.record[key] = {};
    }
    this.record[key][targetLang] = translatedText;
  }

  /**
   * 批量初始化源语言翻译记录
   */
  initializeSourceTranslations(sourceTexts: Record<string, string>, sourceLang: string = 'zh'): void {
    for (const [key, value] of Object.entries(sourceTexts)) {
      if (!this.record[key]) {
        this.record[key] = {};
      }
      this.record[key][sourceLang] = value;
    }
    logger.info(`Initialized ${Object.keys(sourceTexts).length} source translations for ${sourceLang}`);
  }

  /**
   * 强制更新翻译
   */
  forceUpdateTranslation(key: string, translations: Record<string, string>): void {
    this.record[key] = { ...this.record[key], ...translations };
    logger.info(`Force updated translation for key: ${key}`);
  }

  /**
   * 批量导入翻译
   */
  batchImportTranslations(translations: TranslationRecord): void {
    let importCount = 0;
    
    for (const [key, langTranslations] of Object.entries(translations)) {
      if (!this.record[key]) {
        this.record[key] = {};
      }
      
      for (const [lang, translation] of Object.entries(langTranslations)) {
        if (translation && translation.trim()) {
          this.record[key][lang] = translation;
          importCount++;
        }
      }
    }
    
    logger.info(`Batch imported ${importCount} translations`);
  }

  /**
   * 同步翻译记录到各语言文件
   */
  syncToLanguageFiles(outputDir: string, langs: string[]): void {
    const resolvedOutputDir = resolvePath(outputDir);
    
    // 确保输出目录存在
    if (!existsSync(resolvedOutputDir)) {
      mkdirSync(resolvedOutputDir, { recursive: true });
    }

    for (const lang of langs) {
      const langFilePath = `${resolvedOutputDir}/${lang}.json`;
      
      try {
        // 读取现有语言文件
        let langData: Record<string, string> = {};
        if (existFile(langFilePath)) {
          const content = getCodeByPath(langFilePath);
          langData = JSON.parse(content);
        }

        // 更新语言文件
        let hasChanges = false;
        for (const [key, translations] of Object.entries(this.record)) {
          if (translations[lang] && langData[key] !== translations[lang]) {
            langData[key] = translations[lang];
            hasChanges = true;
          }
        }

        // 保存语言文件
        if (hasChanges) {
          writeFileByCode(langFilePath, JSON.stringify(langData, null, 2));
          logger.info(`Updated language file: ${langFilePath}`);
        }
      } catch (error) {
        logger.error(`Failed to sync language file ${langFilePath}: ${error.message}`);
      }
    }
  }

  /**
   * 获取需要翻译的键列表
   */
  getKeysToTranslate(allKeys: string[], targetLang: string, forceUpdate: boolean = false): string[] {
    if (forceUpdate) {
      return allKeys;
    }
    
    return allKeys.filter(key => !this.isTranslated(key, targetLang));
  }

  /**
   * 获取翻译统计信息
   */
  getTranslationStats(langs: string[]): {
    totalKeys: number;
    translatedKeys: Record<string, number>;
    completionRate: Record<string, number>;
  } {
    const totalKeys = Object.keys(this.record).length;
    const translatedKeys: Record<string, number> = {};
    const completionRate: Record<string, number> = {};

    for (const lang of langs) {
      translatedKeys[lang] = 0;
      
      for (const translations of Object.values(this.record)) {
        if (translations[lang]) {
          translatedKeys[lang]++;
        }
      }
      
      completionRate[lang] = totalKeys > 0 ? translatedKeys[lang] / totalKeys : 0;
    }

    return {
      totalKeys,
      translatedKeys,
      completionRate
    };
  }

  /**
   * 清理无效的翻译记录
   */
  cleanup(validKeys: string[]): void {
    const validKeySet = new Set(validKeys);
    let removedCount = 0;

    for (const key of Object.keys(this.record)) {
      if (!validKeySet.has(key)) {
        delete this.record[key];
        removedCount++;
      }
    }

    if (removedCount > 0) {
      logger.info(`Cleaned up ${removedCount} invalid translation records`);
    }
  }

  /**
   * 获取当前翻译记录
   */
  getRecord(): TranslationRecord {
    return { ...this.record };
  }

  /**
   * 重置翻译记录
   */
  reset(): void {
    this.record = {};
    logger.info('Translation record reset');
  }

  /**
   * 强制刷新所有翻译文件
   * 根据translateMapping中的数据重新生成所有语言文件
   */
  forceRefreshLanguageFiles(outputDir: string, langs: string[]): void {
    const resolvedOutputDir = resolvePath(outputDir);
    
    // 确保输出目录存在
    if (!existsSync(resolvedOutputDir)) {
      mkdirSync(resolvedOutputDir, { recursive: true });
    }

    for (const lang of langs) {
      const langFilePath = `${resolvedOutputDir}/${lang}.json`;
      const langData: Record<string, string> = {};

      // 从翻译记录中提取该语言的所有翻译
      for (const [key, translations] of Object.entries(this.record)) {
        if (translations[lang]) {
          langData[key] = translations[lang];
        }
      }

      try {
        // 强制重写语言文件
        writeFileByCode(langFilePath, JSON.stringify(langData, null, 2));
        logger.info(`Force refreshed language file: ${langFilePath} with ${Object.keys(langData).length} keys`);
      } catch (error) {
        logger.error(`Failed to force refresh language file ${langFilePath}: ${error.message}`);
      }
    }

    logger.info(`Force refreshed all language files for ${langs.length} languages`);
  }
}