import * as vscode from "vscode";
import { getNodeFromSelection } from "../utilities/tree-sitter-helpers";

export const makeNodeMotion =
  (mode: "inside" | "around" | "forward" | "backward") =>
  (s: vscode.Selection, doc: vscode.TextDocument): vscode.Selection[] => {
    let node = getNodeFromSelection(s, doc);

    if (mode === "inside") {
      node = node.children[1]; // Contents node
    }

    if (!node) {
      return [];
    }

    // const start = node.startPosition;
    // const end = node.endPosition;
    const start = new vscode.Position(
      node.startPosition.row,
      node.startPosition.column,
    );
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
