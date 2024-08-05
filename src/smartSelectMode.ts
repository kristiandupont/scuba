import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";

let previousSelections: readonly vscode.Selection[] | undefined;

export const smartSelectMode: Mode = {
  isInsertMode: false,
  name: "smart-select",
  statusItemText: "Smart Select",
  onEnter: async function () {
    previousSelections = vscode.window.activeTextEditor?.selections || [];
    await vscode.commands.executeCommand("editor.action.smartSelect.expand");
  },
  handleSubCommandChain: makeSubChainHandler([
    { keys: "<up>", command: "scuba.selectPrevSibling" },
    { keys: "<down>", command: "scuba.selectNextSibling" },
    { keys: "<left>", command: "editor.action.smartSelect.shrink" },
    { keys: "<right>", command: "editor.action.smartSelect.expand" },
    { keys: "p", command: "scuba.selectFirstParameter" },
    { keys: "e", command: "scuba.selectElement" },
    { keys: "t", command: "scuba.selectTagName", leaveInMode: "insert" },
    {
      keys: "u",
      command: async function () {
        if (vscode.window.activeTextEditor && previousSelections) {
          vscode.window.activeTextEditor.selections = previousSelections;
        }
      },
    },

    { keys: "v", leaveInMode: "select" },
    { keys: "V", leaveInMode: "line-select" },

    ...sharedSelectionKeys,
  ]),
};
