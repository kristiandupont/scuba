import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";
import { isAnyTextSelected, pushSelections } from "./utilities/selection";
import {
  moveSiblingNode,
  selectCurrentNode,
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
    pushSelections(editor);
    if (!isAnyTextSelected(editor)) {
      selectCurrentNode();
    }
  },
  handleSubCommandChain: makeSubChainHandler([
    {
      keys: "<left>",
      command: async () => {
        pushSelections(vscode.window.activeTextEditor!);
        selectParentNode();
      },
    },
    {
      keys: "<right>",
      command: async () => {
        pushSelections(vscode.window.activeTextEditor!);
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

    ...sharedSelectionKeys,
  ]),
};
