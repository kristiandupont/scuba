import * as assert from "assert";

import { makeExtremityMotion } from "./makeExtremityMotion";
import { applySelection, setupTextEditorWithCursors } from "../test/helpers";

suite("makeExtremityMotion", () => {
  const startMotion = makeExtremityMotion("start");
  const endMotion = makeExtremityMotion("end");

  test('test "start" motion', async () => {
    const editor = await setupTextEditorWithCursors("Hello []world\n");
    const selections = startMotion(editor.selections[0], editor.document);
    const result = await applySelection(editor, selections);
    assert.equal(result, "[Hello ]world\n");

    // The anchor should be *after* the active position:
    assert.equal(selections[0].anchor.character, 6);
    assert.equal(selections[0].active.character, 0);
  });

  test('test "end" motion', async () => {
    const editor = await setupTextEditorWithCursors("Hello []world\n");
    const selections = endMotion(editor.selections[0], editor.document);
    const result = await applySelection(editor, selections);
    assert.equal(result, "Hello [world]\n");

    // The anchor should be *before* the active position:
    assert.equal(selections[0].anchor.character, 6);
    assert.equal(selections[0].active.character, 11);
  });
});
