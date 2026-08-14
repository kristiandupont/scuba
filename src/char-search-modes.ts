import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";
import { singleCharacter } from "./utilities/keys";

function makeCharSearchHandler(
  includeFoundChar: boolean
): (keys: string, textEditor: vscode.TextEditor) => Promise<void> {
  return async function (keys: string, textEditor: vscode.TextEditor) {
    const char = singleCharacter(keys);
    if (char === null) {
      // Nothing to search for -- an arrow key or similar. Cancel quietly.
      await changeMode({ mode: defaultMode });
      return;
    }

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
    await changeMode({ mode: defaultMode });
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
