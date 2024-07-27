import * as vscode from "vscode";

export async function moveCursorsRightUnlessTheyAreAtEOL(
  textEditor: vscode.TextEditor
) {
  const selections = textEditor.selections;
  const newSelections = selections.map((selection) => {
    const position = selection.active;
    const lineEnd = textEditor.document.lineAt(position.line).range.end;
    if (!position.isEqual(lineEnd)) {
      // Move the cursor for this selection one character to the right
      const newPosition = position.translate(0, 1);
      return new vscode.Selection(newPosition, newPosition);
    }
    return selection;
  });
  textEditor.selections = newSelections;
}
