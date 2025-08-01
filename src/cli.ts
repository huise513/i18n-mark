#!/usr/bin/env node
import { Command } from "commander";
import { mark, extract, translate } from "./index";
import { loadConfigFile } from "./config";
import packageJson from "../package.json";

interface CliOptionType {
  config?: string
}

const version = packageJson.version;

async function mergeConfig() {
  const options: CliOptionType = program.opts();
  const config = await loadConfigFile(options.config);
  return config;
}

async function handleMark() {
  mark(await mergeConfig());
}

async function handleExtract() {
  extract(await mergeConfig());
}

async function handleTranslate() {
  translate(await mergeConfig());
}

async function handleAll() {
  const config = await mergeConfig();
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
  .action(handleAll);

program
  .command("mark")
  .description("Mark Chinese strings with i18n tags")
  .option("-c, --config <path>", "Config file path")
  .action(handleMark);

program
  .command("extract")
  .description("Extract i18n strings to JSON")
  .option("-c, --config <path>", "Config file path")
  .action(handleExtract);

program
  .command("translate")
  .description("Translate i18n strings using configured services")
  .action(handleTranslate);

program.parse(process.argv);
