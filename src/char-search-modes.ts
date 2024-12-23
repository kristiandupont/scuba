import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";

function makeCharSearchHandler(
  includeFoundChar: boolean
): (keys: string, textEditor: vscode.TextEditor) => Promise<void> {
  return async function (keys: string, textEditor: vscode.TextEditor) {
    if (keys.length !== 1) {
      vscode.window.showErrorMessage("Invalid key for char search");
      changeMode({ mode: defaultMode });
      return;
    }

    const char = keys[0];
    const newSelections = textEditor.selections.map((selection) => {
      const nextOccurrence = textEditor.document
        .getText()
        .indexOf(char, textEditor.document.offsetAt(selection.active) + 1);
      if (nextOccurrence === -1) {
        return selection;
      }
      const position = textEditor.document.positionAt(nextOccurrence);

      const cursorPosition = includeFoundChar
        ? position.translate(0, 1)
        : position;

      // Select from original start to found char:
      return new vscode.Selection(cursorPosition, cursorPosition);
    });

    textEditor.selections = newSelections;
    changeMode({ mode: defaultMode });
  };
}

export const findCharMode: Mode = {
  isInsertMode: false,
  name: "find-char/inclusive",
  statusItemText: "Find char",
  color: new vscode.ThemeColor("editor.foreground"),

  handleSubCommandChain: makeCharSearchHandler(true),
};

export const tillCharMode: Mode = {
  isInsertMode: false,
  name: "find-char/exclusive",
  statusItemText: "Go until char",
  color: new vscode.ThemeColor("editor.foreground"),

  handleSubCommandChain: makeCharSearchHandler(false),
};
