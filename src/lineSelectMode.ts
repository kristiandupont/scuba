import * as vscode from "vscode";
import { makeSubChainHandler, Mode } from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";
import { pushSelections } from "./utilities/selection";

/**
 * Grow or shrink the selection by whole lines.
 *
 * VSCode's cursorUpSelect/cursorDownSelect only move the active end, which
 * collapses the selection the first time you go up (the active end starts at
 * the bottom, on top of the anchor) and leaves the selection off whole-line
 * boundaries once you reverse direction. Recomputing the range from the two
 * line numbers avoids both.
 */
function extendLineSelection(delta: number) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const { document } = editor;
  const lastLine = document.lineCount - 1;

  editor.selections = editor.selections.map((selection) => {
    // A normalized line selection ends at character 0 of the line *after* its
    // last line, so whichever end sits at the bottom needs one subtracted.
    const anchorLine = selection.isReversed
      ? selection.anchor.line - 1
      : selection.anchor.line;
    const activeLine = selection.isReversed
      ? selection.active.line
      : selection.active.line - 1;

    const newActiveLine = Math.max(0, Math.min(lastLine, activeLine + delta));
    const startLine = Math.min(anchorLine, newActiveLine);
    const endLine = Math.max(anchorLine, newActiveLine);

    const top = new vscode.Position(startLine, 0);
    const bottom =
      endLine < lastLine
        ? new vscode.Position(endLine + 1, 0)
        : // Last line of the file: there is no trailing newline to take.
          document.lineAt(endLine).range.end;

    // Keep the moving end as `active` so revealRange scrolls the right way.
    return newActiveLine >= anchorLine
      ? new vscode.Selection(top, bottom)
      : new vscode.Selection(bottom, top);
  });

  editor.revealRange(editor.selection);
}

export const lineSelectMode: Mode = {
  isInsertMode: false,
  name: "line-select",
  statusItemText: "Line Select",
  color: new vscode.ThemeColor("editor.foreground"),

  onEnter: async function () {
    // Make the selection starts and ends at char 0 and takes at least one line.
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    pushSelections(editor);

    const lastLine = editor.document.lineCount - 1;

    const selections = editor.selections.map((selection) => {
      const start = selection.start.with({ character: 0 });

      // A selection that already ends at character 0 covers up to the previous
      // line, so extending it again would take a line the user never saw
      // highlighted.
      const endLine =
        selection.end.character === 0 && selection.end.line > selection.start.line
          ? selection.end.line - 1
          : selection.end.line;

      const end =
        endLine < lastLine
          ? new vscode.Position(endLine + 1, 0)
          : editor.document.lineAt(endLine).range.end;

      return new vscode.Selection(start, end);
    });

    editor.selections = selections;
  },

  handleSubCommandChain: makeSubChainHandler([
    { keys: "<up>", command: async () => extendLineSelection(-1) },
    { keys: "<down>", command: async () => extendLineSelection(1) },
    { keys: "<pageup>", command: async () => extendLineSelection(-10) },
    { keys: "<pagedown>", command: async () => extendLineSelection(10) },

    ...sharedSelectionKeys,
  ]),
};
