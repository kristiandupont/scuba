import * as vscode from "vscode";
import {
  getNodeFromSelection,
  isCommentNode,
} from "../utilities/tree-sitter-helpers";

export function commentMotion(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Selection[] {
  let node = getNodeFromSelection(s, doc);
  if (!isCommentNode(node)) {
    return [];
  }

  let firstCommentNode = node;
  let lastCommentNode = node;

  // If the comment is a line comment, include all line comments above and below
  if (node.text.startsWith("//") || node.text.startsWith("#")) {
    while (
      firstCommentNode.previousSibling &&
      isCommentNode(firstCommentNode.previousSibling)
    ) {
      firstCommentNode = firstCommentNode.previousSibling;
    }

    while (
      lastCommentNode.nextSibling &&
      isCommentNode(lastCommentNode.nextSibling)
    ) {
      lastCommentNode = lastCommentNode.nextSibling;
    }
  }

  const start = firstCommentNode.startPosition;
  const end = lastCommentNode.endPosition;
  return [new vscode.Selection(start.row, start.column, end.row, end.column)];
}
