import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { clipboardKeys } from "./normalMode";

export const lineSelectMode: Mode = {
  isInsertMode: false,
  name: "line-select",
  statusItemText: "Line Select",
  color: new vscode.ThemeColor("editor.foreground"),

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
