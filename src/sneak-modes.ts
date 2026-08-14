import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";
import { isNonCharacterKey, splitKeyTokens } from "./utilities/keys";

function makeSneakHandler(direction: "forward" | "backward") {
  return async function (keys: string, textEditor: vscode.TextEditor) {
    const tokens = splitKeyTokens(keys);

    if (tokens.some(isNonCharacterKey)) {
      // An arrow key or similar can't be part of a search term. Cancel.
      await changeMode({ mode: defaultMode });
      return;
    }

    if (tokens.length < 2) {
      // Wait for the second character.
      return;
    }

    const word = tokens.slice(0, 2).join("").toLowerCase();
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
    await changeMode({ mode: defaultMode });
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
