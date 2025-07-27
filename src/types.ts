import { LogMode } from "./logger";

export interface EntryConfigType {
  entry: string;
  ignore?: string[];
  extensions: string[];
  staged: boolean;
  log?: LogMode;
}
export interface MarkBaseType {
  i18nTag: string;
  i18nImport?: string | I18nImportConfig;
  ignoreAttrs?: string[];
  ignoreComment: string;
}
export interface MarkConfigType extends EntryConfigType, MarkBaseType {
}
export interface ExtractBaseType {
  i18nTag: string;
  output: string;
  langs: string[];
  fileMapping: string;
  placeholder?: [string, string?];
}
export interface ExtractConfigType extends EntryConfigType, ExtractBaseType {
}

export type ConfigType = MarkConfigType & ExtractConfigType;

export interface I18nEntryType {
  key: string;
  text: string;
  variables: string[];
  line: number;
  filePath?: string;
}

export interface CliMarkConfigType {
  entry?: string;
  config?: string;
  staged?: boolean;
}

export interface CliExtractConfigType {
  entry?: string;
  config?: string;
  output?: string;
  staged?: boolean;
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