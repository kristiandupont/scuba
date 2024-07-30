import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";

export const replaceCharMode: Mode = {
  isInsertMode: false,
  name: "replace-char",
  statusItemText: "Replace Char",
  cursorStyle: vscode.TextEditorCursorStyle.Underline,
  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const key = keys[0];
    const charCode = key.charCodeAt(0);
    const char = String.fromCharCode(charCode);
    const selections = textEditor.selections;

    await textEditor.edit((editBuilder) => {
      selections.forEach((selection) => {
        const position = selection.active;
        const range = new vscode.Range(position, position.translate(0, 1));
        editBuilder.replace(range, char);
      });
    });

    // Update selections to reflect the new cursor positions
    const newSelections = selections.map((selection) => {
      const position = selection.active.translate(0, 1);
      return new vscode.Selection(position, position);
    });
    textEditor.selections = newSelections;

    changeMode({ mode: defaultMode });
  },
};
