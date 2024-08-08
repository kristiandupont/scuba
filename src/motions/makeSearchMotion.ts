import * as vscode from "vscode";

export function makeSearchMotion(
  character: string,
  mode: "inclusive" | "exclusive",
  direction: "forward" | "backward"
) {
  return (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    const line = doc.lineAt(cursorPosition.line).text;
    let newActive: vscode.Position;

    if (direction === "forward") {
      const index = line.indexOf(character, cursorPosition.character);
      if (index === -1) {
        return [];
      }
      newActive = new vscode.Position(cursorPosition.line, index);
    } else {
      const index = line.lastIndexOf(character, cursorPosition.character - 1);
      if (index === -1) {
        return [];
      }
      newActive = new vscode.Position(cursorPosition.line, index);
    }

    if (mode === "inclusive") {
      return [new vscode.Selection(s.anchor, newActive.translate(0, 1))];
    } else {
      return [new vscode.Selection(s.anchor, newActive)];
    }
  };
}
