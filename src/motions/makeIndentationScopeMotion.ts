import * as vscode from "vscode";

export const makeIndentationScopeMotion =
  (mode: "inside" | "around") =>
  (s: vscode.Selection, doc: vscode.TextDocument): vscode.Selection[] => {
    const cursorLine = s.active.line;
    const cursorIndentation =
      doc.lineAt(cursorLine).firstNonWhitespaceCharacterIndex;
    let startLine = cursorLine;
    let endLine = cursorLine;

    for (let line = cursorLine; line >= 0; line--) {
      const lineText = doc.lineAt(line).text;
      if (lineText.trim() === "") {
        continue;
      }

      if (
        doc.lineAt(line).firstNonWhitespaceCharacterIndex >= cursorIndentation
      ) {
        startLine = line;
      } else {
        break;
      }
    }

    for (let line = cursorLine + 1; line < doc.lineCount; line++) {
      const lineText = doc.lineAt(line).text;
      if (lineText.trim() === "") {
        continue;
      }

      if (
        doc.lineAt(line).firstNonWhitespaceCharacterIndex >= cursorIndentation
      ) {
        endLine = line;
      } else {
        break;
      }
    }

    if (mode === "inside") {
      return [
        new vscode.Selection(
          startLine,
          cursorIndentation,
          endLine,
          doc.lineAt(endLine).text.length
        ),
      ];
    } else {
      // Mode is 'around'.
      // If there is a line below, go to the start of that.

      const isEOF = endLine === doc.lineCount - 1;
      const endChar = isEOF ? doc.lineAt(endLine).text.length : 0;
      endLine = isEOF ? endLine : endLine + 1;
      return [new vscode.Selection(startLine, 0, endLine, endChar)];
    }
  };
