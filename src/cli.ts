#!/usr/bin/env node
import { Command } from "commander";
import { mark, extract } from "./index";
import { loadConfigFile, resolveExtractConfig, resolveMarkConfig } from "./config";
import { CliExtractConfigType, CliMarkConfigType } from "./types";
import packageJson from "../package.json";

const version = packageJson.version;

async function mergeConfig(options: CliExtractConfigType | CliMarkConfigType) {
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
  return config;
}

async function handleMark() {
  const options: CliMarkConfigType = program.opts();
  const config = await mergeConfig(options);
  mark(resolveMarkConfig(config));
}

async function handleExtract() {
  const options: CliExtractConfigType = program.opts();
  const config = await mergeConfig(options);
  extract(resolveExtractConfig(config));
}

async function handleAll() {
  const options: CliMarkConfigType & CliExtractConfigType = program.opts();
  const config = await mergeConfig(options);
  mark(resolveMarkConfig(config));
  extract(resolveExtractConfig(config));
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

program.parse(process.argv);
