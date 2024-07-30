import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { clipboardKeys } from "./normalMode";

export const lineSelectMode: Mode = {
  isInsertMode: false,
  name: "line-select",
  statusItemText: "Line Select",
  color: new vscode.ThemeColor("editor.foreground"),

  onEnter: async function () {
    // Move the cursor to the absolute column 0 of the current line
    await vscode.commands.executeCommand("cursorMove", {
      to: "wrappedLineStart",
      by: "character",
      value: 0,
    });
    await vscode.commands.executeCommand("cursorDownSelect");
  },

  handleSubCommandChain: makeSubChainHandler([
    { keys: "<up>", command: "cursorUpSelect" },
    { keys: "<down>", command: "cursorDownSelect" },
    ...clipboardKeys,
  ]),
};
