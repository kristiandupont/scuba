import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";
import {
  isAnyTextSelected,
  restoreSelections,
  storeSelections,
} from "./utilities/selection";
import {
  selectFirstChildNode,
  selectParentNode,
} from "./smart-select-commands";

export const smartSelectMode: Mode = {
  isInsertMode: false,
  name: "smart-select",
  statusItemText: "Smart Select",
  onEnter: async function () {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }
    storeSelections(editor);
    if (!isAnyTextSelected(editor)) {
      await vscode.commands.executeCommand("editor.action.smartSelect.expand");
    }
  },
  handleSubCommandChain: makeSubChainHandler([
    { keys: "<up>", command: "scuba.selectPrevSibling" },
    { keys: "<down>", command: "scuba.selectNextSibling" },
    {
      keys: "<left>",
      command: async () => {
        selectFirstChildNode();
      },
    },
    {
      keys: "<right>",
      command: async () => {
        selectParentNode();
      },
    },
    { keys: "<a-left>", command: "editor.action.smartSelect.shrink" },
    { keys: "<a-right>", command: "editor.action.smartSelect.expand" },
    { keys: "p", command: "scuba.selectFirstParameter" },
    { keys: "e", command: "scuba.selectElement" },
    { keys: "t", command: "scuba.selectTagName", leaveInMode: "insert" },

    { keys: "v", leaveInMode: "select" },
    { keys: "V", leaveInMode: "line-select" },

    ...sharedSelectionKeys,
  ]),
};
