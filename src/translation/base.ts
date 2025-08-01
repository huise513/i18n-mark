import { TranslationService, TranslationResult, UsageLimit, TranslationError, TranslationErrorType } from "../shared/types";

/**
 * 翻译服务抽象基类
 * 提供通用的错误处理和重试机制
 */
export abstract class BaseTranslationService implements TranslationService {
  abstract name: string;
  protected config: any;

  constructor(config: any) {
    this.config = config;
  }

  abstract translate(text: string, from: string, to: string): Promise<TranslationResult>;
  
  /**
   * 批量翻译实现
   * 默认实现：逐个调用单个翻译方法
   * 子类可以重写以提供更高效的批量翻译
   */
  async batchTranslate(texts: string[], from: string, to: string): Promise<TranslationResult[]> {
    const results: TranslationResult[] = [];
    
    for (const text of texts) {
      try {
        const result = await this.translate(text, from, to);
        results.push(result);
      } catch (error) {
        // 创建失败的翻译结果
        results.push({
          originalText: text,
          translatedText: text, // 翻译失败时返回原文
          confidence: 0,
          service: this.name
        });
      }
    }
    
    return results;
  }

  abstract getSupportedLanguages(): string[];
  abstract getUsageLimit(): UsageLimit;

  /**
   * 创建翻译错误
   */
  protected createTranslationError(
    type: TranslationErrorType,
    message: string,
    originalText?: string,
    details?: any
  ): TranslationError {
    const error = new Error(message) as TranslationError;
    error.type = type;
    error.service = this.name;
    error.originalText = originalText;
    error.details = details;
    return error;
  }

  /**
   * 处理 HTTP 响应错误
   */
  protected async handleHttpError(response: Response, originalText?: string): Promise<never> {
    const responseText = await response.text();
    
    if (response.status === 401 || response.status === 403) {
      throw this.createTranslationError(
        TranslationErrorType.AUTH_ERROR,
        `Authentication failed: ${response.status}`,
        originalText,
        { status: response.status, response: responseText }
      );
    }
    
    if (response.status === 429) {
      throw this.createTranslationError(
        TranslationErrorType.RATE_LIMIT,
        'Rate limit exceeded',
        originalText,
        { status: response.status, response: responseText }
      );
    }
    
    throw this.createTranslationError(
      TranslationErrorType.NETWORK_ERROR,
      `HTTP error: ${response.status}`,
      originalText,
      { status: response.status, response: responseText }
    );
  }

  /**
   * 处理网络错误
   */
  protected handleNetworkError(error: any, originalText?: string): never {
    throw this.createTranslationError(
      TranslationErrorType.NETWORK_ERROR,
      `Network error: ${error.message}`,
      originalText,
      error
    );
  }

  /**
   * 验证翻译结果质量
   */
  protected validateTranslationQuality(result: TranslationResult): TranslationResult {
    // 基本质量检查
    if (!result.translatedText || result.translatedText.trim() === '') {
      throw this.createTranslationError(
        TranslationErrorType.QUALITY_LOW,
        'Empty translation result',
        result.originalText
      );
    }

    // 如果翻译结果与原文完全相同，可能是翻译失败
    if (result.translatedText === result.originalText && result.confidence < 0.5) {
      throw this.createTranslationError(
        TranslationErrorType.QUALITY_LOW,
        'Translation result same as original text',
        result.originalText
      );
    }

    return result;
  }
}