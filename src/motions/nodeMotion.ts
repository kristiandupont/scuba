import * as vscode from "vscode";
import { getNodeFromSelection } from "../utilities/tree-sitter-helpers";

export const makeNodeMotion =
  (mode: "inside" | "around" | "forward" | "backward") =>
  (s: vscode.Selection, doc: vscode.TextDocument): vscode.Selection[] => {
    // The smallest *named* node covering the cursor: the identifier in
    // `foo`, the pair in `b: 2`, the string fragment inside quotes.
    const node = getNodeFromSelection(s, doc);

    if (!node) {
      return [];
    }

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
