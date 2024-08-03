import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { clipboardKeys } from "./normalMode";

export const smartSelectMode: Mode = {
  isInsertMode: false,
  name: "smart-select",
  statusItemText: "Smart Select",
  onEnter: async function () {
    await vscode.commands.executeCommand("editor.action.smartSelect.expand");
  },
  handleSubCommandChain: makeSubChainHandler([
    { keys: "<up>", command: "scuba.selectPrevSibling" },
    { keys: "<down>", command: "scuba.selectNextSibling" },
    { keys: "<left>", command: "editor.action.smartSelect.shrink" },
    { keys: "<right>", command: "editor.action.smartSelect.expand" },
    { keys: "p", command: "scuba.selectFirstParameter" },
    { keys: "t", command: "scuba.selectElement" },
    { keys: "r", command: "scuba.selectTagName", leaveInMode: "insert" },
    ...clipboardKeys,
  ]),
};
