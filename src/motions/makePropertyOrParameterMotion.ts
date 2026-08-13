import * as vscode from "vscode";
import {
  getNodeFromSelection,
  isPropertyLikeNode,
  isParameterOrArgumentNode,
} from "../utilities/tree-sitter-helpers";

export function makePropertyOrParameterMotion(
  mode: "forward" | "backward" | "inside" | "around",
) {
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

    let startPos = node.startPosition;
    let endPos = node.endPosition;

    // If mode is "around", include the following comma (unless it's the last one -- in that case,
    // include the previous comma, if there is one)
    if (mode === "around") {
      const nextSibling = node.nextSibling;
      if (nextSibling && [",", ";"].includes(nextSibling.text)) {
        endPos = nextSibling.endPosition;
      } else {
        const previousSibling = node.previousSibling;
        if (previousSibling && previousSibling.text === ",") {
          startPos = previousSibling.startPosition;
        }
      }
    }

    const start = new vscode.Position(startPos.row, startPos.column);
    const end = new vscode.Position(
      node.endPosition.row,
      node.endPosition.column,
    );
    let anchor = s.anchor;
    let active = s.active;

    if (mode === "forward") {
      active = end;
    } else if (mode === "backward") {
      active = start;
    } else {
      anchor = start;
      active = end;
    }
    return [new vscode.Selection(anchor, active)];
  };
}
