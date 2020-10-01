/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/eslint-plugin-etc
 */

import { tsquery } from "@phenomnomnominal/tsquery";
import { TSESTree as es } from "@typescript-eslint/experimental-utils";
import { getParent, getParserServices } from "eslint-etc";
import * as ts from "typescript";
import { getTag, isDeclaration } from "../tslint-tag";
import { ruleCreator } from "../utils";

const deprecatedNamesByProgram = new WeakMap<ts.Program, Set<string>>();

const defaultOptions: {
  ignored?: Record<string, string>;
}[] = [];

const rule = ruleCreator({
  defaultOptions,
  meta: {
    docs: {
      category: "Best Practices",
      description: "Forbids the use of deprecated APIs.",
      recommended: false,
    },
    fixable: undefined,
    messages: {
      forbidden: `"{{name}}" is deprecated: {{comment}}`,
    },
    schema: [
      {
        properties: {
          ignored: { type: "object" },
        },
        type: "object",
      },
    ],
    type: "problem",
  },
  name: "no-deprecated",
  create: (context, unused: typeof defaultOptions) => {
    const [{ ignored = {} } = {}] = context.options;
    const ignoredNameRegExps: RegExp[] = [];
    const ignoredPathRegExps: RegExp[] = [];
    Object.entries(ignored).forEach(([key, value]) => {
      switch (value) {
        case "name":
          ignoredNameRegExps.push(new RegExp(key));
          break;
        case "path":
          ignoredPathRegExps.push(new RegExp(key));
          break;
        default:
          break;
      }
    });
    const { esTreeNodeToTSNodeMap, program } = getParserServices(context);
    const typeChecker = program.getTypeChecker();
    const getPath = (identifier: ts.Identifier) => {
      const type = typeChecker.getTypeAtLocation(identifier);
      return typeChecker.getFullyQualifiedName(type.symbol);
    };
    let deprecatedNames: Set<string>;
    if (deprecatedNamesByProgram.has(program)) {
      deprecatedNames = deprecatedNamesByProgram.get(program);
    } else {
      deprecatedNames = findTaggedNames("deprecated", program);
      deprecatedNamesByProgram.set(program, deprecatedNames);
    }
    return {
      Identifier: (node: es.Identifier) => {
        switch (getParent(node).type) {
          case "ExportSpecifier":
          case "ImportDefaultSpecifier":
          case "ImportNamespaceSpecifier":
          case "ImportSpecifier":
            return;
          default:
            break;
        }
        const identifier = esTreeNodeToTSNodeMap.get(node) as ts.Identifier;
        if (!deprecatedNames.has(identifier.text)) {
          return;
        }
        if (isDeclaration(identifier)) {
          return;
        }
        if (
          ignoredNameRegExps.some((regExp) => regExp.test(identifier.text)) ||
          ignoredPathRegExps.some((regExp) => regExp.test(getPath(identifier)))
        ) {
          return;
        }
        const comment = getTag("deprecated", identifier, typeChecker);
        if (comment !== undefined) {
          context.report({
            data: { comment, name: identifier.text },
            messageId: "forbidden",
            node,
          });
        }
      },
    };
  },
});

function findTaggedNames(tagName: string, program: ts.Program): Set<string> {
  const taggedNames = new Set<string>();
  program.getSourceFiles().forEach((sourceFile) => {
    if (sourceFile.text.indexOf(`@${tagName}`) === -1) {
      return;
    }
    const nodes = tsquery(
      sourceFile,
      `ClassDeclaration, Constructor, EnumDeclaration, EnumMember, FunctionDeclaration, GetAccessor, InterfaceDeclaration, MethodDeclaration, MethodSignature, PropertyDeclaration, PropertySignature, SetAccessor, TypeAliasDeclaration, VariableDeclaration`
    );
    nodes.forEach((node) => {
      const tags = ts.getJSDocTags(node);
      if (!tags.some((tag) => tag.tagName.text === tagName)) {
        return;
      }
      if (ts.isConstructorDeclaration(node)) {
        const { parent } = node;
        const { name } = parent;
        taggedNames.add(name.text);
      } else {
        const { name } = node as ts.Node & { name: ts.Identifier };
        taggedNames.add(name.text);
      }
    });
  });
  return taggedNames;
}

export = rule;
