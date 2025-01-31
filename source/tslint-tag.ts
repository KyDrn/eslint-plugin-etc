/**
 * @license
 * Copyright 2018 Palantir Technologies, Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import { getAccessKind, isBindingOrAssignmentElementTarget, isSymbolFlagSet } from "ts-api-utils";
import { 
  Identifier, 
  SyntaxKind, 
  NamedDeclaration, 
  PropertyAssignment, 
  ObjectLiteralExpression, 
  BindingElement, 
  Declaration, 
  CallLikeExpression, 
  Expression, 
  Signature, 
  Symbol, 
  SymbolFlags, 
  JSDocTagInfo, 
  TypeChecker, 
  Node, 
  isPropertyAccessExpression,
  isTaggedTemplateExpression,
  isCallExpression,
  isNewExpression,
  isPropertyAssignment,
  isShorthandPropertyAssignment,
  isBindingElement,
  isVariableDeclaration,
  isVariableDeclarationList
} from "typescript";
import { getDeclarationOfBindingElement, getJsDoc } from "./utils";

export function isDeclaration(identifier: Identifier): boolean {
  const parent = identifier.parent;
  switch (parent.kind) {
    case SyntaxKind.ClassDeclaration:
    case SyntaxKind.ClassExpression:
    case SyntaxKind.InterfaceDeclaration:
    case SyntaxKind.TypeParameter:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.FunctionDeclaration:
    case SyntaxKind.LabeledStatement:
    case SyntaxKind.JsxAttribute:
    case SyntaxKind.MethodDeclaration:
    case SyntaxKind.MethodSignature:
    case SyntaxKind.PropertySignature:
    case SyntaxKind.TypeAliasDeclaration:
    case SyntaxKind.GetAccessor:
    case SyntaxKind.SetAccessor:
    case SyntaxKind.EnumDeclaration:
    case SyntaxKind.ModuleDeclaration:
      return true;
    case SyntaxKind.VariableDeclaration:
    case SyntaxKind.Parameter:
    case SyntaxKind.PropertyDeclaration:
    case SyntaxKind.EnumMember:
    case SyntaxKind.ImportEqualsDeclaration:
      return (parent as NamedDeclaration).name === identifier;
    case SyntaxKind.PropertyAssignment:
      return (
        (parent as PropertyAssignment).name === identifier &&
        !isBindingOrAssignmentElementTarget(
          identifier.parent.parent as ObjectLiteralExpression
        )
      );
    case SyntaxKind.BindingElement:
      // return true for `b` in `const {a: b} = obj"`
      return (
        (parent as BindingElement).name === identifier &&
        (parent as BindingElement).propertyName !== undefined
      );
    default:
      return false;
  }
}

function getCallExpresion(
  node: Expression
): CallLikeExpression | undefined {
  let parent = node.parent;
  if (isPropertyAccessExpression(parent) && parent.name === node) {
    node = parent;
    parent = node.parent;
  }
  return isTaggedTemplateExpression(parent) ||
    ((isCallExpression(parent) || isNewExpression(parent)) &&
      parent.expression === node)
    ? parent
    : undefined;
}

export function getTags(
  tagName: string,
  node: Identifier,
  tc: TypeChecker
): string[] {
  const callExpression = getCallExpresion(node);
  if (callExpression !== undefined) {
    const result = getSignatureTags(
      tagName,
      tc.getResolvedSignature(callExpression)
    );
    if (result.length > 0) {
      return result;
    }
  }
  let symbol: Symbol | undefined;
  const parent = node.parent;
  if (parent.kind === SyntaxKind.BindingElement) {
    symbol = tc.getTypeAtLocation(parent.parent).getProperty(node.text);
  } else if (
    (isPropertyAssignment(parent) && parent.name === node) ||
    (isShorthandPropertyAssignment(parent) &&
      parent.name === node &&
      (getAccessKind(node) & 2) !== 0)
  ) {
    symbol = tc.getPropertySymbolOfDestructuringAssignment(node);
  } else {
    symbol = tc.getSymbolAtLocation(node);
  }

  if (
    symbol !== undefined &&
    isSymbolFlagSet(symbol, SymbolFlags.Alias)
  ) {
    symbol = tc.getAliasedSymbol(symbol);
  }
  if (
    symbol === undefined ||
    // if this is a CallExpression and the declaration is a function or method,
    // stop here to avoid collecting JsDoc of all overload signatures
    (callExpression !== undefined && isFunctionOrMethod(symbol.declarations))
  ) {
    return [];
  }
  return getSymbolTags(tagName, symbol);
}

function findTags(tagName: string, tags: JSDocTagInfo[]): string[] {
  const result: string[] = [];
  for (const tag of tags) {
    if (tag.name === tagName) {
      if (tag.text === undefined) {
        result.push("");
      } else if (typeof tag.text === "string") {
        result.push(tag.text);
      } else {
        result.push(
          tag.text.reduce((text, part) => text.concat(part.text), "")
        );
      }
    }
  }
  return result;
}

function getSymbolTags(tagName: string, symbol: Symbol): string[] {
  if (symbol.getJsDocTags !== undefined) {
    return findTags(tagName, symbol.getJsDocTags());
  }
  // for compatibility with typescript@<2.3.0
  return getTagsFromDeclarations(tagName, symbol.declarations);
}

function getSignatureTags(tagName: string, signature?: Signature): string[] {
  if (signature === undefined) {
    return [];
  }
  if (signature.getJsDocTags !== undefined) {
    return findTags(tagName, signature.getJsDocTags());
  }

  // for compatibility with typescript@<2.3.0
  return signature.declaration === undefined
    ? []
    : getTagsFromDeclaration(tagName, signature.declaration);
}

function getTagsFromDeclarations(
  tagName: string,
  declarations?: Declaration[]
): string[] {
  if (declarations === undefined) {
    return [];
  }
  let declaration: Node;
  for (declaration of declarations) {
    if (isBindingElement(declaration)) {
      declaration = getDeclarationOfBindingElement(declaration);
    }
    if (isVariableDeclaration(declaration)) {
      declaration = declaration.parent;
    }
    if (isVariableDeclarationList(declaration)) {
      declaration = declaration.parent;
    }
    const result = getTagsFromDeclaration(tagName, declaration);
    if (result.length > 0) {
      return result;
    }
  }
  return [];
}

export function getTagsFromDeclaration(
  tagName: string,
  declaration: Node
): string[] {
  const result: string[] = [];
  for (const comment of getJsDoc(declaration)) {
    if (comment.tags === undefined) {
      continue;
    }
    for (const tag of comment.tags) {
      if (tag.tagName.text === tagName) {
        if (tag.comment === undefined) {
          result.push("");
        } else if (typeof tag.comment === "string") {
          result.push(tag.comment);
        } else {
          result.push(
            tag.comment.reduce(
              (text, node) => text.concat(node.getFullText()),
              ""
            )
          );
        }
      }
    }
  }
  return result;
}

function isFunctionOrMethod(declarations?: Declaration[]) {
  if (declarations === undefined || declarations.length === 0) {
    return false;
  }
  switch (declarations[0].kind) {
    case SyntaxKind.MethodDeclaration:
    case SyntaxKind.FunctionDeclaration:
    case SyntaxKind.FunctionExpression:
    case SyntaxKind.MethodSignature:
      return true;
    default:
      return false;
  }
}
