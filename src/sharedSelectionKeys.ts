import * as vscode from "vscode";
import { defaultMode, KeyMap } from "./extension";
import {
  isAnyTextSelected,
  lineModeAwarePaste,
  popSelections,
  undoPopSelections,
} from "./utilities/selection";

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
    leaveInMode: defaultMode,
  },
  { keys: "<a-up>", command: "editor.action.moveLinesUpAction" },
  { keys: "<a-down>", command: "editor.action.moveLinesDownAction" },

  { keys: "v", leaveInMode: "select" },
  { keys: "V", leaveInMode: "line-select" },
  { keys: "S", leaveInMode: "smart-select" },
  { keys: "s", leaveInMode: "surround" },

  {
    keys: "gc",
    command: "editor.action.commentLine",
    leaveInMode: defaultMode,
  },
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
    command: async function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      if (isAnyTextSelected(editor)) {
        await vscode.commands.executeCommand(
          "editor.action.transformToLowercase"
        );
      } else {
        // Make the character under the cursor lowercase:
        await editor.edit((editBuilder) => {
          const position = editor.selection.active;
          const range = new vscode.Range(position, position.translate(0, 1));
          const text = editor.document.getText(range);
          editBuilder.replace(range, text.toLowerCase());
        });
      }
      return defaultMode;
    },
  },
  {
    keys: "U",
    command: async function () {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      if (isAnyTextSelected(editor)) {
        await vscode.commands.executeCommand(
          "editor.action.transformToUppercase"
        );
      } else {
        // Make the character under the cursor uppercase:
        await editor.edit((editBuilder) => {
          const position = editor.selection.active;
          const range = new vscode.Range(position, position.translate(0, 1));
          const text = editor.document.getText(range);
          editBuilder.replace(range, text.toUpperCase());
        });
      }
      return defaultMode;
    },
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
  {
    keys: "<s-backspace>",
    command: async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      undoPopSelections(editor);
    },
  },
];
