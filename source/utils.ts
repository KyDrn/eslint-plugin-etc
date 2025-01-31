/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/eslint-plugin-etc
 */

import { ESLintUtils } from "@typescript-eslint/experimental-utils"
import { 
  BindingElement, 
  isJSDoc, 
  JSDoc, 
  Node, 
  ParameterDeclaration, 
  SourceFile, 
  SyntaxKind, 
  VariableDeclaration
} from "typescript";

export const ruleCreator = ESLintUtils.RuleCreator(
  (name) =>
    `https://github.com/KyDrn/eslint-plugin-etc/tree/main/docs/rules/${name}.md`
);

export function getDeclarationOfBindingElement(node: BindingElement): VariableDeclaration | ParameterDeclaration {
    let parent = node.parent.parent;
    while (parent.kind === SyntaxKind.BindingElement)
        parent = parent.parent.parent;
    return parent;
}

export function getJsDoc(node: Node, sourceFile?: SourceFile): JSDoc[] {
    const result = [];
    for (const child of node.getChildren(sourceFile)) {
        if (!isJSDoc(child))
            break;
        result.push(child);
    }
    return result;
}