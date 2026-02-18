import * as vscode from "vscode";
import { getNodeFromSelection } from "../utilities/tree-sitter-helpers";

export function nodeMotion(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Selection[] {
  const node = getNodeFromSelection(s, doc);

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Selection(start.row, start.column, end.row, end.column)];
}
