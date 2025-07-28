import { LogMode } from "./logger";

/**
 * 文件匹配配置接口
 * 使用现代的 include/exclude 模式进行文件匹配
 */
export interface FileMatchConfigType {
  include?: string[];                  // 包含的文件模式（glob 模式）
  exclude?: string[];                 // 排除的文件模式（glob 模式）
  staged?: boolean;                    // 是否只处理 Git 暂存区文件
  log?: LogMode;                      // 日志模式
}
/**
 * 标记功能基础配置
 */
export interface MarkBaseType {
  i18nTag: string;                    // i18n 标记函数名
  i18nImport?: string | I18nImportConfig; // i18n 导入配置
  ignoreAttrs?: string[];             // 忽略的属性名
  ignoreComment: string;              // 忽略注释标记
}

/**
 * 标记功能完整配置
 */
export interface MarkConfigType extends FileMatchConfigType, MarkBaseType {
}

/**
 * 提取功能基础配置
 */
export interface ExtractBaseType {
  i18nTag: string;                    // i18n 标记函数名
  output: string;                     // 输出目录
  langs: string[];                    // 支持的语言列表
  fileMapping: string;                // 文件映射配置
  placeholder?: [string, string?];    // 占位符配置
}

/**
 * 提取功能完整配置
 */
export interface ExtractConfigType extends FileMatchConfigType, ExtractBaseType {
}

export type ConfigType = MarkConfigType & ExtractConfigType;

export interface I18nEntryType {
  key: string;
  text: string;
  variables: string[];
  line: number;
  filePath?: string;
}

/**
 * CLI 标记命令配置
 */
export interface CliMarkConfigType {
  include?: string[];                 // 包含的文件模式
  exclude?: string[];                 // 排除的文件模式
  config?: string;                    // 配置文件路径
  staged?: boolean;                   // 是否只处理暂存区文件
}

/**
 * CLI 提取命令配置
 */
export interface CliExtractConfigType {
  include?: string[];                 // 包含的文件模式
  exclude?: string[];                 // 排除的文件模式
  config?: string;                    // 配置文件路径
  output?: string;                    // 输出目录
  staged?: boolean;                   // 是否只处理暂存区文件
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