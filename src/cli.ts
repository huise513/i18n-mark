#!/usr/bin/env node
import { Command } from "commander";
import { mark, extract, translate } from "./index";
import { loadConfigFile } from "./config";
import { CliExtractConfigType, CliMarkConfigType, CliTranslateConfigType } from "./shared/types";
import packageJson from "../package.json";

const version = packageJson.version;

async function mergeConfig(options: CliExtractConfigType | CliMarkConfigType | CliTranslateConfigType) {
  const config = await loadConfigFile(options.config);

  if (options.include) {
    config.include = options.include;
  }
  if (options.exclude) {
    config.exclude = options.exclude;
  }
  if ('output' in options && options.output) {
    config.output = options.output;
  }
  if (options.staged) {
    config.staged = true;
  }


  // 翻译特定选项
  if ('update' in options && options.update) {
    if (!config.translation) {
      config.translation = { services: [], defaultService: 'baidu' as any };
    }
    config.translation.forceUpdate = true;
  }
  if ('importFile' in options && options.importFile) {
    if (!config.translation) {
      config.translation = { services: [], defaultService: 'baidu' as any };
    }
    config.translation.importFile = options.importFile;
  }
  if ('service' in options && options.service) {
    if (!config.translation) {
      config.translation = { services: [], defaultService: 'baidu' as any };
    }
    config.translation.defaultService = options.service as any;
  }
  if ('refresh' in options && options.refresh) {
    if (!config.translation) {
      config.translation = { services: [], defaultService: 'baidu' as any };
    }
    config.translation.forceRefresh = true;
  }

  return config;
}

async function handleMark() {
  const options: CliMarkConfigType = program.opts();
  const config = await mergeConfig(options);
  mark(config);
}

async function handleExtract() {
  const options: CliExtractConfigType = program.opts();
  const config = await mergeConfig(options);
  extract(config);
}

async function handleTranslate() {
  const options: CliTranslateConfigType = program.opts();
  
  // 手动检查--refresh参数（修复Commander.js解析问题）
  if (process.argv.includes('--refresh') || process.argv.includes('-r')) {
    options.refresh = true;
  }
  
  const config = await mergeConfig(options);
  translate(config);
}

async function handleAll() {
  const options: CliMarkConfigType & CliExtractConfigType & CliTranslateConfigType = program.opts();
  const config = await mergeConfig(options);
  mark(config);
  extract(config);
  translate(config);
}

const program = new Command();

program
  .name("i18n-mark")
  .description("Internationalization code processor")
  .version(version);

program
  .option("-c, --config <path>", "Config file path")
  .option("-i, --include <patterns...>", "Include file patterns")
  .option("-x, --exclude <patterns...>", "Exclude file patterns")
  .option("-o, --output <path>", "Output JSON file path")
  .option("-s, --staged", "Enable only git staged files")
  .action(handleAll);

program
  .command("mark")
  .description("Mark Chinese strings with i18n tags")
  .option("-c, --config <path>", "Config file path")
  .option("-i, --include <patterns...>", "Include file patterns")
  .option("-x, --exclude <patterns...>", "Exclude file patterns")
  .option("-s, --staged", "Enable only git staged files")
  .action(handleMark);

program
  .command("extract")
  .description("Extract i18n strings to JSON")
  .option("-c, --config <path>", "Config file path")
  .option("-i, --include <patterns...>", "Include file patterns")
  .option("-x, --exclude <patterns...>", "Exclude file patterns")
  .option("-o, --output <path>", "Output JSON file path")
  .option("-s, --staged", "Enable only git staged files")
  .action(handleExtract);

program
  .command("translate")
  .description("Translate i18n strings using configured services")
  .option("-c, --config <path>", "Config file path")
  .option("-i, --include <patterns...>", "Include file patterns")
  .option("-x, --exclude <patterns...>", "Exclude file patterns")
  .option("-o, --output <path>", "Output directory path")
  .option("-s, --staged", "Enable only git staged files")
  .option("-u, --update", "Force update existing translations")
  .option("-r, --refresh", "Force refresh all language files from translateMapping")
  .action(handleTranslate);

program.parse(process.argv);
