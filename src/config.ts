import { extname, isAbsolute } from "node:path";
import { ConfigType, ExtractConfigType, MarkConfigType, ValidateConfigFieldType } from "./types";
import { existFile, getCodeByPath, resolvePath } from "./utils";
import { pathToFileURL } from "node:url";
import { logger, LogMode } from "./logger";

/**
 * 默认配置
 * 使用 include/exclude 模式进行文件匹配
 */
export const DEFAULT_CONFIG: ConfigType = {
  // 文件匹配配置
  include: ["src/**/*.{js,jsx,ts,tsx,vue}"],
  exclude: ["**/node_modules/**", "**/dist/**", "**/test/**", "**/tests/**"],
  staged: false,
  
  // 功能配置
  i18nTag: "i18n",
  i18nImport: "",
  ignoreComment: "i18n-ignore",
  
  // 提取配置
  output: "./src/locale/",
  langs: ["zh", "en"],
  fileMapping: 'fileMapping',
  placeholder: ['{', '}'],
  
  log: LogMode.FILE,
}


// 通用配置验证函数
function validateRequiredFields(config: any, requiredFields: ValidateConfigFieldType[]): void {
  for (const field of requiredFields) {
    if (typeof field === 'string') {
      if (!config[field]) {
        throw new Error(`Missing required config: ${field}`);
      }
    } else {
      const msg = field(config);
      if (msg) {
        throw new Error(`Missing required config: ${msg}`);
      }
    }
  }
}

/**
 * 解析文件匹配模式
 * 使用 include/exclude 模式进行文件匹配
 */
function resolveFilePatterns(config: Partial<ConfigType>): { include: string[]; exclude: string[] } {
  return {
    include: (config.include || DEFAULT_CONFIG.include).map(v => resolvePath(v)),
    exclude: (config.exclude || DEFAULT_CONFIG.exclude).map(v => resolvePath(v)),
  };
}

// 通用配置解析函数
function resolveConfig(config: Partial<ConfigType>, requiredFields: ValidateConfigFieldType[]): ConfigType {
  const mergedConfig = {
    ...DEFAULT_CONFIG,
    ...config
  };

  // 解析文件匹配模式
  const filePatterns = resolveFilePatterns(mergedConfig);
  mergedConfig.include = filePatterns.include;
  mergedConfig.exclude = filePatterns.exclude;

  validateRequiredFields(mergedConfig, requiredFields);

  // 配置日志系统
  const logMode = mergedConfig.log === 'file' ? LogMode.FILE :
    mergedConfig.log === 'code' ? LogMode.CODE : LogMode.NONE;
  logger.configure(logMode);

  // 解析路径
  if (mergedConfig.output) {
    mergedConfig.output = resolvePath(mergedConfig.output);
  }

  return mergedConfig;
}

export function resolveMarkConfig(config: Partial<MarkConfigType>): ConfigType {
  return resolveConfig(config, ['i18nTag']);
}

export function resolveExtractConfig(config: Partial<ExtractConfigType>): ConfigType {
  return resolveConfig(config, ['i18nTag', 'output', 'langs', 'fileMapping', (resolveConfig) => {
    const rs = Array.isArray(resolveConfig.placeholder) && resolveConfig.placeholder.length > 0
    return rs ? null : 'placeholder must be array and length > 0'
  }]);
}

/**
 * 加载配置文件函数
 * 支持传入路径或自动查找项目目录下的配置文件
 * 支持 json/js/ts 格式
 * @param configPath 配置文件路径（可选，支持相对路径和绝对路径）
 * @returns 解析后的配置对象
 */
export async function loadConfigFile(configPath?: string): Promise<ConfigType> {
  let finalConfigPath: string;

  if (configPath) {
    // 如果传入了路径，解析为绝对路径
    finalConfigPath = isAbsolute(configPath) ? configPath : resolvePath(configPath);

    if (!existFile(finalConfigPath)) {
      throw new Error(`not found config file: ${finalConfigPath}`);
    }
  } else {
    // 如果没有传入路径，自动查找项目目录下的配置文件
    finalConfigPath = findConfigFile();
    if (!finalConfigPath) {
      return DEFAULT_CONFIG
    }
  }

  const ext = extname(finalConfigPath).toLowerCase();

  try {
    switch (ext) {
      case '.json':
        return JSON.parse(getCodeByPath(finalConfigPath));

      case '.js':
      case '.ts':
        // 使用动态导入处理 js/ts 文件
        const fileUrl = pathToFileURL(finalConfigPath).href;
        const module = await import(fileUrl);

        if (!module.default) {
          throw new Error(`not found config file ${finalConfigPath} must use export default export config`);
        }
        return module.default;
      default:
        throw new Error(`not supported config file format: ${ext}，support format: .json, .js, .ts`);
    }
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`load config file failed ${finalConfigPath}: ${error.message}`);
    }
    throw error;
  }
}

/**
 * 查找项目目录下的配置文件
 * 按优先级查找: i18nMark.config.ts > i18nMark.config.js > i18nMark.config.json
 * @returns 找到的配置文件绝对路径，如果没找到返回空字符串
 */
function findConfigFile(): string {
  const configNames = [
    'i18nMark.config.ts',
    'i18nMark.config.js',
    'i18nMark.config.json'
  ];

  for (const configName of configNames) {
    const configPath = resolvePath(configName);
    if (existFile(configPath)) {
      return configPath;
    }
  }

  return '';
}
