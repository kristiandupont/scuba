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
