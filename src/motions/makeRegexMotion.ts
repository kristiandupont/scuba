import * as vscode from "vscode";

export const makeRegexMotion =
  (regex: RegExp, mode: "inside" | "around" | "forward" | "backward") =>
  (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    const line = doc.lineAt(cursorPosition.line).text;

    const matches = [...line.matchAll(regex)];
    const matchTouchingCursor = matches.find(
      (match) =>
        match.index! <= cursorPosition.character &&
        match.index! + match[0].length > cursorPosition.character
    );

    if (!matchTouchingCursor) {
      return [];
    }

    const start = new vscode.Position(
      cursorPosition.line,
      matchTouchingCursor.index!
    );
    const end = new vscode.Position(
      cursorPosition.line,
      matchTouchingCursor.index! + matchTouchingCursor[0].length
    );

    let anchor = s.anchor;
    let active = s.active;

    if (mode === "forward") {
      active = end;
    } else if (mode === "backward") {
      active = start;
    } else if (mode === "inside") {
      anchor = start;
      active = end;
    } else {
      // Mode is 'around'
      anchor = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index!
      );
      active = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index! + matchTouchingCursor[0].length
      );
    }

    return [new vscode.Selection(anchor, active)];
  };
