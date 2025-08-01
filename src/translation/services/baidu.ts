import { BaseTranslationService } from "../base";
import { TranslationResult, UsageLimit, TranslationServiceConfig, TranslationErrorType } from "../../shared/types";
import { logger } from "../../shared/logger";

/**
 * 百度翻译服务实现
 * API 文档: https://cloud.baidu.com/doc/MT/s/4kqryjku9
 */
export class BaiduTranslateService extends BaseTranslationService {
  name = 'baidu';
  private readonly endpoint = 'https://aip.baidubce.com/rpc/2.0/mt/texttrans/v1';
  private accessToken: string | null = null;
  private tokenExpireTime: number = 0;

  constructor(config: TranslationServiceConfig) {
    super(config);
    if (!config.apiKey) {
      throw new Error('Baidu translation service requires apiKey (API Key)');
    }
    if (!config.apiSecret) {
      throw new Error('Baidu translation service requires apiSecret (Secret Key)');
    }
  }

  async translate(text: string, from: string, to: string): Promise<TranslationResult> {
    // 确保有有效的access_token
    await this.ensureAccessToken();
    const requestBody = {
      q: text,
      from: this.mapLanguageCode(from),
      to: this.mapLanguageCode(to),
      termIds: '' // 术语库ID，暂时为空
    };
    try {
      const response = await fetch(`${this.endpoint}?access_token=${this.accessToken}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody)
      });
      if (!response.ok) {
        await this.handleHttpError(response, text);
      }
      const data = await response.json();
      logger.codeNormal('[Baidu] Translating: ', `"${text}" from ${from} to ${to}`);
      return this.parseResponse(data, text);
    } catch (error) {
      logger.error(`[Baidu] Translation error: "${text}" from ${from} to ${to}: ${error.message}`);
      if (error.type) {
        throw error; // 重新抛出已处理的翻译错误
      }
      this.handleNetworkError(error, text);
    }
  }

  /**
   * 百度翻译批量翻译实现
   * 注意：百度翻译 API 不支持真正的批量翻译，这里仍然是逐个翻译
   */
  async batchTranslate(texts: string[], from: string, to: string): Promise<TranslationResult[]> {
    // 百度翻译有频率限制，添加延迟
    const results: TranslationResult[] = [];

    for (let i = 0; i < texts.length; i++) {
      try {
        const result = await this.translate(texts[i], from, to);
        results.push(result);

        // 添加延迟以避免频率限制
        if (i < texts.length - 1) {
          await this.delay(100); // 100ms 延迟
        }
      } catch (error) {
        results.push({
          originalText: texts[i],
          translatedText: texts[i],
          confidence: 0,
          service: this.name
        });
      }
    }

    return results;
  }

  getSupportedLanguages(): string[] {
    return ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'th', 'ar'];
  }

  getUsageLimit(): UsageLimit {
    return {
      requestsPerSecond: 10,
      requestsPerDay: 1000000, // 根据具体套餐而定
      charactersPerRequest: 6000
    };
  }

  /**
   * 确保有有效的access_token
   */
  private async ensureAccessToken(): Promise<void> {
    const now = Date.now();

    // 如果token不存在或即将过期（提前5分钟刷新）
    if (!this.accessToken || now >= this.tokenExpireTime - 5 * 60 * 1000) {
      await this.refreshAccessToken();
    }
  }

  /**
   * 获取access_token
   */
  private async refreshAccessToken(): Promise<void> {
    const tokenUrl = 'https://aip.baidubce.com/oauth/2.0/token';
    const params = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.config.apiKey,
      client_secret: this.config.apiSecret
    });

    try {
      const response = await fetch(`${tokenUrl}?${params}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to get access token: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      if (data.error) {
        throw new Error(`Access token error: ${data.error_description || data.error}`);
      }

      this.accessToken = data.access_token;
      // expires_in是秒数，转换为毫秒并加上当前时间
      this.tokenExpireTime = Date.now() + (data.expires_in * 1000);

      console.log(`[Baidu] Access token refreshed, expires at: ${new Date(this.tokenExpireTime).toISOString()}`);
    } catch (error) {
      console.error(`[Baidu] Failed to refresh access token:`, error);
      throw error;
    }
  }

  /**
   * 映射语言代码到百度翻译支持的格式
   */
  private mapLanguageCode(lang: string): string {
    const mapping: Record<string, string> = {
      'zh': 'zh',
      'en': 'en',
      'ja': 'jp',
      'ko': 'kor',
      'fr': 'fra',
      'de': 'de',
      'es': 'spa',
      'ru': 'ru',
      'th': 'th',
      'ar': 'ara'
    };

    return mapping[lang] || lang;
  }

  /**
   * 解析百度翻译 API 响应
   */
  private parseResponse(data: any, originalText: string): TranslationResult {
    // 检查错误
    if (data.error_code || data.error_msg) {
      const errorMessage = data.error_msg || this.getErrorMessage(data.error_code);
      throw this.createTranslationError(
        this.getErrorType(data.error_code),
        errorMessage,
        originalText,
        data
      );
    }

    // 新版API的响应格式
    if (data.result && data.result.trans_result && Array.isArray(data.result.trans_result)) {
      const translatedText = data.result.trans_result[0].dst;
      const result: TranslationResult = {
        originalText,
        translatedText,
        confidence: 0.9, // 百度翻译不提供置信度，使用默认值
        service: this.name
      };
      return this.validateTranslationQuality(result);
    }

    // 兼容旧版API响应格式
    if (data.trans_result && Array.isArray(data.trans_result) && data.trans_result.length > 0) {
      const translatedText = data.trans_result[0].dst;
      const result: TranslationResult = {
        originalText,
        translatedText,
        confidence: 0.9,
        service: this.name
      };
      return this.validateTranslationQuality(result);
    }

    throw this.createTranslationError(
      TranslationErrorType.QUALITY_LOW,
      'Invalid translation response format',
      originalText,
      data
    );
  }

  /**
   * 获取错误类型
   */
  private getErrorType(errorCode: string): TranslationErrorType {
    switch (errorCode) {
      case '52001':
      case '52002':
      case '52003':
        return TranslationErrorType.AUTH_ERROR;
      case '54003':
      case '54005':
        return TranslationErrorType.RATE_LIMIT;
      default:
        return TranslationErrorType.NETWORK_ERROR;
    }
  }

  /**
   * 获取错误消息
   */
  private getErrorMessage(errorCode: string): string {
    const messages: Record<string, string> = {
      '52001': 'Request timeout',
      '52002': 'System error',
      '52003': 'Unauthorized user',
      '54000': 'Required parameter is null',
      '54001': 'Invalid signature',
      '54003': 'Access frequency limited',
      '54004': 'Account balance is insufficient',
      '54005': 'Long query requests frequently',
      '58000': 'Client IP illegal',
      '58001': 'Translation language direction not supported',
      '58002': 'Service is down',
      '90107': 'Authentication failed'
    };

    return messages[errorCode] || `Unknown error: ${errorCode}`;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}