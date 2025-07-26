#!/usr/bin/env node
import { Command } from "commander";
import { mark, extract } from "./index";
import { loadConfigFile, resolveExtractConfig, resolveMarkConfig } from "./config";
import { CliExtractConfigType, CliMarkConfigType } from "./types";

async function handleMark() {
  const options: CliMarkConfigType = program.opts();
  const config = await loadConfigFile(options.config);
  if (options.entry) {
    config.entry = options.entry;
  }
  if (options.staged) {
    config.staged = true;
  }
  mark(resolveMarkConfig(config));
}

async function handleExtract() {
  const options: CliExtractConfigType = program.opts();
  const config = await loadConfigFile(options.config);
  if (options.entry) {
    config.entry = options.entry
  }
  if (options.output) {
    config.output = options.output
  }
  if (options.staged) {
    config.staged = true;
  }
  extract(resolveExtractConfig(config));
}

async function handleAll() {
  const options: CliExtractConfigType = program.opts();
  const config = await loadConfigFile(options.config);
  if (options.entry) {
    config.entry = options.entry
  }
  if (options.output) {
    config.output = options.output
  }
  if (options.staged) {
    config.staged = true;
  }
  await mark(resolveMarkConfig(config));
  await extract(resolveExtractConfig(config));
}

const program = new Command();

program
  .name("i18n-mark")
  .description("Internationalization code processor")
  .version("1.0.0");
  
program
  .option("-c, --config <path>", "Config file path ")
  .option("-e, --entry <path>", "Entry directory path ")
  .option("-o, --output <path>", "Output JSON file path")
  .option("-s, --staged", "Enable only git staged files ")
  .action(handleAll);

program
  .command("mark")
  .option("-c, --config <path>", "Config file path ")
  .option("-e, --entry <path>", "Entry directory path ")
  .option("-s, --staged", "Enable only git staged files ")
  .action(handleMark);

program
  .command("extract")
  .description("Extract i18n strings to JSON")
  .option("-c, --config <path>", "Config file path (JSON)")
  .option("-e, --entry <path>", "Entry directory path")
  .option("-o, --output <path>", "Output JSON file path")
  .option("-s, --staged", "Enable only git staged files")
  .action(handleExtract);

program.parse(process.argv);
