/* eslint-disable @typescript-eslint/naming-convention */
/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/eslint-plugin-etc
 * Portions of this file are copyright 2017 Klaus Meinhardt - see THIRD_PARTY_NOTICES.
 */
/* eslint @typescript-eslint/no-non-null-assertion: "off" */

import { TSESTree as es } from "@typescript-eslint/experimental-utils";
import { getLoc, getParserServices } from "eslint-etc";
import { Identifier, TypeParameterDeclaration, SignatureDeclaration, isFunctionLike } from "typescript";
import { ruleCreator } from "../utils";
import { collectVariableUsage, isSignatureDeclaration, VariableInfo } from "ts-api-utils";

const rule = ruleCreator({
  defaultOptions: [],
  meta: {
    docs: {
      description:
        // eslint-disable-next-line max-len
        "Forbids type parameters without inference sites and type parameters that don't add type safety to declarations.",
      recommended: false,
    },
    fixable: undefined,
    hasSuggestions: false,
    messages: {
      canReplace:
        // eslint-disable-next-line max-len
        "Type parameter '{{name}}' is not used to enforce a constraint between types and can be replaced with '{{replacement}}'.",
      cannotInfer:
        "Type parameter '{{name}}' cannot be inferred from any parameter.",
    },
    schema: [],
    type: "problem",
  },
  name: "no-misused-generics",
  create: (context) => {
    // eslint-disable-next-line @typescript-eslint/naming-convention
    const { esTreeNodeToTSNodeMap } = getParserServices(context);
    let usage: Map<Identifier, VariableInfo> | undefined;

    function checkSignature(node: es.Node) {
      const tsNode = esTreeNodeToTSNodeMap.get(node);
      if (
        isSignatureDeclaration(tsNode) &&
        tsNode.typeParameters !== undefined
      ) {
        checkTypeParameters(tsNode.typeParameters, tsNode);
      }
    }

    function checkTypeParameters(
      typeParameters: readonly TypeParameterDeclaration[],
      signature: SignatureDeclaration
    ) {
      if (usage === undefined) {
        usage = collectVariableUsage(signature.getSourceFile());
      }
      outer: for (const typeParameter of typeParameters) {
        let usedInParameters = false;
        let usedInReturnOrExtends = isFunctionLike(signature);
        for (const use of usage.get(typeParameter.name)!.uses) {
          if (
            use.location.pos > signature.parameters.pos &&
            use.location.pos < signature.parameters.end
          ) {
            if (usedInParameters) {
              continue outer;
            }
            usedInParameters = true;
          } else if (!usedInReturnOrExtends) {
            usedInReturnOrExtends =
              use.location.pos > signature.parameters.end ||
              isUsedInConstraint(use.location, typeParameters);
          }
        }
        if (!usedInParameters) {
          context.report({
            data: {
              name: typeParameter.name.text,
            },
            loc: getLoc(typeParameter),
            messageId: "cannotInfer",
          });
        } else if (
          !usedInReturnOrExtends &&
          !isConstrainedByOtherTypeParameter(typeParameter, typeParameters)
        ) {
          context.report({
            data: {
              name: typeParameter.name.text,
              replacement: typeParameter.constraint
                ? typeParameter.constraint.getText(signature.getSourceFile())
                : "unknown",
            },
            loc: getLoc(typeParameter),
            messageId: "canReplace",
          });
        }
      }
    }

    function isConstrainedByOtherTypeParameter(
      current: TypeParameterDeclaration,
      all: readonly TypeParameterDeclaration[]
    ) {
      if (current.constraint === undefined) {
        return false;
      }
      for (const typeParameter of all) {
        if (typeParameter === current) {
          continue;
        }
        for (const use of usage!.get(typeParameter.name)!.uses) {
          if (
            use.location.pos >= current.constraint.pos &&
            use.location.pos < current.constraint.end
          ) {
            return true;
          }
        }
      }
      return false;
    }

    function isUsedInConstraint(
      use: Identifier,
      typeParameters: readonly TypeParameterDeclaration[]
    ) {
      for (const typeParameter of typeParameters) {
        if (
          typeParameter.constraint !== undefined &&
          use.pos >= typeParameter.constraint.pos &&
          use.pos < typeParameter.constraint.end
        ) {
          return true;
        }
      }
      return false;
    }

    return {
      ArrowFunctionExpression: checkSignature,
      FunctionDeclaration: checkSignature,
      FunctionExpression: checkSignature,
      MethodDefinition: checkSignature,
      "Program:exit": () => (usage = undefined),
      TSCallSignatureDeclaration: checkSignature,
      TSConstructorType: checkSignature,
      TSConstructSignatureDeclaration: checkSignature,
      TSDeclareFunction: checkSignature,
      TSFunctionType: checkSignature,
      TSIndexSignature: checkSignature,
      TSMethodSignature: checkSignature,
      TSPropertySignature: checkSignature,
    };
  },
});

export default rule;
