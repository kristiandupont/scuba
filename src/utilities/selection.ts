import * as vscode from "vscode";

let previousSelections: readonly vscode.Selection[] | undefined;

export function isAnyTextSelected(textEditor: vscode.TextEditor) {
  return textEditor.selections.some((selection) => {
    return !selection.isEmpty;
  });
}

export function storeSelections(textEditor: vscode.TextEditor) {
  previousSelections = textEditor.selections;
}

export function restoreSelections(textEditor: vscode.TextEditor) {
  if (previousSelections) {
    textEditor.selections = previousSelections;
    textEditor.revealRange(textEditor.selection);
  }
}

// const LINE_MODE_MARKER = "\uFEFF"; // Zero-width non-breaking space
const LINE_MODE_MARKER = "\n";

export function lineModeCopy(editor: vscode.TextEditor): void {
  const document = editor.document;
  const selections = editor.selections;

  let textToCopy = "";

  selections.forEach((selection, index) => {
    const start = selection.start.line;
    const end = selection.end.line + (selection.end.character > 0 ? 1 : 0);

    for (let i = start; i < end; i++) {
      textToCopy += document.lineAt(i).text + "\n";
    }

    // Add an extra newline between selections, except for the last one
    if (index < selections.length - 1) {
      textToCopy += "\n";
    }
  });

  // Remove the last newline if it exists
  textToCopy = textToCopy.replace(/\n$/, "");

  const markedText = LINE_MODE_MARKER + textToCopy;
  vscode.env.clipboard.writeText(markedText);
}

export function lineModeCut(editor: vscode.TextEditor): void {
  const document = editor.document;
  lineModeCopy(editor);

  editor.edit((editBuilder) => {
    editor.selections.forEach((selection) => {
      const start = selection.start.line;
      const end = selection.end.line + (selection.end.character > 0 ? 1 : 0);

      for (let i = start; i < end; i++) {
        const line = document.lineAt(start);
        editBuilder.delete(line.rangeIncludingLineBreak);
      }
    });
  });
}

export function lineModeAwarePaste(
  editor: vscode.TextEditor,
  place: "before" | "after"
): void {
  vscode.env.clipboard.readText().then((text) => {
    if (text.startsWith(LINE_MODE_MARKER)) {
      // Remove the marker
      text = text.slice(1);

      editor.edit((editBuilder) => {
        editor.selections.forEach((selection) => {
          const position = selection.active;
          const lineNumber =
            place === "before" ? position.line : position.line + 1;

          // Insert the text on a new line below the current line
          const insertPosition = new vscode.Position(lineNumber, 0);
          editBuilder.insert(insertPosition, text + "\n");
        });
      });
    } else {
      // If it's not line mode, perform a regular paste operation
      if (place === "after") {
        vscode.commands.executeCommand("cursorRight");
      }
      vscode.commands.executeCommand("editor.action.clipboardPasteAction");
    }
  });
}
