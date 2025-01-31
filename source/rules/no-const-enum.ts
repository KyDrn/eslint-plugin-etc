/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/eslint-plugin-etc
 */

import { TSESTree as es } from "@typescript-eslint/experimental-utils";
import { getLoc, getParserServices } from "eslint-etc";
import { includesModifier } from "ts-api-utils";
import { EnumDeclaration, SyntaxKind } from "typescript";
import { ruleCreator } from "../utils";

const defaultOptions: readonly {
  allowLocal?: boolean;
}[] = [];

const rule = ruleCreator({
  defaultOptions,
  meta: {
    docs: {
      description: "Forbids the use of `const enum`.",
      recommended: false,
    },
    fixable: undefined,
    hasSuggestions: false,
    messages: {
      forbidden: "`const enum` is forbidden.",
    },
    schema: [
      {
        properties: {
          allowLocal: { type: "boolean" },
        },
        type: "object",
      },
    ],
    type: "problem",
  },
  name: "no-const-enum",
  create: (context, unused: typeof defaultOptions) => ({
    TSEnumDeclaration: (node: es.Node) => {
      const [{ allowLocal = false } = {}] = context.options;
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { esTreeNodeToTSNodeMap } = getParserServices(context);
      const enumDeclaration = esTreeNodeToTSNodeMap.get(
        node
      ) as EnumDeclaration;
      if (
        allowLocal &&
        !includesModifier(
          enumDeclaration.modifiers,
          SyntaxKind.ExportKeyword
        )
      ) {
        return;
      }
      if (
        !includesModifier(
          enumDeclaration.modifiers,
          SyntaxKind.ConstKeyword
        )
      ) {
        return;
      }
      context.report({
        messageId: "forbidden",
        loc: getLoc(enumDeclaration.name),
      });
    },
  }),
});

export default rule;
