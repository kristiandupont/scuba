import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";
import {
  lineModeAwarePaste,
  lineModeCopy,
  lineModeCut,
  storeSelections,
} from "./utilities/selection";

// Omit yank and delete because we're overriding those with the line mode versions
const selectionKeys = sharedSelectionKeys.filter(
  (k) => !["y", "d"].includes(k.keys)
);

export const lineSelectMode: Mode = {
  isInsertMode: false,
  name: "line-select",
  statusItemText: "Line Select",
  color: new vscode.ThemeColor("editor.foreground"),

  onEnter: async function () {
    // Make the selection starts and ends at char 0 and takes at least one line.
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    storeSelections(editor);

    const selections = editor.selections.map((selection) => {
      const start = selection.start.with({ character: 0 });
      let end = selection.end;
      if (end.character !== 0) {
        end = end.with({ line: end.line + 1, character: 0 });
      }
      return new vscode.Selection(start, end);
    });

    editor.selections = selections;
  },

  handleSubCommandChain: makeSubChainHandler([
    { keys: "<up>", command: "cursorUpSelect" },
    { keys: "<down>", command: "cursorDownSelect" },
    { keys: "<pageup>", command: "cursorPageUpSelect" },
    { keys: "<pagedown>", command: "cursorPageDownSelect" },

    {
      keys: "y",
      command: async function () {
        lineModeCopy(vscode.window.activeTextEditor!);
      },
      leaveInMode: "normal",
    },
    {
      keys: "d",
      command: async function () {
        lineModeCut(vscode.window.activeTextEditor!);
      },
      leaveInMode: "normal",
    },
    ...selectionKeys,
  ]),
};
