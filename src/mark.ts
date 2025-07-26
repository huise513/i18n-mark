import { extname } from "node:path";
import { markJsCode } from "./mark-js";
import { markVueCode } from "./mark-vue";
import { MarkCodeOptionType, MarkConfigType } from "./types";
import {
  resolveMarkConfig,
} from "./config";
import { findEntryFilesPath, getCodeByPath, writeFileByCode } from "./utils";
import { logger } from "./logger";

export function mark(config?: Partial<MarkConfigType>) {
  const resolveConfig = resolveMarkConfig(config);
  const files = findEntryFilesPath(resolveConfig);
  logger.info(`Found ${files.length} files to mark`);
  let total = 0
  for (const filePath of files) {
    const marked = markFile(filePath, resolveConfig);
    if (marked) {
      total++;
    }
  }
  logger.success(`✅ Mark completed, Marked ${total} Files`);
}

export function markFile(filePath: string, option: MarkCodeOptionType) {
  logger.fileStart(filePath);
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
    logger.fileProcessed(filePath);
    return true
  } else {
    logger.fileNormal('Process Skip', filePath)
    return false
  }
}