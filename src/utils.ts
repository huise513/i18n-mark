import { globSync } from "glob";
import { FileMatchConfigType } from "./types";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, join, relative, resolve } from "node:path";
import { execSync } from "node:child_process";
import micromatch from "micromatch";
import { logger } from "./logger";

export function hasChinese(str: string) {
  return /[\u4e00-\u9fa5]/.test(str);
}

export function toSafeTemplateLiteral(str: string) {
  let result = "";
  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    const nextChar = i + 1 < str.length ? str[i + 1] : ''
    if (char === "\\" && !['n', 's'].includes(nextChar)) {
      // 处理反斜杠：始终转义为双反斜杠
      result += "\\\\";
    } else if (char === "`") {
      // 转义反引号
      result += "\\`";
    } else if (char === "$" && i + 1 < str.length && str[i + 1] === "{") {
      // 处理 ${ 序列：转义为 \${ 防止插值
      result += "\\${";
      i++; // 跳过下一个字符 '{'
    } else {
      result += char;
    }
  }
  return `\`${result}\``;
}

// 为了保留在元素中的文字原本的格式，需要把前后的空格换行剥离出来
export function splitString(str: string) {
  const regex = /^(\s*)(.*?)(\s*)$/s;
  const match = str.match(regex);
  if (!match) return { leading: "", content: str, trailing: "" };
  const [, leading, content, trailing] = match;
  // 保留内容中的原始空白字符，不进行压缩处理
  return {
    leading,
    content,
    trailing,
  };
}

// 生成变量占位符 (a, b, ..., z, aa, bb, ...)
export function generateVarName(index: number): string {
  const charCode = 97 + (index % 26);
  const repeat = Math.floor(index / 26) + 1;
  return String.fromCharCode(charCode).repeat(repeat);
}

export function writeFileByCode(absolutePath: string, code: string) {
  writeFileSync(absolutePath, code, "utf-8");
}

export function existFile(absolutePath: string) {
  return existsSync(absolutePath);
}

export function resolvePath(relativePath: string) {
  return isAbsolute(relativePath) ? toUnixPath(relativePath) : toUnixPath(resolve(process.cwd(), relativePath));
}

export function getCodeByPath(absolutePath: string) {
  return readFileSync(absolutePath, "utf-8");
}

/**
 * 查找匹配的文件路径
 * 支持新的 include/exclude 模式和 Git 暂存区文件过滤
 */
export function findEntryFilesPath(option: FileMatchConfigType): string[] {
  const includePatterns = option.include || [];
  const excludePatterns = option.exclude || [];
  
  if (option.staged) {
    // Git 暂存区模式：先获取暂存区文件，再应用 include/exclude 过滤
    const stagedFiles = getStagedFiles();
    const unixStagedFiles = stagedFiles.map(toUnixPath);
    
    // 应用 include 模式过滤
    let matchedFiles = unixStagedFiles;
    if (includePatterns.length > 0) {
      matchedFiles = micromatch(unixStagedFiles, includePatterns);
    }
    
    // 应用 exclude 模式过滤
    if (excludePatterns.length > 0) {
      const excludedFiles = micromatch(matchedFiles, excludePatterns);
      matchedFiles = matchedFiles.filter(file => !excludedFiles.includes(file));
    }
    
    return matchedFiles;
  }
  
  // 普通模式：使用 glob 模式匹配文件
  const files: string[] = [];
  
  // 使用 include 模式查找文件
  for (const pattern of includePatterns) {
    const found = globSync(pattern, {
      ignore: excludePatterns,
      nodir: true,
      absolute: true
    });
    files.push(...found);
  }
  
  // 去重并返回
  return [...new Set(files)];
}

export function getStagedFiles() {
  try {
    // 获取暂存区文件列表
    const output = execSync(
      "git diff --cached --name-only --diff-filter=ACMR",
      { encoding: "utf-8" }
    );

    return output
      .split("\n")
      .filter(Boolean)
      .map((file) => resolvePath(file));
  } catch (error) {
    logger.error("Get staged files error: " + String(error));
    return [];
  }
}

export function toUnixPath(filePath: string) {
  return filePath.replace(/\\/g, "/");
}
