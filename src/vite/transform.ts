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

  /**
   * 添加条目到队列
   * @param entries 条目列表
   * @param options 选项
   */
  add(entries: I18nEntryType[], options: ResolvedOptions): void {
    this.queue.push(...entries);
    this.currentOptions = options;
    this.scheduleFlush();
  }

  /**
   * 调度刷新操作
   */
  private scheduleFlush(): void {
    if (this.isProcessing) {
      return;
    }
    
    this.isProcessing = true;
    
    // 使用微任务来确保在当前事件循环结束后执行
    queueMicrotask(() => {
      this.flush();
    });
  }

  /**
   * 刷新队列，统一写入文件
   */
  private flush(): void {
    if (this.queue.length === 0 || !this.currentOptions) {
      this.isProcessing = false;
      return;
    }

    try {
      // 去重处理，避免重复的条目
      const uniqueEntries = this.deduplicateEntries(this.queue);
      writeExtractFile(uniqueEntries, this.currentOptions, false);
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

// 全局队列实例
const extractQueue = new ExtractQueue();

/**
 * 开发环境代码转换器
 * 在内存中转换代码，不修改源文件，同时实时提取国际化数据
 */
export class Transformer {
  private options: ResolvedOptions;

  constructor(options: ResolvedOptions) {
    this.options = options;
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
        extractQueue.add(list, this.options);
      }
    } catch (error) {
      console.error(`[Transformer] Error handling extraction for ${filePath}:`, error);
    }
  }
}