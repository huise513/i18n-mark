import {
  ElementNode,
  NodeTypes,
  TemplateChildNode,
} from "@vue/compiler-core";
import { ExtractConfigType, I18nEntity } from "./types";
import { parse } from "@vue/compiler-sfc";
import { extractFromJsCode } from "./extract-js";

export function extractFromVueCode(code: string, config: ExtractConfigType): I18nEntity[] {
  const entries: I18nEntity[] = [];
  const result = parse(code);
  let { template, script, scriptSetup } = result.descriptor;

  if (template?.ast) {
    handlerTemplateAstNodes(template.ast.children, entries, config);
  }
  if (script) {
    entries.push(...extractFromJsCode(script.loc.source, config));
  }
  if (scriptSetup) {
    entries.push(...extractFromJsCode(scriptSetup.loc.source, config));
  }
  return entries;
}

function handlerTemplateAstNodes(
  astNodes: TemplateChildNode[],
  entries: I18nEntity[],
  config: ExtractConfigType
) {
  for (let i = 0; i < astNodes.length; i++) {
    const node = astNodes[i];
    handlerTemplateAst(node, entries, config);
  }
}

function handlerTemplateAst(astNode: TemplateChildNode, entries: I18nEntity[], config: ExtractConfigType) {
  switch (astNode.type) {
    case NodeTypes.ELEMENT:
      const { props, children } = astNode;
      if (props?.length) {
        handleElementProps(props, entries, config);
      }
      if (children?.length) {
        handlerTemplateAstNodes(children, entries, config);
      }
      break;
    case NodeTypes.INTERPOLATION:
      entries.push(...extractFromJsCode(astNode.loc.source, config));
      break;
  }
}

function handleElementProps(props: ElementNode["props"], entries: I18nEntity[], config: ExtractConfigType) {
  for (let i = 0; i < props.length; i++) {
    const prop = props[i];
    switch (prop.type) {
      case NodeTypes.DIRECTIVE:
        const { exp } = prop;
        if (exp) {
          switch (exp.type) {
            case NodeTypes.SIMPLE_EXPRESSION:
              if (exp.ast) {
                // 对于纯对象特殊处理，因为直接给js解析会认为是代码块报错。
                if (exp.ast.type === "ObjectExpression") {
                  entries.push(
                    ...extractFromJsCode(`const a = ${exp.loc.source}`, config)
                  );
                } else {
                  entries.push(...extractFromJsCode(exp.loc.source, config));
                }
              }
              break;
          }
        }
        break;
    }
  }
}