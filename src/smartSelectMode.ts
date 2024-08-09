import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";
import { isAnyTextSelected, storeSelections } from "./utilities/selection";
import {
  moveSiblingNode,
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
      selectParentNode();
    }
  },
  handleSubCommandChain: makeSubChainHandler([
    {
      keys: "<left>",
      command: async () => {
        selectParentNode();
      },
    },
    {
      keys: "<right>",
      command: async () => {
        selectFirstChildNode();
      },
    },
    { keys: "<up>", command: "scuba.selectPrevSibling" },
    { keys: "<down>", command: "scuba.selectNextSibling" },

    { keys: "<a-up>", command: async () => moveSiblingNode("prev") },
    { keys: "<a-down>", command: async () => moveSiblingNode("next") },

    { keys: "<c-left>", command: "editor.action.smartSelect.expand" },
    { keys: "<c-right>", command: "editor.action.smartSelect.shrink" },
    { keys: "p", command: "scuba.selectFirstParameter" },
    { keys: "e", command: "scuba.selectElement" },
    { keys: "t", command: "scuba.selectTagName", leaveInMode: "insert" },

    { keys: "v", leaveInMode: "select" },
    { keys: "V", leaveInMode: "line-select" },

    ...sharedSelectionKeys,
  ]),
};
