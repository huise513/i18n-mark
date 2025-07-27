import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import {
  hasChinese,
  splitString,
  toSafeTemplateLiteral,
} from "./utils";
import { MarkCodeOptionType, I18nImportConfig, I18nImportType } from "./types";
import { logger } from "./logger";

/**
 * 规范化i18n导入配置
 * @param option 标记代码选项
 * @returns 规范化后的导入配置
 */
function normalizeI18nImportConfig(option: MarkCodeOptionType): I18nImportConfig | null {
  // 优先使用i18nImport配置
  if (option.i18nImport) {
    if (typeof option.i18nImport === 'string') {
      // 字符串模式，使用默认导入
      return {
        path: option.i18nImport,
        type: I18nImportType.DEFAULT,
        name: option.i18nTag
      };
    } else {
      // 对象模式，直接返回
      return option.i18nImport;
    }
  }

  return null;
}

/**
 * 生成i18n导入语句
 * @param config i18n导入配置
 * @returns 导入语句字符串
 */
function generateI18nImport(config: I18nImportConfig, i18nTag: string): string {
  const { path, type, name } = config;

  switch (type) {
    case I18nImportType.DEFAULT:
      return `import ${name || i18nTag} from '${path}';`;

    case I18nImportType.NAMED:
      const importName = name || i18nTag;
      return `import { ${importName} } from '${path}';`;

    case I18nImportType.NAMESPACE:
      return `import * as ${name || i18nTag} from '${path}';`;

    default:
      return `import ${name || i18nTag} from '${path}';`;
  }
}

/**
 * 检查是否已存在相关导入
 * @param ast AST对象
 * @param config 导入配置
 * @returns 是否已存在导入
 */
function hasExistingImport(ast: any, config: I18nImportConfig): boolean {
  let hasImport = false;

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.source.value === config.path) {
        const specifiers = path.node.specifiers;

        switch (config.type) {
          case I18nImportType.NAMED:
            // 检查是否包含所需的具名导入
            const importName = config.name;
            hasImport = importName ? specifiers.some(spec =>
              spec.type === 'ImportSpecifier' &&
              (spec.imported as any).name === importName
            ) : false;
            break;

          case I18nImportType.DEFAULT:
            // 检查是否有默认导入
            hasImport = specifiers.some(spec => spec.type === 'ImportDefaultSpecifier');
            break;

          case I18nImportType.NAMESPACE:
            // 检查是否有命名空间导入
            hasImport = specifiers.some(spec => spec.type === 'ImportNamespaceSpecifier');
            break;
        }
      }
    }
  });

  return hasImport;
}

