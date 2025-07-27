import {
  ExtractBaseType,
  ExtractConfigType,
  I18nDiffReportType,
  I18nEntryType,
  KeyUsageMapType,
} from "./types";
import {
  existFile,
  findEntryFilesPath,
  getCodeByPath,
  resolvePath,
  toUnixPath,
  writeFileByCode,
} from "./utils";
import { extractFromJsCode } from "./extract-js";
import { extractFromVueCode } from "./extract-vue";
import { mkdirSync } from "node:fs";
import {
  resolveExtractConfig,
} from "./config";
import { relative } from "node:path";
import { logger } from "./logger";

export function extract(options: Partial<ExtractConfigType>) {
  const resolveConfig = resolveExtractConfig(options);
  const filePaths = findEntryFilesPath(resolveConfig);
  extractFiles(filePaths, resolveConfig);
}

export function extractFiles(
  filePaths: string[],
  config: ExtractConfigType
) {
  const entries: I18nEntryType[] = [];
  logger.info(`Found ${filePaths.length} files to extract`);
  filePaths.forEach((filePath) => {
    const code = getCodeByPath(filePath);
    const list = extractCode(code, config, filePath);
    if (list.length) {
      entries.push(...list);
    }
  });
  writeExtractFile(entries, config);
  logger.success(`✅ Extract completed, found ${entries.length} entries`);
}

export function extractCode(code: string, config: ExtractBaseType, filePath?: string) {
  logger.fileStart(filePath);
  let fn = extractFromJsCode;
  if (filePath.endsWith(".vue")) {
    fn = extractFromVueCode;
  }
  const list = fn(code, config);
  if (list.length) {
    list.forEach((v) => (v.filePath = relative(process.cwd(), filePath)));
    logger.fileProcessed(filePath);
  } else {
    logger.fileNormal('Extract Skip', filePath)
  }
  return list
}

export function writeExtractFile(entries: I18nEntryType[], config: ExtractBaseType, autoRemoveKey = true) {
  if (!entries.length) {
    return
  }
  const { output, langs, fileMapping } = config;
  const outpath = resolvePath(output);
  if (!existFile(outpath)) {
    mkdirSync(outpath, { recursive: true });
  }

  let groupFilePath = `${outpath}/${fileMapping}.json`;
  let oldGroups = {};
  if (existFile(groupFilePath)) {
    oldGroups = JSON.parse(getCodeByPath(groupFilePath));
  }
  const groups = groupEntriesByKey(entries);
  const diff = detectI18NDifferences(oldGroups, groups);

  writeFileByCode(groupFilePath, JSON.stringify(groups, null, 2));
  langs.forEach((lang) => {
    let filePath = `${outpath}/${lang}.json`;
    let data: Record<string, string> = {};
    if (existFile(filePath)) {
      const code = getCodeByPath(filePath);
      data = JSON.parse(code);
    }
    entries.forEach((v) => {
      if (data[v.key]) {
        return
      }
      data[v.key] = v.text;
    });
    if (autoRemoveKey) {
      for (const key in diff.removedKeys) {
        Reflect.deleteProperty(data, key);
      }
    }
    writeFileByCode(filePath, JSON.stringify(data, null, 2));
  });
  logger.codeNormal('Extract Add Keys', `${Object.keys(diff.addedKeys).length}`)
  logger.codeNormal('Extract Remove Keys', `${Object.keys(diff.removedKeys).length}`)
}

function groupEntriesByKey(entries: I18nEntryType[]): Record<string, string[]> {
  return entries.reduce((acc, entry) => {
    if (!entry.filePath) return acc;
    const relativePath = toUnixPath(relative(process.cwd(), entry.filePath));
    if (acc[entry.key]) {
      if (!acc[entry.key].includes(relativePath)) {
        acc[entry.key].push(relativePath);
      }
    } else {
      acc[entry.key] = [relativePath];
    }
    return acc;
  }, {} as Record<string, string[]>);
}

function detectI18NDifferences(
  oldKeys: KeyUsageMapType,
  newKeys: KeyUsageMapType
): I18nDiffReportType {
  const allKeys = new Set([...Object.keys(oldKeys), ...Object.keys(newKeys)]);

  const result: I18nDiffReportType = {
    addedKeys: {},
    removedKeys: {},
    unchangedKeys: {},
  };

  allKeys.forEach((key) => {
    if (!oldKeys[key]) {
      result.addedKeys[key] = newKeys[key];
    } else if (!newKeys[key]) {
      result.removedKeys[key] = oldKeys[key];
    } else {
      result.unchangedKeys[key] = newKeys[key];
    }
  });

  return result;
}