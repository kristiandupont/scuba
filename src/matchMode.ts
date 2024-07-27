import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";

export const matchMode: Mode = {
  isInsertMode: false,
  name: "match",
  statusItemText: "Match",

  handleSubCommandChain: makeSubChainHandler(
    [
      { keys: "m", command: "editor.action.jumpToBracket" },

      // Inside
      { keys: 'i"', command: "extension.selectDoubleQuote" },
      { keys: "i'", command: "extension.selectSingleQuote" },
      { keys: "i(", command: "extension.selectParenthesis" },
      { keys: "i[", command: "extension.selectSquareBrackets" },
      { keys: "i{", command: "extension.selectCurlyBrackets" },
      { keys: "i`", command: "extension.selectBackTick" },
      { keys: "i<", command: "extension.selectAngleBrackets" },
      {
        keys: "iw",
        command: async function () {
          await vscode.commands.executeCommand("cursorWordStartLeft");
          await vscode.commands.executeCommand("cursorWordEndRightSelect");
        },
      },
      { keys: "iq", command: "extension.selectEitherQuote" },

      // Around
      { keys: "a(", command: "extension.selectParenthesisOuter" },
      { keys: "a[", command: "extension.selectSquareBracketsOuter" },
      { keys: "a{", command: "extension.selectCurlyBracketsOuter" },
      { keys: "a<", command: "extension.selectInTag" },
      {
        keys: "aw",
        command: async function () {
          await vscode.commands.executeCommand("cursorWordStartLeft");
          await vscode.commands.executeCommand("cursorWordEndRightSelect");
        },
      },
    ],
    "normal"
  ),
};
