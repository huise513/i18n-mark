import type {
  ResolvedOptions,
  TransformResult,
  ViteI18nMarkPluginOptions
} from './types';
import { markJsCode } from '../mark-js';
import { markVueCode } from '../mark-vue';
import {  extractCode, writeExtractFile } from '../extract';
import { extname } from 'node:path';

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
  async transform(code: string, filePath: string): Promise<TransformResult | null> {
    try {
      const result = await this.performTransform(code, filePath);
      if (result) {
        await this.handleExtraction(filePath, result.code);
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
  private async performTransform(code: string, filePath: string): Promise<TransformResult | null> {
    try {
      const ext = extname(filePath).slice(1);
      let newCode = '';
      if (["js", "jsx", "ts", "tsx"].includes(ext)) {
        newCode = markJsCode(code, this.options);
      } else if (ext === "vue") {
        newCode = markVueCode(code, this.options);
      }
      if (!newCode || newCode === code) {
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
   * @param code 代码内容
   */
  private async handleExtraction(filePath: string, code: string): Promise<void> {
    try {
      const list = extractCode(code, this.options, filePath);
      writeExtractFile(list, this.options);
    } catch (error) {
      console.error(`[Transformer] Error handling extraction :`, error);
    }
  }
}