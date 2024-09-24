import * as vscode from "vscode";
import {
  getNodeFromSelection,
  isPropertyLikeNode,
  isParameterOrArgumentNode,
} from "../utilities/tree-sitter-helpers";

export function makePropertyOrParameterMotion(mode: "inside" | "around") {
  return (s: vscode.Selection, doc: vscode.TextDocument) => {
    let node = getNodeFromSelection(s, doc);
    while (
      node.parent &&
      !isPropertyLikeNode(node) &&
      !isParameterOrArgumentNode(node)
    ) {
      node = node.parent;
    }

    if (!isPropertyLikeNode(node) && !isParameterOrArgumentNode(node)) {
      return [];
    }

    let start = node.startPosition;
    let end = node.endPosition;

    // If mode is "around", include the following comma (unless it's the last one -- in that case,
    // include the previous comma, if there is one)
    if (mode === "around") {
      const nextSibling = node.nextSibling;
      if (nextSibling && [",", ";"].includes(nextSibling.text)) {
        end = nextSibling.endPosition;
      } else {
        const previousSibling = node.previousSibling;
        if (previousSibling && previousSibling.text === ",") {
          start = previousSibling.startPosition;
        }
      }
    }

    return [new vscode.Selection(start.row, start.column, end.row, end.column)];
  };
}
