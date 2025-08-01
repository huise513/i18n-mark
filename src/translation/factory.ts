import { TranslationService, TranslationServiceConfig, TranslationServiceName } from "../types";
import { BaiduTranslateService } from "./services/baidu";
import { TencentTranslateService } from "./services/tencent";

/**
 * 翻译服务工厂
 * 负责创建和管理翻译服务实例
 */
export class TranslationServiceFactory {
  private static services = new Map<TranslationServiceName, typeof BaiduTranslateService>();

  static {
    // 注册内置翻译服务
    TranslationServiceFactory.register(TranslationServiceName.BAIDU, BaiduTranslateService);
    TranslationServiceFactory.register(TranslationServiceName.TENCENT, TencentTranslateService);
  }

  /**
   * 注册翻译服务
   */
  static register(name: TranslationServiceName, serviceClass: any) {
    this.services.set(name, serviceClass);
  }

  /**
   * 创建翻译服务实例
   */
  static create(config: TranslationServiceConfig): TranslationService {
    const ServiceClass = this.services.get(config.name);

    if (!ServiceClass) {
      throw new Error(`Unsupported translation service: ${config.name}`);
    }

    return new ServiceClass(config);
  }

  /**
   * 获取所有支持的服务名称
   */
  static getSupportedServices(): TranslationServiceName[] {
    return Array.from(this.services.keys());
  }

  /**
   * 检查服务是否支持
   */
  static isSupported(name: TranslationServiceName): boolean {
    return this.services.has(name);
  }
}