import {
  ExtractConfigType,
  I18nDiffReport,
  I18nEntity,
  KeyUsageMap,
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

export function extract(options: Partial<ExtractConfigType>) {
  const resolveConfig = resolveExtractConfig(options);
  const filePaths = findEntryFilesPath(resolveConfig);
  extractFiles(filePaths, resolveConfig);
}

export function extractFiles(
  filePaths: string[],
  config: ExtractConfigType
) {
  const entries: I18nEntity[] = [];
  console.log(`Found ${filePaths.length} files to extract`);
  filePaths.forEach((filePath) => {
    const code = getCodeByPath(filePath);
    let fn = extractFromJsCode;
    if (filePath.endsWith(".vue")) {
      fn = extractFromVueCode;
    }
    const list = fn(code, config);
    list.forEach((v) => (v.filePath = filePath));
    entries.push(...list);
    if (list.length) {
      console.log(`Extract ${filePath}: ${list.length} entries`);
    }
  });
  console.log(`find ${entries.length} entries`);
  write2File(entries, config);
}

function write2File(entries: I18nEntity[], config: ExtractConfigType) {
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
  console.log("diff", diff);
  writeFileByCode(groupFilePath, JSON.stringify(groups, null, 2));
  langs.forEach((lang) => {
    let filePath = `${outpath}/${lang}.json`;
    let data: Record<string, string> = {};
    if (existFile(filePath)) {
      const code = getCodeByPath(filePath);
      data = JSON.parse(code);
    } else {
    }
    entries.forEach((v) => {
      data[v.key] = v.text;
    });
    for (const key in diff.removedKeys) {
      Reflect.deleteProperty(data, key);
    }
    writeFileByCode(filePath, JSON.stringify(data, null, 2));
  });
}

function groupEntriesByKey(entries: I18nEntity[]): Record<string, string[]> {
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
  oldKeys: KeyUsageMap,
  newKeys: KeyUsageMap
): I18nDiffReport {
  const allKeys = new Set([...Object.keys(oldKeys), ...Object.keys(newKeys)]);

  const result: I18nDiffReport = {
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