import * as vscode from "vscode";

export function isAnyTextSelected(textEditor: vscode.TextEditor) {
  return textEditor.selections.some((selection) => {
    return !selection.isEmpty;
  });
}

let previousSelectionsStack: (readonly vscode.Selection[])[] = [];
let previousSelectionsStackIndex = 0;

export function pushSelections(textEditor: vscode.TextEditor) {
  // If we are not at the top of the stack, truncate the stack
  if (previousSelectionsStackIndex < previousSelectionsStack.length) {
    previousSelectionsStack = previousSelectionsStack.slice(
      0,
      previousSelectionsStackIndex
    );
  }

  previousSelectionsStack.push(textEditor.selections);
  previousSelectionsStackIndex++;

  if (previousSelectionsStack.length > 32) {
    previousSelectionsStack.shift();
    previousSelectionsStackIndex--;
  }
}

export function popSelections(textEditor: vscode.TextEditor) {
  if (previousSelectionsStackIndex > 0) {
    previousSelectionsStackIndex--;
    const previousSelections =
      previousSelectionsStack[previousSelectionsStackIndex];
    textEditor.selections = previousSelections;
    textEditor.revealRange(textEditor.selection);
  }
}

export function undoPopSelections(textEditor: vscode.TextEditor) {
  if (previousSelectionsStackIndex < previousSelectionsStack.length - 1) {
    previousSelectionsStackIndex++;
    const nextSelections =
      previousSelectionsStack[previousSelectionsStackIndex];
    textEditor.selections = nextSelections;
    textEditor.revealRange(textEditor.selection);
  }
}

export async function lineModeAwarePaste(
  editor: vscode.TextEditor,
  place: "before" | "after"
): Promise<void> {
  if (isAnyTextSelected(editor)) {
    // If there are selections, perform a regular paste operation
    vscode.commands.executeCommand("editor.action.clipboardPasteAction");
    return;
  }

  const text = await vscode.env.clipboard.readText();

  if (text.endsWith("\n")) {
    editor.edit((editBuilder) => {
      editor.selections.forEach((selection) => {
        const position = selection.active;
        const lineNumber =
          place === "before" ? position.line : position.line + 1;

        // Insert the text on a new line below the current line
        const insertPosition = new vscode.Position(lineNumber, 0);
        editBuilder.insert(insertPosition, text);

        const lines = text.split("\n");
        // Move the cursor to the new line
        const newPosition = new vscode.Position(
          lineNumber,
          lines[lines.length - 1].length
        );
        editor.selection = new vscode.Selection(newPosition, newPosition);
      });
    });
  } else {
    // If it's not line mode, perform a regular paste operation
    if (place === "after" && !isAnyTextSelected(editor)) {
      vscode.commands.executeCommand("cursorRight");
    }
    vscode.commands.executeCommand("editor.action.clipboardPasteAction");
  }
}
