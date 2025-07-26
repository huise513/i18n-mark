import { globSync } from "glob";
import { EntryConfigType } from "./types";
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
  return isAbsolute(relativePath) ? relativePath : resolve(process.cwd(), relativePath);
}

export function getCodeByPath(absolutePath: string) {
  return readFileSync(absolutePath, "utf-8");
}

export function findEntryFilesPath(option: EntryConfigType): string[] {
  if (option.staged) {
    const entry = option.entry;
    const stagedFiles = getStagedFiles();
    const entryFiles = stagedFiles.filter((file) =>
      file.startsWith(entry)
    );
    const relativePaths = entryFiles.map((file) =>
      relative(entry, file)
    );
    const unixRelativePaths = relativePaths.map(toUnixPath);
    const matchedRelativePaths = micromatch(unixRelativePaths, option.ignore);
    const files = unixRelativePaths
      .filter((v) => !matchedRelativePaths.includes(v))
      .map((relativePath) => join(entry, relativePath));
    return files;
  }
  const patterns = option.extensions!.map(
    (ext) => `${option.entry}/**/*.${ext}`
  );
  const files: string[] = [];
  for (const pattern of patterns) {
    const found = globSync(pattern, {
      ignore: option.ignore,
      nodir: true,
    });
    files.push(...found);
  }
  return files;
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