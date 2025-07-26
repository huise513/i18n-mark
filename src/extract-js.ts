import { parse } from "@babel/parser";
import traverse from "@babel/traverse";
import { ExtractConfigType, I18nEntryType } from "./types";
import { generateVarName } from "./utils";

export function extractFromJsCode(code: string, config: ExtractConfigType): I18nEntryType[] {
  const ast = parse(code, {
    sourceType: "unambiguous",
    plugins: ["jsx", "typescript"],
  });

  const entries: I18nEntryType[] = [];
  let variableCounter = 0;
  const { i18nTag } = config;

  traverse(ast, {
    TaggedTemplateExpression(path) {
      if (
        path.node.tag.type === "Identifier" &&
        path.node.tag.name === i18nTag
      ) {
        const variables: string[] = [];
        const normalizedText = path.node.quasi.quasis
          .map((quasi, i) => {
            if (i < path.node.quasi.expressions.length) {
              const varName = generateVarName(variableCounter++);
              variables.push(varName);
              return quasi.value.raw + `{${varName}}`;
            }
            return quasi.value.raw;
          })
          .join("");

        entries.push({
          key: normalizedText,
          text: normalizedText,
          variables,
          line: path.node.loc?.start.line || 0,
        });
      }
    },
  });

  return entries;
}