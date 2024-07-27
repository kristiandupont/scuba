import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";

export const sneakMode: Mode = {
  isInsertMode: false,
  name: "sneak",
  statusItemText: "Sneak",
  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys.length === 1) {
      // Wait for second key.
    } else if (keys.length === 2) {
      const word = keys.toLowerCase();
      // Find the next occurrence of the word from each cursor:
      const newSelections = textEditor.selections.map((selection) => {
        const nextOccurrence = textEditor.document
          .getText()
          .toLowerCase()
          .indexOf(word, textEditor.document.offsetAt(selection.active));
        if (nextOccurrence === -1) {
          return selection;
        }
        const position = textEditor.document.positionAt(nextOccurrence);
        return new vscode.Selection(position, position);
      });
      textEditor.selections = newSelections;

      changeMode({ mode: defaultMode });
    }
  },
};
