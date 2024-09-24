import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";

function makeSneakHandler(direction: "forward" | "backward") {
  return async function (keys: string, textEditor: vscode.TextEditor) {
    if (keys.length === 1) {
      // Wait for second key.
      return;
    }

    if (keys.length !== 2) {
      vscode.window.showErrorMessage("Invalid key for sneak");
      changeMode({ mode: defaultMode });
      return;
    }

    const word = keys.toLowerCase();
    const searchText = textEditor.document.getText().toLowerCase();
    const newSelections = textEditor.selections.map((selection) => {
      const nextOccurrence =
        direction === "forward"
          ? searchText.indexOf(
              word,
              textEditor.document.offsetAt(selection.active) + 1
            )
          : searchText.lastIndexOf(
              word,
              textEditor.document.offsetAt(selection.active) - 1
            );
      if (nextOccurrence === -1) {
        return selection;
      }
      const position = textEditor.document.positionAt(nextOccurrence);
      return new vscode.Selection(position, position);
    });

    textEditor.selections = newSelections;
    changeMode({ mode: defaultMode });
  };
}

export const sneakMode: Mode = {
  isInsertMode: false,
  name: "sneak",
  statusItemText: "Sneak",
  handleSubCommandChain: makeSneakHandler("forward"),
};

export const sneakBackwardsMode: Mode = {
  isInsertMode: false,
  name: "sneak-backwards",
  statusItemText: "Sneak Backwards",
  handleSubCommandChain: makeSneakHandler("backward"),
};
