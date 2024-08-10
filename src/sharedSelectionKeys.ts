import * as vscode from "vscode";
import { defaultMode, KeyMap } from "./extension";
import { restoreSelections } from "./utilities/selection";

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
    keys: "p",
    command: "editor.action.clipboardPasteAction",
    leaveInMode: defaultMode,
  },

  { keys: "v", leaveInMode: "select" },
  { keys: "V", leaveInMode: "line-select" },
  { keys: "S", leaveInMode: "smart-select" },
  { keys: "s", leaveInMode: "surround" },

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
  {
    keys: "u",
    command: "editor.action.transformToLowercase",
  },
  {
    keys: "U",
    command: "editor.action.transformToUppercase",
  },
  {
    keys: "<backspace>",
    command: async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      restoreSelections(editor);
    },
  },
];
