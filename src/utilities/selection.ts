import * as vscode from "vscode";

export async function isAnyTextSelected(textEditor: vscode.TextEditor) {
  return textEditor.selections.some((selection) => {
    return !selection.isEmpty;
  });
}
