import * as vscode from "vscode";
import {
  getNodeFromSelection,
  isFunctionDefinitionNode,
} from "../utilities/tree-sitter-helpers";

export function functionMotion(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Selection[] {
  let node = getNodeFromSelection(s, doc);
  while (node.parent && !isFunctionDefinitionNode(node)) {
    node = node.parent;
  }

  if (!isFunctionDefinitionNode(node)) {
    return [];
  }

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Selection(start.row, start.column, end.row, end.column)];
}
