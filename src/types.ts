import { LogMode } from "./logger";

export interface EntryConfigType {
  entry: string;
  ignore?: string[];
  extensions: string[];
  staged: boolean;
  log?: LogMode;
}

export interface MarkConfigType extends EntryConfigType {
  i18nImportPath?: string;
  i18nTag: string;
  ignoreAttrs?: string[];
  ignoreComment: string;
}

export interface ExtractConfigType extends EntryConfigType {
  i18nTag: string;
  output: string;
  langs: string[];
  fileMapping: string;
  placeholder?: [string, string?];
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

export interface MarkCodeOptionType {
  i18nTag: string;
  ignoreAttrs?: string[];
  ignoreComment?: string;
  i18nImportPath?: string;
}

export type ValidateConfigFieldType = (string | ((config: ConfigType) => string | null))