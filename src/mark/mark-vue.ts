import { parse, SFCScriptBlock } from "@vue/compiler-sfc";
import {
    ElementNode,
    InterpolationNode,
    Node,
    NodeTypes,
    TemplateChildNode,
    TextNode,
    CommentNode,
} from "@vue/compiler-core";
import {
    hasChinese,
    splitString,
    toSafeTemplateLiteral,
} from "../utils";
import { markJsCode } from "./mark-js";
import { MarkCodeOptionType } from "../shared/types";

export function markVueCode(code: string, option: MarkCodeOptionType) {
    const result = parse(code);
    let { template, script, scriptSetup, source } = result.descriptor;
    const replaceList: ResultNode[] = [];

    // 收集所有i18n注释节点
    const commentNodes: CommentNode[] = [];
    if (template?.ast && option.ignoreComment) {
        collectI18nCommentNodes(template.ast.children, commentNodes, option.ignoreComment);
    }

    if (template?.ast) {
        // 模板部分不需要导入语句，所以清空i18nImport配置
        const newOption = {
            ...option,
            i18nImport: undefined
        }
        handlerTemplateAstNodes(template.ast.children, replaceList, commentNodes, newOption);
    }
    if (script) {
        handleScriptCode(script, replaceList, option);
    }
    if (scriptSetup) {
        handleScriptCode(scriptSetup, replaceList, option);
    }

    let totalOffset = 0;
    let newCode = replaceList.length ? source : undefined
    for (let i = 0; i < replaceList.length; i++) {
        const { start, end, offset, code } = replaceList[i];
        newCode = `${newCode.substring(
            0,
            start + totalOffset
        )}${code}${newCode.substring(end + totalOffset)}`;
        totalOffset += offset;
    }
    return newCode;
}

interface ResultNode {
    start: number;
    end: number;
    offset: number;
    code: string;
}

// 收集所有注释节点
function collectI18nCommentNodes(
    astNodes: TemplateChildNode[],
    commentNodes: CommentNode[],
    ignoreComment: string
) {
    for (const node of astNodes) {
        if (node.type === NodeTypes.COMMENT && node.content.trim() === ignoreComment) {
            commentNodes.push(node);
        }
        if (node.type === NodeTypes.ELEMENT && node.children) {
            collectI18nCommentNodes(node.children, commentNodes, ignoreComment);
        }
    }
}

// 检查节点是否有忽略注释
function hasIgnoreComment(node: Node, commentNodes: CommentNode[]): boolean {
    if (!node.loc) return false;
    const nodeStartLine = node.loc.start.line;
    if (nodeStartLine <= 1) return false;
    return commentNodes.some((comment) => {
        const isBeforeNode = comment.loc.end.offset < node.loc.start.offset;
        const isNearNode =
            comment.loc.end.line === nodeStartLine - 1 ||
            (node.type === NodeTypes.ELEMENT &&
                comment.loc.end.line === node.loc.start.line - 1);

        return isBeforeNode && isNearNode;
    });
}

function handlerTemplateAstNodes(
    astNodes: TemplateChildNode[],
    replaceList: ResultNode[],
    commentNodes: CommentNode[],
    option: MarkCodeOptionType
) {
    for (let i = 0; i < astNodes.length; i++) {
        const node = astNodes[i];
        handlerTemplateAst(node, replaceList, commentNodes, option);
    }
}

function handleScriptCode(script: SFCScriptBlock, replaceList: ResultNode[], option: MarkCodeOptionType) {
    const newCode = markJsCode(script.loc.source, option);
    if (newCode) {
        replaceList.push(createReplaceItem(script, script.loc.source, newCode));
    }
}

