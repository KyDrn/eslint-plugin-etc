/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/eslint-plugin-etc
 */

import { TSESTree as es } from "@typescript-eslint/experimental-utils";
import { getLoc, getParserServices } from "eslint-etc";
import { EnumDeclaration } from "typescript";
import { ruleCreator } from "../utils";

const rule = ruleCreator({
  defaultOptions: [],
  meta: {
    docs: {
      description: "Forbids the use of `enum`.",
      recommended: false,
    },
    fixable: undefined,
    hasSuggestions: false,
    messages: {
      forbidden: "`enum` is forbidden.",
    },
    schema: [],
    type: "problem",
  },
  name: "no-enum",
  create: (context) => ({
    TSEnumDeclaration: (node: es.Node) => {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      const { esTreeNodeToTSNodeMap } = getParserServices(context);
      const enumDeclaration = esTreeNodeToTSNodeMap.get(
        node
      ) as EnumDeclaration;
      context.report({
        messageId: "forbidden",
        loc: getLoc(enumDeclaration.name),
      });
    },
  }),
});

export default rule;
