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
    // Anything that isn't a digit ends the mode rather than sitting in the
    // chain forever; previously one stray letter made Escape the only way out.
    if (!/^\d*\n?$/.test(keys)) {
      await changeMode({ mode: defaultMode });
      return;
    }

    if (keys.endsWith("\n")) {
      keys = keys.slice(0, -1);
      const line = parseInt(keys, 10);

      if (isNaN(line)) {
        await changeMode({ mode: defaultMode });
        return;
      }

      const position = textEditor.document.positionAt(
        textEditor.document.offsetAt(new vscode.Position(line - 1, 0))
      );
      textEditor.selection = new vscode.Selection(position, position);

      await vscode.commands.executeCommand("revealLine", {
        lineNumber: line,
      });

      await changeMode({ mode: defaultMode });
    }
  },
};
