import type {
  ResolvedOptions,
  TransformResult,
} from './types';
import { markJsCode } from '../mark/mark-js';
import { markVueCode } from '../mark/mark-vue';
import { extractCode, writeExtractFile } from '../extract';
import { extname } from 'node:path';
import type { I18nEntryType } from '../shared/types';
import { delay } from '../utils';
import { TranslationManager } from '../translation';

/**
 * 全局提取队列，用于收集所有并发的提取结果
 */
class ExtractQueue {
  private extractEntries: I18nEntryType[] = [];
  private isExtracting = false;
  private isTranslating = false;
  private currentOptions: ResolvedOptions | null = null;
  private pendingOperations: Promise<void>[] = [];
  private translator: TranslationManager;

  constructor(options: ResolvedOptions) {
    this.currentOptions = options;
    this.translator = new TranslationManager(options);
  }

  add(entries: I18nEntryType[]): void {
    this.extractEntries.push(...entries);
    // 开发环境立即处理，生产环境延迟处理以收集更多条目
    if (!this.currentOptions?.isProduction) {
      this.scheduleExtract();
    } else {
      // 生产环境中延迟一小段时间，让更多文件完成transform
      this.scheduleExtractWithDelay();
    }
  }

  private scheduleExtractWithDelay(): void {
    // 使用较短的延迟，确保在transform阶段就能处理完成
    setTimeout(() => {
      if (this.extractEntries.length > 0) {
        this.scheduleExtract();
      }
    }, 50);
  }

  async scheduleExtract(): Promise<void> {
    if (this.isExtracting) {
      await delay(100);
      this.scheduleExtract();
      return;
    }
    this.isExtracting = true;
    queueMicrotask(() => {
      this.extract();
    });
  }

  private extract(): void {
    if (this.extractEntries.length === 0 || !this.currentOptions) {
      this.isExtracting = false;
      return;
    }
    try {
      const uniqueEntries = this.deduplicateEntries(this.extractEntries);
      const keys = writeExtractFile(uniqueEntries, this.currentOptions, this.currentOptions.isProduction);
      this.extractEntries = [];
      this.scheduleTranslate(keys);
    } catch (error) {
      console.error('[ExtractQueue] Error flushing queue:', error);
    } finally {
      this.isExtracting = false;
    }
  }
  async scheduleTranslate(keys: string[]): Promise<void> {
    if (this.isTranslating) {
      await delay(2000);
      return this.scheduleTranslate(keys);
    }
    this.isTranslating = true;
    return await this.translate(keys);
  }
  async translate(keys: string[]): Promise<void> {
    if (!this.currentOptions?.translation) {
      this.isTranslating = false;
      return Promise.resolve();
    }

    // 如果没有待翻译的条目，直接返回
    if (keys.length === 0) {
      this.isTranslating = false;
      return Promise.resolve();
    }

    const translatePromise = this.translator.translateKeys(keys).finally(() => {
      this.isTranslating = false;
      // 从待处理操作中移除已完成的翻译
      const index = this.pendingOperations.indexOf(translatePromise);
      if (index > -1) {
        this.pendingOperations.splice(index, 1);
      }
    });

    // 将翻译操作添加到待处理列表
    this.pendingOperations.push(translatePromise);

    return translatePromise;
  }

  /**
   * 等待所有待处理的操作完成
   * @returns Promise，当所有操作完成时解析
   */
  async waitForAllOperations(): Promise<void> {
    if (this.pendingOperations.length === 0) {
      return Promise.resolve();
    }

    // 等待所有当前的操作完成
    await Promise.allSettled(this.pendingOperations);

    // 递归检查是否有新的操作产生
    if (this.pendingOperations.length > 0) {
      return this.waitForAllOperations();
    }
  }


  /**
   * 去重条目
   * @param entries 条目列表
   * @returns 去重后的条目列表
   */
  private deduplicateEntries(entries: I18nEntryType[]): I18nEntryType[] {
    const seen = new Set<string>();
    return entries.filter(entry => {
      const key = `${entry.key}:${entry.filePath}`;
      if (seen.has(key)) {
        return false;
      }
      seen.add(key);
      return true;
    });
  }


}


/**
 * 开发环境代码转换器
 * 在内存中转换代码，不修改源文件，同时实时提取国际化数据
 */
export class Transformer {
  private options: ResolvedOptions;

  extractQueue: ExtractQueue;

  constructor(options: ResolvedOptions) {
    this.options = options;
    this.extractQueue = new ExtractQueue(options);
  }

  /**
   * 转换代码
   * @param code 源代码
   * @param filePath 文件路径
   * @returns 转换结果
   */
  transform(code: string, filePath: string): TransformResult | null {
    try {
      const result = this.performTransform(code, filePath);
      if (result) {
        this.handleExtraction(filePath, result.code);
      }
      return result;
    } catch (error) {
      console.error(`[Transformer] Error transforming ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 执行实际的代码转换
   * @param code 源代码
   * @param filePath 文件ID
   * @returns 转换结果
   */
  private performTransform(code: string, filePath: string): TransformResult | null {
    try {
      const ext = extname(filePath).slice(1);
      let newCode = '';
      if (["js", "jsx", "ts", "tsx"].includes(ext)) {
        newCode = markJsCode(code, this.options);
      } else if (ext === "vue") {
        newCode = markVueCode(code, this.options);
      }
      if (!newCode) {
        return null;
      }
      return {
        code: newCode
      };
    } catch (error) {
      console.error(`[Transformer] Error in performTransform for ${filePath}:`, error);
      return null;
    }
  }

  /**
   * 处理国际化数据提取
   * @param filePath 文件路径
   * @param code 代码内容
   */
  private handleExtraction(filePath: string, code: string): void {
    try {
      const list = extractCode(code, this.options, filePath);
      if (list.length > 0) {
        this.extractQueue.add(list);
      }
    } catch (error) {
      console.error(`[Transformer] Error handling extraction for ${filePath}:`, error);
    }
  }
}