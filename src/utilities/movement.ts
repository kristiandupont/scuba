import * as vscode from "vscode";

export async function moveCursorsRightUnlessTheyAreAtEOL(
  count: number,
  textEditor: vscode.TextEditor
) {
  const selections = textEditor.selections;
  const newSelections = selections.map((selection) => {
    let position = selection.active;
    const lineEnd = textEditor.document.lineAt(position.line).range.end;

    for (let i = 0; i < count; i++) {
      if (position.isEqual(lineEnd)) {
        break; // Stop if the cursor is at the end of the line
      }
      position = position.translate(0, 1); // Move the cursor one character to the right
    }

    return new vscode.Selection(position, position);
  });
  textEditor.selections = newSelections;
}

export function moveCursorsToStartOfLine(textEditor: vscode.TextEditor) {
  const selections = textEditor.selections;
  const newSelections = selections.map((selection) => {
    const position = selection.active.with({ character: 0 });
    return new vscode.Selection(position, position);
  });
  textEditor.selections = newSelections;
}
