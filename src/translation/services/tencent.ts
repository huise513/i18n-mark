import { createHash, createHmac } from "node:crypto";
import { BaseTranslationService } from "../base";
import { TranslationResult, UsageLimit, TranslationServiceConfig, TranslationErrorType } from "../../shared/types";

/**
 * 腾讯翻译服务实现
 * API 文档: https://cloud.tencent.com/document/product/551/15619
 */
export class TencentTranslateService extends BaseTranslationService {
  name = 'tencent';
  private readonly endpoint = 'tmt.tencentcloudapi.com';
  private readonly service = 'tmt';
  private readonly version = '2018-03-21';
  private readonly region = 'ap-beijing';

  constructor(config: TranslationServiceConfig) {
    super(config);
    
    if (!config.apiKey) {
      throw new Error('Tencent translation service requires apiKey (SecretId)');
    }
    if (!config.apiSecret) {
      throw new Error('Tencent translation service requires apiSecret (SecretKey)');
    }
  }

  async translate(text: string, from: string, to: string): Promise<TranslationResult> {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      Action: 'TextTranslate',
      Version: this.version,
      Region: this.region,
      SourceText: text,
      Source: this.mapLanguageCode(from),
      Target: this.mapLanguageCode(to),
      ProjectId: 0
    };

    try {
      const authorization = this.generateAuthorization(payload, timestamp);
      
      const response = await fetch(`https://${this.endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json; charset=utf-8',
          'Host': this.endpoint,
          'X-TC-Action': 'TextTranslate',
          'X-TC-Timestamp': timestamp.toString(),
          'X-TC-Version': this.version,
          'X-TC-Region': this.region
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        await this.handleHttpError(response, text);
      }

      const data = await response.json();
      return this.parseResponse(data, text);
    } catch (error) {
      if (error.type) {
        throw error; // 重新抛出已处理的翻译错误
      }
      this.handleNetworkError(error, text);
    }
  }

  getSupportedLanguages(): string[] {
    return ['zh', 'en', 'ja', 'ko', 'fr', 'de', 'es', 'ru', 'th', 'ar', 'pt', 'it'];
  }

  getUsageLimit(): UsageLimit {
    return {
      requestsPerSecond: 5,
      requestsPerDay: 5000000, // 根据具体套餐而定
      charactersPerRequest: 5000
    };
  }

  /**
   * 生成腾讯云 API 签名
   */
  private generateAuthorization(payload: any, timestamp: number): string {
    const date = new Date(timestamp * 1000).toISOString().substr(0, 10);
    
    // 步骤 1: 拼接规范请求串
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';
    const canonicalHeaders = `content-type:application/json; charset=utf-8\nhost:${this.endpoint}\n`;
    const signedHeaders = 'content-type;host';
    const hashedRequestPayload = createHash('sha256').update(JSON.stringify(payload)).digest('hex');
    
    const canonicalRequest = [
      httpRequestMethod,
      canonicalUri,
      canonicalQueryString,
      canonicalHeaders,
      signedHeaders,
      hashedRequestPayload
    ].join('\n');

    // 步骤 2: 拼接待签名字符串
    const algorithm = 'TC3-HMAC-SHA256';
    const credentialScope = `${date}/${this.service}/tc3_request`;
    const hashedCanonicalRequest = createHash('sha256').update(canonicalRequest).digest('hex');
    
    const stringToSign = [
      algorithm,
      timestamp,
      credentialScope,
      hashedCanonicalRequest
    ].join('\n');

    // 步骤 3: 计算签名
    const secretDate = createHmac('sha256', `TC3${this.config.apiSecret}`).update(date).digest();
    const secretService = createHmac('sha256', secretDate).update(this.service).digest();
    const secretSigning = createHmac('sha256', secretService).update('tc3_request').digest();
    const signature = createHmac('sha256', secretSigning).update(stringToSign).digest('hex');

    // 步骤 4: 拼接 Authorization
    return `${algorithm} Credential=${this.config.apiKey}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`;
  }

  /**
   * 映射语言代码到腾讯翻译支持的格式
   */
  private mapLanguageCode(lang: string): string {
    const mapping: Record<string, string> = {
      'zh': 'zh',
      'en': 'en',
      'ja': 'ja',
      'ko': 'ko',
      'fr': 'fr',
      'de': 'de',
      'es': 'es',
      'ru': 'ru',
      'th': 'th',
      'ar': 'ar',
      'pt': 'pt',
      'it': 'it'
    };
    
    return mapping[lang] || lang;
  }

  /**
   * 解析腾讯翻译 API 响应
   */
  private parseResponse(data: any, originalText: string): TranslationResult {
    // 检查错误
    if (data.Response && data.Response.Error) {
      const error = data.Response.Error;
      throw this.createTranslationError(
        this.getErrorType(error.Code),
        `Tencent API Error: ${error.Message}`,
        originalText,
        data
      );
    }

    // 解析翻译结果
    if (!data.Response || !data.Response.TargetText) {
      throw this.createTranslationError(
        TranslationErrorType.QUALITY_LOW,
        'Invalid translation response format',
        originalText,
        data
      );
    }

    const translatedText = data.Response.TargetText;
    const result: TranslationResult = {
      originalText,
      translatedText,
      confidence: 0.9, // 腾讯翻译不提供置信度，使用默认值
      service: this.name
    };

    return this.validateTranslationQuality(result);
  }

  /**
   * 获取错误类型
   */
  private getErrorType(errorCode: string): TranslationErrorType {
    switch (errorCode) {
      case 'AuthFailure':
      case 'AuthFailure.SignatureExpire':
      case 'AuthFailure.SignatureFailure':
      case 'AuthFailure.TokenFailure':
        return TranslationErrorType.AUTH_ERROR;
      case 'RequestLimitExceeded':
      case 'RequestLimitExceeded.IPLimitExceeded':
        return TranslationErrorType.RATE_LIMIT;
      default:
        return TranslationErrorType.NETWORK_ERROR;
    }
  }
}