function handlerTemplateAst(
    astNode: TemplateChildNode,
    replaceList: ResultNode[],
    commentNodes: CommentNode[],
    option: MarkCodeOptionType
) {
    // 如果有忽略注释，跳过处理
    if (hasIgnoreComment(astNode, commentNodes)) return;

    switch (astNode.type) {
        case NodeTypes.ELEMENT:
            const { props, children } = astNode;
            if (props?.length) {
                handleElementProps(props, replaceList, commentNodes, option);
            }
            if (children?.length) {
                handlerTemplateAstNodes(children, replaceList, commentNodes, option);
            }
            break;
        case NodeTypes.TEXT:
            hanldeTextNode(astNode, replaceList, option);
            break;
        case NodeTypes.INTERPOLATION:
            handleInterpolationNode(astNode, replaceList, option);
            break;
    }
}

function getNodeLoc(loc: Node["loc"]) {
    return {
        start: loc.start.offset,
        end: loc.end.offset,
    };
}

function createReplaceItem(
    node: Node | SFCScriptBlock,
    oldCode: string,
    newCode: string
): ResultNode {
    const loc = getNodeLoc(node.loc);
    const offset = newCode.length - oldCode.length;
    return {
        start: loc.start,
        end: loc.end,
        offset,
        code: newCode,
    };
}

function handleElementProps(
    props: ElementNode["props"],
    replaceList: ResultNode[],
    commentNodes: CommentNode[],
    option: MarkCodeOptionType
) {
    const { ignoreAttrs = [] } = option;
    for (let i = 0; i < props.length; i++) {
        const prop = props[i];
        // 如果有忽略注释，跳过处理
        if (hasIgnoreComment(prop, commentNodes)) continue;

        if (ignoreAttrs.includes(prop.name)) {
            continue;
        }
        switch (prop.type) {
            case NodeTypes.ATTRIBUTE:
                if (prop.value && hasChinese(prop.value.loc.source)) {
                    const newCode = `${option.i18nTag}${toSafeTemplateLiteral(
                        prop.value.content
                    )}`;
                    if (newCode) {
                        replaceList.push(
                            createReplaceItem(
                                prop,
                                prop.loc.source,
                                `:${prop.loc.source.replace(prop.value.content, newCode)}`
                            )
                        );
                    }
                }
                break;
            case NodeTypes.DIRECTIVE:
                const { exp } = prop;
                if (!exp) {
                    continue;
                }
                // 如果有忽略注释，跳过处理
                if (hasIgnoreComment(exp, commentNodes)) continue;

                switch (exp.type) {
                    case NodeTypes.SIMPLE_EXPRESSION:
                        if (exp.content && hasChinese(exp.content)) {
                            let newCode;
                            if (exp.ast && exp.ast.type === "StringLiteral") {
                                newCode = `${option.i18nTag}${toSafeTemplateLiteral(
                                    exp.ast.value
                                )}`;
                                replaceList.push(
                                    createReplaceItem(exp, exp.loc.source, newCode)
                                );
                            } else if (exp.ast) {
                                // 对于纯对象特殊处理，因为直接给js解析会认为是代码块报错。
                                if (exp.ast.type === "ObjectExpression") {
                                    newCode = markJsCode(`const a = ${exp.loc.source}`, option);
                                    if (newCode) {
                                        newCode = newCode.substring(10);
                                    }
                                } else {
                                    newCode = markJsCode(exp.loc.source, option);
                                }
                                if (newCode) {
                                    replaceList.push(
                                        createReplaceItem(exp, exp.loc.source, newCode)
                                    );
                                }
                            }
                        }
                        break;
                }
                break;
        }
    }
}

function hanldeTextNode(node: TextNode, replaceList: ResultNode[], option: MarkCodeOptionType) {
    if (!hasChinese(node.content)) {
        return;
    }
    const code = node.loc.source;
    const { leading, content, trailing } = splitString(code);
    const newCode = `{{ ${option.i18nTag}${toSafeTemplateLiteral(content)} }}`;
    replaceList.push(
        createReplaceItem(node, node.loc.source, `${leading}${newCode}${trailing}`)
    );
}

function handleInterpolationNode(
    node: InterpolationNode,
    replaceList: ResultNode[],
    option: MarkCodeOptionType
) {
    const newCode = markJsCode(node.loc.source, option);
    if (newCode) {
        replaceList.push(createReplaceItem(node, node.loc.source, newCode));
    }
}