export function markJsCode(
  code: string,
  option: MarkCodeOptionType
): string | undefined {
  try {
    const ast = parse(code, {
      sourceType: "unambiguous",
      plugins: ["jsx", "typescript"],
      errorRecovery: false,
    });

    const i18nTag = option.i18nTag;
    // 存储所有需要替换的片段
    const replacements: {
      start: number;
      end: number;
      content: string;
    }[] = [];
    let hasChange = false;

    // 获取规范化的导入配置
    const importConfig = normalizeI18nImportConfig(option);
    let i18nImportAdded = importConfig ? hasExistingImport(ast, importConfig) : true;

    const comments = ast.comments || [];
    const hasIgnoreComment = (node: { start?: number | null; loc?: any }) => {
      if (!option.ignoreComment) {
        return false;
      }
      if (!node.loc || !node.start) return false;

      const nodeLine = node.loc.start.line;
      if (nodeLine <= 1) return false;

      return comments.some((comment) => {
        return (
          comment.loc.end.line === nodeLine - 1 &&
          comment.value.trim() === option.ignoreComment &&
          comment.end! < node.start!
        );
      });
    };
    // 遍历 AST 收集需要替换的位置
    traverse(ast, {

      StringLiteral(path) {
        if (hasIgnoreComment(path.node)) return;
        // 排除 JSX 属性中的字符串字面量（它们会在 JSXAttribute 中单独处理）
        if (
          path.findParent(
            (p) =>
              // jsx中
              p.isJSXAttribute() ||
              // 模板字符串中
              p.isTemplateLiteral() ||
              p.isImportDeclaration() ||
              p.isTSLiteralType() ||
              p.isTSEnumMember()
          )
        ) {
          return;
        }

        if (hasChinese(path.node.value)) {
          const { start, end } = path.node;
          const escapedContent = toSafeTemplateLiteral(path.node.value);
          replacements.push({
            start,
            end,
            content: `${i18nTag}${escapedContent}`,
          });
          logger.codeMatch(path.node.value);
          hasChange = true;
        }
      },

      TemplateLiteral(path) {
        if (hasIgnoreComment(path.node)) return;
        // 跳过已经处理过的模板字符串
        if (
          path.parentPath.isTaggedTemplateExpression() &&
          path.parentPath.node.tag.type === 'Identifier' && path.parentPath.node.tag.name === i18nTag
        ) {
          return;
        }
        // 跳过jsx属性中的模板字符串
        if (path.findParent((p) => p.isJSXAttribute())) {
          return;
        }
        // 检查是否是嵌套模板字符串
        const isNested = path.findParent(
          (p) =>
            p.isTemplateLiteral() ||
            (p.isTaggedTemplateExpression() && p.node.tag.type === 'Identifier' && p.node.tag.name !== i18nTag)
        );

        if (isNested) {
          return; // 跳过嵌套模板
        }

        if (path.node.quasis.some((quasi) => hasChinese(quasi.value.raw))) {
          // 获取完整的模板字符串范围
          const start = path.node.start;
          const end = path.node.end;

          // 直接使用原始代码片段，只添加标签
          const templateContent = code.slice(start, end);
          replacements.push({
            start,
            end,
            content: `${i18nTag}${templateContent}`,
          });
          logger.codeMatch(templateContent);
          hasChange = true;
        }
      },

      JSXText(path) {
        if (hasIgnoreComment(path.node)) return;
        const trimmedValue = path.node.value;
        if (hasChinese(trimmedValue)) {
          const { start, end } = path.node;
          const { leading, content, trailing } = splitString(trimmedValue);
          const escapedContent = toSafeTemplateLiteral(content);
          replacements.push({
            start,
            end,
            content: `${leading}{${i18nTag}${escapedContent}}${trailing}`,
          });
          logger.codeMatch(content);
          hasChange = true;
        }
      },

      JSXAttribute(path) {
        if (hasIgnoreComment(path.node)) return;

        // 检查属性名是否在忽略列表中
        const attrName = path.node.name?.name;
        if (option.ignoreAttrs && attrName && typeof attrName === 'string' && option.ignoreAttrs.includes(attrName)) {
          return;
        }

        // 处理字符串字面量属性
        if (
          path.node.value &&
          path.node.value.type === "StringLiteral" &&
          hasChinese(path.node.value.value)
        ) {
          const valueNode = path.node.value;
          const escapedContent = toSafeTemplateLiteral(valueNode.value);

          // 正确替换整个属性值
          replacements.push({
            start: valueNode.start,
            end: valueNode.end,
            content: `{${i18nTag}${escapedContent}}`,
          });
          logger.codeMatch(valueNode.value);
          hasChange = true;
        }

        // 处理 JSX 属性中的模板字符串
        else if (
          path.node.value &&
          path.node.value.type === "JSXExpressionContainer" &&
          path.node.value.expression.type === "TemplateLiteral"
        ) {
          const templateNode = path.node.value.expression;

          // 关键修复：检查是否是嵌套模板字符串
          const isNested = templateNode.quasis.some(
            (quasi) =>
              quasi.value.raw.includes("`") || quasi.value.raw.includes("${")
          );

          if (isNested) {
            return; // 跳过嵌套模板
          }

          if (
            templateNode.quasis.some((quasi) => hasChinese(quasi.value.raw))
          ) {
            // 获取完整的模板字符串范围
            const start = templateNode.start;
            const end = templateNode.end;

            // 直接使用原始代码片段，只添加标签
            const templateContent = code.slice(start, end);
            replacements.push({
              start,
              end,
              content: `${i18nTag}${templateContent}`,
            });
            logger.codeMatch(templateContent);
            hasChange = true;
          }
        }
      },
    });

    if (!hasChange) return undefined;

    // 按位置从后往前排序，避免替换时位置偏移
    replacements.sort((a, b) => b.start - a.start);

    // 应用所有替换
    let modifiedCode = code;
    for (const replacement of replacements) {
      modifiedCode =
        modifiedCode.slice(0, replacement.start) +
        replacement.content +
        modifiedCode.slice(replacement.end);
    }

    // 添加导入语句（如果需要且尚未存在）
    if (importConfig && !i18nImportAdded) {
      const importStatement = generateI18nImport(importConfig, option.i18nTag);
      modifiedCode = `${importStatement}\n${modifiedCode}`;
    }

    return modifiedCode;
  } catch (error) {
    logger.error("Parse error: " + String(error));
  }
}