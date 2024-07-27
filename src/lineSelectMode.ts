import * as vscode from "vscode";
import { Mode, resetCommandChain } from "./extension";

export const lineSelectMode: Mode = {
  isInsertMode: false,
  name: "line-select",
  statusItemText: "Line Select",
  onEnter: async function () {
    await vscode.commands.executeCommand("cursorHome");
    await vscode.commands.executeCommand("cursorHome");
    await vscode.commands.executeCommand("cursorEndSelect");
  },

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const selections = textEditor.selections;

    if (keys === "<up>") {
      // If cursor is above the anchor, extend the selection with the entire line above the cursor
      // If it's below the anchor, move the cursor down one line and shrink the selection to just the cursor.

      const newSelections = selections.map((selection) => {
        const anchor = selection.anchor;
        const active = selection.active;

        if (active.line < anchor.line) {
          const start = new vscode.Position(active.line - 1, 0);
          const end = anchor;
          return new vscode.Selection(start, end);
        } else {
          const start = active.translate(1, 0);
          return new vscode.Selection(start, start);
        }
      });

      textEditor.selections = newSelections;
    } else if (keys === "<down>") {
      // If cursor is below the anchor, extend the selection with the entire line below the cursor
      // If it's above the anchor, move the cursor up one line and shrink the selection to just the cursor.

      const newSelections = selections.map((selection) => {
        const anchor = selection.anchor;
        const active = selection.active;

        if (active.line > anchor.line) {
          const start = anchor;
          const end = new vscode.Position(active.line + 1, 0);
          return new vscode.Selection(start, end);
        } else {
          const start = active.translate(-1, 0);
          return new vscode.Selection(start, start);
        }
      });

      textEditor.selections = newSelections;
    }

    resetCommandChain();
  },
};
