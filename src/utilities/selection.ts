import * as vscode from "vscode";
import { isLinewise } from "./clipboard";

export function isAnyTextSelected(textEditor: vscode.TextEditor) {
  return textEditor.selections.some((selection) => {
    return !selection.isEmpty;
  });
}

let previousSelectionsStack: (readonly vscode.Selection[])[] = [];
let previousSelectionsStackIndex = 0;

export function pushSelections(textEditor: vscode.TextEditor) {
  // If we are not at the top of the stack, truncate the stack
  if (previousSelectionsStackIndex < previousSelectionsStack.length) {
    previousSelectionsStack = previousSelectionsStack.slice(
      0,
      previousSelectionsStackIndex
    );
  }

  previousSelectionsStack.push(textEditor.selections);
  previousSelectionsStackIndex++;

  if (previousSelectionsStack.length > 32) {
    previousSelectionsStack.shift();
    previousSelectionsStackIndex--;
  }
}

export function popSelections(textEditor: vscode.TextEditor) {
  if (previousSelectionsStackIndex > 0) {
    previousSelectionsStackIndex--;
    const previousSelections =
      previousSelectionsStack[previousSelectionsStackIndex];
    textEditor.selections = previousSelections;
    textEditor.revealRange(textEditor.selection);
  }
}

export function undoPopSelections(textEditor: vscode.TextEditor) {
  if (previousSelectionsStackIndex < previousSelectionsStack.length - 1) {
    previousSelectionsStackIndex++;
    const nextSelections =
      previousSelectionsStack[previousSelectionsStackIndex];
    textEditor.selections = nextSelections;
    textEditor.revealRange(textEditor.selection);
  }
}

export async function lineModeAwarePaste(
  editor: vscode.TextEditor,
  place: "before" | "after"
): Promise<void> {
  if (isAnyTextSelected(editor)) {
    // Pasting over a selection replaces it, whatever shape the yank was.
    await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
    return;
  }

  const text = await vscode.env.clipboard.readText();

  if (!isLinewise(text)) {
    if (place === "after") {
      await vscode.commands.executeCommand("cursorRight");
    }
    await vscode.commands.executeCommand("editor.action.clipboardPasteAction");
    return;
  }

  const document = editor.document;
  const lastLine = document.lineCount - 1;
  const body = text.endsWith("\n") ? text : text + "\n";

  // Where the pasted block will begin, recorded before the edit shifts things.
  const singleCursor = editor.selections.length === 1;
  const cursorLine = editor.selection.active.line;
  const blockStartLine = place === "before" ? cursorLine : cursorLine + 1;

  await editor.edit((editBuilder) => {
    for (const selection of editor.selections) {
      const targetLine =
        place === "before" ? selection.active.line : selection.active.line + 1;

      if (targetLine > lastLine) {
        // Nothing below the last line to insert in front of, and the last line
        // may have no newline of its own, so append one along with the text.
        editBuilder.insert(
          document.lineAt(lastLine).range.end,
          "\n" + body.replace(/\n$/, "")
        );
      } else {
        editBuilder.insert(new vscode.Position(targetLine, 0), body);
      }
    }
  });

  // Land the cursor on the pasted text, as vim does. With several cursors the
  // insertions shift each other, so leave those where VSCode adjusted them.
  if (singleCursor) {
    const landing = document.lineAt(Math.min(blockStartLine, document.lineCount - 1));
    const position = landing.range.start.translate(
      0,
      landing.firstNonWhitespaceCharacterIndex
    );
    editor.selection = new vscode.Selection(position, position);
    editor.revealRange(editor.selection);
  }
}
