import type {
  ResolvedOptions,
  TransformResult,
} from './types';
import { markJsCode } from '../mark-js';
import { markVueCode } from '../mark-vue';
import {  extractCode, writeExtractFile } from '../extract';
import { extname } from 'node:path';
import type { I18nEntryType } from '../types';

/**
 * 全局提取队列，用于收集所有并发的提取结果
 */
class ExtractQueue {
  private queue: I18nEntryType[] = [];
  private isProcessing = false;
  private currentOptions: ResolvedOptions | null = null;

  constructor(options: ResolvedOptions) {
    this.currentOptions = options;
  }

  add(entries: I18nEntryType[]): void {
    this.queue.push(...entries);
    // 生产环境 统一处理
    !this.currentOptions.isProduction && this.scheduleFlush();
  }

  
  scheduleFlush(): void {
    if (this.isProcessing) {
      return;
    }
    this.isProcessing = true;
    queueMicrotask(() => {
      this.flush();
    });
  }

  private flush(): void {
    if (this.queue.length === 0 || !this.currentOptions) {
      this.isProcessing = false;
      return;
    }

    try {
      const uniqueEntries = this.deduplicateEntries(this.queue);
      writeExtractFile(uniqueEntries, this.currentOptions, this.currentOptions.isProduction);
      // 清空队列
      this.queue = [];
    } catch (error) {
      console.error('[ExtractQueue] Error flushing queue:', error);
    } finally {
      this.isProcessing = false;
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