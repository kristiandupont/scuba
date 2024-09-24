import * as vscode from "vscode";

export const makeExtremityMotion =
  (position: "start" | "end") =>
  (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    const newActive =
      position === "start" ? 0 : doc.lineAt(cursorPosition.line).text.length;
    return [
      new vscode.Selection(
        s.anchor,
        new vscode.Position(cursorPosition.line, newActive)
      ),
    ];
  };
