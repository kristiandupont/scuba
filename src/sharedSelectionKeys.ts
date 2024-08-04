import * as vscode from "vscode";
import { KeyMap } from "./extension";

export const sharedSelectionKeys: KeyMap = [
  {
    keys: "y",
    command: "editor.action.clipboardCopyAction",
    leaveInMode: "normal",
  },
  {
    keys: "d",
    command: "editor.action.clipboardCutAction",
    leaveInMode: "normal",
  },
  {
    keys: "c",
    command: "deleteRight",
    leaveInMode: "insert",
  },
  {
    keys: "s",
    leaveInMode: "surround",
  },
  { keys: "gc", command: "editor.action.commentLine" },
  {
    keys: "zz",
    command: async function () {
      await vscode.commands.executeCommand("revealLine", {
        lineNumber: vscode.window.activeTextEditor?.selection.active.line,
        at: "center",
      });
    },
  },
];
