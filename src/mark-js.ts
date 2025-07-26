import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import {
  hasChinese,
  splitString,
  toSafeTemplateLiteral,
} from "./utils";
import { MarkCodeOptionType } from "./types";

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
    let i18nImportAdded = false;

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
      ImportDeclaration(path) {
        if (path.node.source.value === option.i18nImportPath) {
          i18nImportAdded = true;
        }
      },

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
          hasChange = true;
        }
      },

      JSXAttribute(path) {
        if (hasIgnoreComment(path.node)) return;
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

    if (option.i18nImportPath && !i18nImportAdded) {
      modifiedCode = `import ${i18nTag} from '${option.i18nImportPath}';\n${modifiedCode}`;
    }

    return modifiedCode;
  } catch (error) {
    console.error(error);
    console.debug("【code】", code);
  }
}