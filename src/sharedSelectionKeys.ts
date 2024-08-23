import * as vscode from "vscode";
import { defaultMode, KeyMap } from "./extension";
import { lineModeAwarePaste, popSelections } from "./utilities/selection";

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
    command: async function () {
      return lineModeAwarePaste(vscode.window.activeTextEditor!, "after");
    },
    leaveInMode: defaultMode,
  },
  {
    keys: "P",
    command: async function () {
      return lineModeAwarePaste(vscode.window.activeTextEditor!, "before");
    },
  },
  { keys: "<a-up>", command: "editor.action.moveLinesUpAction" },
  { keys: "<a-down>", command: "editor.action.moveLinesDownAction" },

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
    leaveInMode: defaultMode,
  },
  {
    keys: "U",
    command: "editor.action.transformToUppercase",
    leaveInMode: defaultMode,
  },
  {
    keys: "<tab>",
    command: "editor.action.indentLines",
  },
  {
    keys: "<s-tab>",
    command: "editor.action.outdentLines",
  },
  {
    keys: "<backspace>",
    command: async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      popSelections(editor);
    },
  },
];
