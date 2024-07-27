import * as vscode from "vscode";
import { makeSubChainHandler, Mode, resetCommandChain } from "./extension";
import { clipboardKeys } from "./normalMode";

export const lineSelectMode: Mode = {
  isInsertMode: false,
  name: "line-select",
  statusItemText: "Line Select",
  onEnter: async function () {
    await vscode.commands.executeCommand("cursorHome");
    await vscode.commands.executeCommand("cursorHome");
    await vscode.commands.executeCommand("cursorDownSelect");
  },

  handleSubCommandChain: makeSubChainHandler([
    { keys: "<up>", command: "cursorUpSelect" },
    { keys: "<down>", command: "cursorDownSelect" },
    ...clipboardKeys,
  ]),
};
