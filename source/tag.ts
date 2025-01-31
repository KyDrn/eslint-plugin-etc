/**
 * @license Use of this source code is governed by an MIT-style license that
 * can be found in the LICENSE file at https://github.com/cartant/eslint-plugin-etc
 */

import { tsquery } from "@phenomnomnominal/tsquery";
import { Program, getJSDocTags, isConstructorDeclaration, Node, Identifier } from "typescript";

export function findTaggedNames(
  tagName: string,
  program: Program
): Set<string> {
  const taggedNames = new Set<string>();
  program.getSourceFiles().forEach((sourceFile) => {
    if (sourceFile.text.indexOf(`@${tagName}`) === -1) {
      return;
    }
    const nodes = tsquery(
      sourceFile,
      // eslint-disable-next-line max-len
      `ClassDeclaration, Constructor, EnumDeclaration, EnumMember, FunctionDeclaration, GetAccessor, InterfaceDeclaration, MethodDeclaration, MethodSignature, PropertyDeclaration, PropertySignature, SetAccessor, TypeAliasDeclaration, VariableDeclaration`
    );
    nodes.forEach((node) => {
      const tags = getJSDocTags(node);
      if (!tags.some((tag) => tag.tagName.text === tagName)) {
        return;
      }
      if (isConstructorDeclaration(node)) {
        const { parent } = node;
        const { name } = parent;
        if (name?.text) {
          taggedNames.add(name.text);
        }
      } else {
        const { name } = node as Node & { name?: Identifier };
        if (name?.text) {
          taggedNames.add(name.text);
        }
      }
    });
  });
  return taggedNames;
}
