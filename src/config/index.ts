import { extname, isAbsolute } from "node:path";
import { ConfigType, ExtractConfigType, MarkConfigType, ValidateConfigFieldType } from "../shared/types";
import { existFile, getCodeByPath, resolvePath } from "../utils";
import { pathToFileURL } from "node:url";
import { logger, LogMode } from "../shared/logger";

/**
 * 默认配置
 * 使用 include/exclude 模式进行文件匹配
 */
export const DEFAULT_CONFIG: ConfigType = {
  include: ["src/**/*"],
  exclude: ["**/node_modules/**", "**/dist/**", "**/test/**", "**/tests/**"],
  staged: false,
  i18nTag: "i18n",
  i18nImport: "",
  ignoreComment: "i18n-ignore",
  localeDir: "./src/locale/",
  langs: ["zh", "en"],
  fileMapping: 'fileMapping',
  placeholder: ['{', '}'],
  log: LogMode.FILE,
}

/**
 * 支持的文件类型扩展名
 */
export const SUPPORTED_EXTENSIONS = ['js', 'ts', 'jsx', 'tsx', 'mjs', 'vue'];

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
 * 支持用户自定义文件后缀或使用默认支持的所有扩展名
 */
function resolveFilePatterns(config: Partial<ConfigType>): { include: string[]; exclude: string[] } {
  const ext_str = `.{${SUPPORTED_EXTENSIONS.join(',')}}`
  return {
    include: (config.include || DEFAULT_CONFIG.include).map(v => {
      const resolved = resolvePath(v);
      // 如果路径已经包含文件扩展名（如 *.js, *.{js,ts} 等），则直接使用
      if (resolved.match(/\*\.[*a-zA-Z{},]+$/)) {
        return resolved;
      }
      // 否则添加默认的所有支持扩展名
      return resolved + ext_str;
    }),
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
    mergedConfig.log === 'line' ? LogMode.LINE : LogMode.NONE;
  logger.configure(logMode);

  // 解析路径
  if (mergedConfig.localeDir) {
    mergedConfig.localeDir = resolvePath(mergedConfig.localeDir);
  }

  return mergedConfig;
}

export function resolveMarkConfig(config: Partial<MarkConfigType>): ConfigType {
  return resolveConfig(config, ['i18nTag']);
}

export function resolveExtractConfig(config: Partial<ExtractConfigType>): ConfigType {
  return resolveConfig(config, ['i18nTag', 'localeDir', 'langs', 'fileMapping', (resolveConfig) => {
    const rs = Array.isArray(resolveConfig.placeholder) && resolveConfig.placeholder.length > 0
    return rs ? null : 'placeholder must be array and length > 0'
  }]);
}

export function resolveTranslateConfig(config: Partial<ConfigType>): ConfigType {
  const resolvedConfig = resolveConfig(config, ['localeDir', 'langs', (resolvedConfig) => {
    if (!resolvedConfig.translation) {
      return 'translation config is required for translate command';
    }
    if (!resolvedConfig.translation.services || resolvedConfig.translation.services.length === 0) {
      return 'translation.services must be configured with at least one service';
    }
    if (!resolvedConfig.translation.defaultService) {
      return 'translation.defaultService must be specified';
    }
    return null;
  }]);

  // 设置翻译配置的默认值
  if (resolvedConfig.translation) {
    resolvedConfig.translation = {
      batchSize: 10,
      update: false,
      refresh: false,
      translateMapping: 'translateMapping',
      ...resolvedConfig.translation
    };
  }

  return resolvedConfig;
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