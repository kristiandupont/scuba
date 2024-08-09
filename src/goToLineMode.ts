import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";

export const goToLineMode: Mode = {
  isInsertMode: false,
  name: "go-to-line",
  statusItemText: "Go to Line",
  color: "lime",
  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys.endsWith("\n")) {
      keys = keys.slice(0, -1);
      const line = parseInt(keys, 10);

      if (isNaN(line)) {
        vscode.window.showErrorMessage(`Invalid line number: ${keys}`);
        return;
      }

      const position = textEditor.document.positionAt(
        textEditor.document.offsetAt(new vscode.Position(line - 1, 0))
      );
      textEditor.selection = new vscode.Selection(position, position);

      await vscode.commands.executeCommand("revealLine", {
        lineNumber: line,
      });

      changeMode({ mode: defaultMode });
    }
  },
};
