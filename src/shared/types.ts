import { LogMode } from "./logger";

export interface ConfigType {
  include: string[];
  exclude: string[];
  staged: boolean;                    // 是否只处理 Git 暂存区文件
  log: LogMode;
  i18nTag: string;                    // i18n 标记函数名
  i18nImport?: string | I18nImportConfig; // i18n 导入配置
  ignoreAttrs?: string[];             // 忽略的属性名
  ignoreComment: string;              // 忽略注释标记
  localeDir: string;                  // 输出目录
  langs: string[];                    // 支持的语言列表
  fileMapping: string;                // 文件映射配置
  placeholder: [string, string?];    // 占位符配置
  translation?: TranslationOptions;
};

type LogConfigType = {
  log?: LogMode;
};

export type FileMatchConfigType = Partial<Pick<ConfigType, 'include' | 'exclude' | 'staged'>>;

export type MarkBaseType = Pick<ConfigType, 'i18nTag' | 'i18nImport' | 'ignoreAttrs' | 'ignoreComment'>;

export type MarkConfigType = FileMatchConfigType & MarkBaseType & LogConfigType;

export type ExtractBaseType = Pick<ConfigType, 'i18nTag' | 'localeDir' | 'langs' | 'fileMapping' | 'placeholder'>;

export type ExtractConfigType = FileMatchConfigType & ExtractBaseType & LogConfigType;

export type TranslateConfigType = Partial<Pick<ConfigType, 'localeDir' | 'langs' | 'translation'>> & LogConfigType;

export interface I18nEntryType {
  key: string;
  text: string;
  variables: string[];
  line: number;
  filePath?: string;
}


export interface KeyUsageMapType {
  [key: string]: string[];
}

export interface I18nDiffReportType {
  addedKeys: KeyUsageMapType;
  removedKeys: KeyUsageMapType;
  unchangedKeys: KeyUsageMapType;
}

// i18n导入类型枚举
export enum I18nImportType {
  DEFAULT = 'default',        // import i18n from 'vue-i18n'
  NAMED = 'named',           // import { useI18n } from 'vue-i18n'
  NAMESPACE = 'namespace',   // import * as i18n from 'vue-i18n'
  // MIXED = 'mixed'           // import i18n, { useI18n } from 'vue-i18n'
}

// i18n导入配置接口
export interface I18nImportConfig {
  path: string;              // 导入路径
  type: I18nImportType;      // 导入类型
  name?: string;             // 导入的变量名或函数名
}

export interface MarkCodeOptionType {
  i18nTag: string;
  ignoreAttrs?: string[];
  ignoreComment?: string;
  // 支持string（兼容性）和对象（新功能）两种模式
  i18nImport?: string | I18nImportConfig;
}

export interface ExtractCodeOptionType {
  i18nTag: string;
  placeholder?: [string, string?];
}

export type ValidateConfigFieldType = (string | ((config: ConfigType) => string | null))

// ==================== 翻译功能相关类型定义 ====================

/**
 * 翻译服务名称枚举
 */
export enum TranslationServiceName {
  BAIDU = 'baidu',
  TENCENT = 'tencent',
  ALIBABA = 'alibaba',
  YOUDAO = 'youdao',
  MOCK = 'mock'
}

/**
 * 翻译服务配置接口
 */
export interface TranslationServiceConfig {
  name: TranslationServiceName;
  apiKey: string;
  apiSecret?: string;
  endpoint?: string;
  options?: Record<string, any>;
}

/**
 * 翻译结果接口
 */
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  confidence: number;
  service: string;
}

/**
 * 翻译服务使用限制接口
 */
export interface UsageLimit {
  requestsPerSecond: number;
  requestsPerDay: number;
  charactersPerRequest: number;
}

/**
 * 翻译服务接口
 */
export interface TranslationService {
  name: string;
  translate(text: string, from: string, to: string): Promise<TranslationResult>;
  batchTranslate(texts: string[], from: string, to: string): Promise<TranslationResult[]>;
  getSupportedLanguages(): string[];
  getUsageLimit(): UsageLimit;
}

/**
 * 翻译记录类型 - 包含源语言翻译
 * 示例: { "你好世界": { "zh": "你好世界", "en": "Hello World", "ja": "こんにちは世界" } }
 */
export type TranslationRecord = Record<string, Record<string, string>>;

/**
 * 翻译配置选项
 */
export interface TranslationOptions {
  // 翻译服务配置
  services: TranslationServiceConfig[];
  defaultService: TranslationServiceName;

  // 文件配置
  translateMapping?: string;  // 翻译记录文件路径，默认 '.i18n-translations.json'
  update?: boolean;  // 默认 false
  refresh?: boolean;  // 强制刷新所有翻译文件

  // 批量导入选项
  // importFile?: string;  // Excel 或 JSON 文件路径
  // importFormat?: 'excel' | 'json';  // 导入格式
}

/**
 * 翻译错误类型枚举
 */
export enum TranslationErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  RATE_LIMIT = 'RATE_LIMIT',
  AUTH_ERROR = 'AUTH_ERROR',
  QUALITY_LOW = 'QUALITY_LOW',
  CONFIG_ERROR = 'CONFIG_ERROR'
}

/**
 * 翻译错误接口
 */
export interface TranslationError extends Error {
  type: TranslationErrorType;
  service?: string;
  originalText?: string;
  details?: any;
}

/**
 * 翻译上下文接口
 */
export interface TranslationContext {
  key: string;
  text: string;
  targetLang: string;
  service: string;
  attempt: number;
}
