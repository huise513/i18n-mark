import { extname, isAbsolute } from "node:path";
import { ConfigType, ExtractConfigType, MarkConfigType } from "./types";
import { existFile, getCodeByPath, resolvePath } from "./utils";
import { pathToFileURL } from "node:url";

export const DEFAULT_CONFIG = {
  entry: "./src",
  ignore: ["**/node_modules/**", "**/dist/**"],
  extensions: ["js", "jsx", "ts", "tsx", "vue"],
  staged: false,
  i18nTag: "i18n",
  i18nImportPath: "",
  ignoreComment: "i18n-ignore",
  output: "./src/locale/",
  langs: ["zh", "en"],
  fileMapping: 'fileMapping'
}


export function resolveMarkConfig(config: Partial<MarkConfigType>): ConfigType {
  const mergeConfig = {
    ...DEFAULT_CONFIG,
    ...config
  }
  if (!mergeConfig.entry) {
    throw new Error("Missing required config: entry");
  }
  if (!mergeConfig.i18nTag) {
    throw new Error("Missing required config: i18nTag");
  }
  mergeConfig.entry = resolvePath(mergeConfig.entry);
  return mergeConfig
}

export function resolveExtractConfig(config: Partial<ExtractConfigType>): ConfigType {
  const mergeConfig = {
    ...DEFAULT_CONFIG,
    ...config
  }
  if (!mergeConfig.entry) {
    throw new Error("Missing required config: entry");
  }
  if (!mergeConfig.i18nTag) {
    throw new Error("Missing required config: i18nTag");
  }
  if (!mergeConfig.output) {
    throw new Error("Missing required config: output");
  }
  if (!mergeConfig.langs) {
    throw new Error("Missing required config: langs");
  }
  if (!mergeConfig.fileMapping) {
    throw new Error("Missing required config: fileMapping");
  }
  mergeConfig.entry = resolvePath(mergeConfig.entry);
  mergeConfig.output = resolvePath(mergeConfig.output);
  return mergeConfig
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
      console.warn('not found config file, use default config');
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