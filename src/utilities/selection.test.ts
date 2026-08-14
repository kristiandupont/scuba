import * as assert from "assert";
import * as vscode from "vscode";
import {
  forgetSelectionHistory,
  popSelections,
  pushSelections,
  undoPopSelections,
} from "./selection";
import { setupTextEditorWithCursors } from "../test/helpers";

function selectionText(editor: vscode.TextEditor) {
  return editor.selections
    .map((selection) => editor.document.getText(selection))
    .join("|");
}

function select(editor: vscode.TextEditor, text: string) {
  const offset = editor.document.getText().indexOf(text);
  editor.selections = [
    new vscode.Selection(
      editor.document.positionAt(offset),
      editor.document.positionAt(offset + text.length)
    ),
  ];
}

suite("selection history", () => {
  let editor: vscode.TextEditor;

  setup(async () => {
    editor = await setupTextEditorWithCursors("alpha beta gamma");
    forgetSelectionHistory(editor.document);
  });

  test("going back restores the pushed selection", () => {
    select(editor, "alpha");
    pushSelections(editor);
    select(editor, "beta");

    popSelections(editor);

    assert.strictEqual(selectionText(editor), "alpha");
  });

  test("going forward returns to where back was pressed", () => {
    select(editor, "alpha");
    pushSelections(editor);
    select(editor, "beta");

    popSelections(editor);
    undoPopSelections(editor);

    assert.strictEqual(selectionText(editor), "beta");
  });

  test("back and forward can be walked repeatedly", () => {
    select(editor, "alpha");
    pushSelections(editor);
    select(editor, "beta");

    popSelections(editor);
    undoPopSelections(editor);
    popSelections(editor);

    assert.strictEqual(selectionText(editor), "alpha");
  });

  test("several levels unwind in order", () => {
    select(editor, "alpha");
    pushSelections(editor);
    select(editor, "beta");
    pushSelections(editor);
    select(editor, "gamma");

    popSelections(editor);
    assert.strictEqual(selectionText(editor), "beta");

    popSelections(editor);
    assert.strictEqual(selectionText(editor), "alpha");

    undoPopSelections(editor);
    assert.strictEqual(selectionText(editor), "beta");
  });

  test("going somewhere new abandons the forward history", () => {
    select(editor, "alpha");
    pushSelections(editor);
    select(editor, "beta");
    popSelections(editor);

    // A fresh push from here replaces what forward would have gone to.
    select(editor, "gamma");
    pushSelections(editor);
    select(editor, "alpha");

    undoPopSelections(editor);

    assert.strictEqual(selectionText(editor), "alpha");
  });

  test("going back with no history leaves the selection alone", () => {
    select(editor, "beta");
    popSelections(editor);

    assert.strictEqual(selectionText(editor), "beta");
  });

  test("going forward with nothing to redo leaves the selection alone", () => {
    select(editor, "beta");
    undoPopSelections(editor);

    assert.strictEqual(selectionText(editor), "beta");
  });
});
