import { extname } from "node:path";
import { markJsCode } from "./mark-js";
import { markVueCode } from "./mark-vue";
import { MarkCodeOptionType, MarkConfigType } from "./types";
import {
  resolveMarkConfig,
} from "./config";
import { findEntryFilesPath, getCodeByPath, writeFileByCode } from "./utils";

export function mark(config?: Partial<MarkConfigType>) {
  const resolveConfig = resolveMarkConfig(config);
  const files = findEntryFilesPath(resolveConfig);
  console.log(`Found ${files.length} files to mark`);
  for (const filePath of files) {
    markFile(filePath, resolveConfig);
  }
  console.log("Mark completed");
}

export function markFile(filePath: string, option: MarkCodeOptionType) {
  const ext = extname(filePath).slice(1);
  const code = getCodeByPath(filePath);
  let newCode = '';
  if (["js", "jsx", "ts", "tsx"].includes(ext)) {
    newCode = markJsCode(code, option);
  } else if (ext === "vue") {
    newCode = markVueCode(code, option);
  }
  if (newCode) {
    writeFileByCode(filePath, newCode);
    console.log(`Mark ${filePath} completed`);
  }
}