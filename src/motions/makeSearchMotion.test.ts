import * as assert from "assert";
import { makeSearchMotion } from "./makeSearchMotion";
import { setupTextEditorWithCursors, applySelection } from "../test/helpers";

async function testSearchMotion(
  input: string,
  character: string,
  mode: "inclusive" | "exclusive",
  direction: "forward" | "backward",
  expected: string
) {
  const editor = await setupTextEditorWithCursors(input);
  const motion = makeSearchMotion(character, mode, direction);
  const selections = motion(editor.selections[0], editor.document);
  assert.strictEqual(
    applySelection(editor, selections),
    expected,
    `${direction} ${mode} search for '${character}' from '${input}'`
  );
}

suite("search motion", () => {
  // `[]` marks the cursor. vim: `df(` on foo(bar) leaves `bar)`.
  test("f is inclusive forward: takes the match", async () => {
    await testSearchMotion(
      "[]foo(bar) baz",
      "(",
      "inclusive",
      "forward",
      "[foo(]bar) baz"
    );
  });

  // vim: `dt(` leaves `(bar)`.
  test("t is exclusive forward: stops before the match", async () => {
    await testSearchMotion(
      "[]foo(bar) baz",
      "(",
      "exclusive",
      "forward",
      "[foo](bar) baz"
    );
  });

  // vim: `dF(` from the space leaves `foo baz` -- the `(` goes too.
  test("F backward", async () => {
    await testSearchMotion(
      "foo(bar)[] baz",
      "(",
      "inclusive",
      "backward",
      "foo([bar)] baz"
    );
  });

  // vim: `dT(` from the space leaves `foo( baz` -- the `(` stays.
  test("T backward", async () => {
    await testSearchMotion(
      "foo(bar)[] baz",
      "(",
      "exclusive",
      "backward",
      "foo[(bar)] baz"
    );
  });
});
