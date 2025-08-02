import { createHash, createHmac } from "node:crypto";
import { BaseTranslationService } from "../base";
import { TranslationResult, UsageLimit, TranslationServiceConfig, TranslationErrorType, TranslationServiceName } from "../../shared/types";
import { logger } from "@/shared/logger";

/**
 * 腾讯翻译服务实现
 * API 文档: https://cloud.tencent.com/document/product/551/15619
 */
export class TencentTranslateService extends BaseTranslationService {
  name = TranslationServiceName.TENCENT;
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
    // 根据腾讯云 API 文档，Action、Version、Region 等通过请求头传递
    const payload = {
      SourceText: text,
      Source: this.mapLanguageCode(from),
      Target: this.mapLanguageCode(to),
      ProjectId: 0
    };

    try {
      const authorization = this.generateAuthorization(payload, timestamp, 'TextTranslate');

      const response = await fetch(`https://${this.endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': authorization,
          'Content-Type': 'application/json',
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

  /**
   * 腾讯翻译批量翻译实现
   * 使用腾讯云 TextTranslateBatch API 进行真正的批量翻译
   */
  async batchTranslate(texts: string[], from: string, to: string): Promise<TranslationResult[]> {


    // 腾讯云批量翻译有字符数限制，单次请求总长度需要低于6000字符
    const maxCharsPerRequest = 5000; // 留一些余量
    const results: TranslationResult[] = [];

    // 将文本分批处理
    const batches = this.splitTextsToBatches(texts, maxCharsPerRequest);

    for (const batch of batches) {
      try {
        const batchResults = await this.translateBatch(batch, from, to);
        results.push(...batchResults);
        // 添加延迟以避免频率限制（5次/秒）
        if (batches.length > 1) {
          await this.delay(200); // 200ms 延迟
        }
      } catch (error) {
        logger.error(`error ${error.message}`);
      }
    }

    return results;
  }

  /**
   * 执行真正的批量翻译请求
   */
  private async translateBatch(texts: string[], from: string, to: string): Promise<TranslationResult[]> {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = {
      SourceTextList: texts,
      Source: this.mapLanguageCode(from),
      Target: this.mapLanguageCode(to),
      ProjectId: 0
    };

    const authorization = this.generateAuthorization(payload, timestamp, 'TextTranslateBatch');

    const response = await fetch(`https://${this.endpoint}`, {
      method: 'POST',
      headers: {
        'Authorization': authorization,
        'Content-Type': 'application/json',
        'Host': this.endpoint,
        'X-TC-Action': 'TextTranslateBatch',
        'X-TC-Timestamp': timestamp.toString(),
        'X-TC-Version': this.version,
        'X-TC-Region': this.region
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.Response.Error) {
      throw new Error(`Tencent API Error: ${data.Response.Error.Message}`);
    }

    const targetTextList = data.Response.TargetTextList || [];

    return texts.map((originalText, index) => ({
      originalText,
      translatedText: targetTextList[index] || originalText,
      confidence: 1.0,
      service: this.name
    }));
  }

  /**
   * 将文本数组按字符数限制分批
   */
  private splitTextsToBatches(texts: string[], maxCharsPerBatch: number): string[][] {
    const batches: string[][] = [];
    let currentBatch: string[] = [];
    let currentBatchChars = 0;

    for (const text of texts) {
      const textLength = text.length;

      // 如果单个文本就超过限制，单独处理
      if (textLength > maxCharsPerBatch) {
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchChars = 0;
        }
        batches.push([text]);
        continue;
      }

      // 如果加入当前文本会超过限制，先保存当前批次
      if (currentBatchChars + textLength > maxCharsPerBatch && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchChars = 0;
      }

      currentBatch.push(text);
      currentBatchChars += textLength;
    }

    // 添加最后一个批次
    if (currentBatch.length > 0) {
      batches.push(currentBatch);
    }

    return batches;
  }

  /**
   * 延迟函数
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
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
   * 参考文档: https://cloud.tencent.com/document/api/213/30654
   */
  private generateAuthorization(payload: any, timestamp: number, action: string = 'TextTranslate'): string {
    const date = new Date(timestamp * 1000).toISOString().substr(0, 10);

    // 步骤 1: 拼接规范请求串
    const httpRequestMethod = 'POST';
    const canonicalUri = '/';
    const canonicalQueryString = '';

    // 按照字典序排列头部，并且必须包含参与签名的所有头部
    const canonicalHeaders = [
      `content-type:application/json`,
      `host:${this.endpoint}`
    ].join('\n') + '\n';

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
      timestamp.toString(),
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