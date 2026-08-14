import * as vscode from "vscode";
import { isLinewise } from "./clipboard";

export function isAnyTextSelected(textEditor: vscode.TextEditor) {
  return textEditor.selections.some((selection) => {
    return !selection.isEmpty;
  });
}

/**
 * Selection history, as a pair of stacks rather than one stack with a cursor.
 *
 * Going back has to record where it came from, or there is nothing to go
 * forward to -- which is why the previous single-stack version could never
 * redo. Kept per document, since restoring one file's selections into another
 * is meaningless and can land outside its bounds.
 */
type SelectionHistory = {
  back: (readonly vscode.Selection[])[];
  forward: (readonly vscode.Selection[])[];
};

const historyLimit = 32;
const histories = new Map<string, SelectionHistory>();

function historyFor(textEditor: vscode.TextEditor): SelectionHistory {
  const key = textEditor.document.uri.toString();
  let history = histories.get(key);
  if (!history) {
    history = { back: [], forward: [] };
    histories.set(key, history);
  }
  return history;
}

export function forgetSelectionHistory(document: vscode.TextDocument) {
  histories.delete(document.uri.toString());
}

export function pushSelections(textEditor: vscode.TextEditor) {
  const history = historyFor(textEditor);

  history.back.push(textEditor.selections);
  // Moving somewhere new abandons whatever we could have gone forward to.
  history.forward = [];

  if (history.back.length > historyLimit) {
    history.back.shift();
  }
}

export function popSelections(textEditor: vscode.TextEditor) {
  const history = historyFor(textEditor);
  const previous = history.back.pop();
  if (!previous) {
    return;
  }

  history.forward.push(textEditor.selections);
  textEditor.selections = previous;
  textEditor.revealRange(textEditor.selection);
}

export function undoPopSelections(textEditor: vscode.TextEditor) {
  const history = historyFor(textEditor);
  const next = history.forward.pop();
  if (!next) {
    return;
  }

  history.back.push(textEditor.selections);
  textEditor.selections = next;
  textEditor.revealRange(textEditor.selection);
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
