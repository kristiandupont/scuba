import * as assert from "assert";

import { motions } from "./motions";
import { applySelection, setupTextEditorWithCursors } from "../test/helpers";

type MotionTestSetup = {
  motion: string;
  input: string;
  expected: string;
};

async function testMotion({ motion, input, expected }: MotionTestSetup) {
  const m = motions[motion];

  const editor = await setupTextEditorWithCursors(input);
  const selections = m(editor.selections[0], editor.document);
  const result = await applySelection(editor, selections);
  assert.equal(result, expected, `Motion ${motion} failed from '${input}'`);
}

async function testMotionCombinations(
  motion: string,
  tests: [input: string, expected: string][]
) {
  for (const [input, expected] of tests) {
    await testMotion({ motion, input, expected });
  }
}

suite("motions", () => {
  test("word forward", async () => {
    await testMotionCombinations("w", [
      ["[]Hello world\n", "[Hello ]world\n"],
      ["Hello[] world\n", "Hello[ ]world\n"],
      ["Hello []world\n", "Hello [world]\n"],
      ["Hello wo[]rld\n", "Hello wo[rld]\n"],
    ]);
  });

  // test("word backward", async () => {
  //   await testMotionCombinations("b", [
  //     ["Hello[] world\n", "[Hello] world\n"],
  //     ["Hello []world\n", "Hello[ ]world\n"],
  //     ["Hello wo[]rld\n", "Hello [wo]rld\n"],
  //     ["Hello []world\n", "Hello[ ]world\n"],
  //   ]);
  // });

  test("inside word", async () => {
    await testMotionCombinations("iw", [
      ["[]Hello world\n", "[Hello] world\n"],
      ["Hello[] world\n", "Hello world\n"],
      ["Hello []world\n", "Hello [world]\n"],
      ["Hello wo[]rld\n", "Hello [world]\n"],
    ]);
  });

  test("inside quotes", async () => {
    await testMotionCombinations("iq", [
      ['First "sec[]ond" third\n', 'First "[second]" third\n'],
    ]);
  });

  test('bracket pair, "around"', async () => {
    await testMotionCombinations("a(", [
      ["First [](second) third\n", "First [(second)] third\n"],
      ["First[] (second) third\n", "First (second) third\n"],
      ["First ([]second) third\n", "First [(second)] third\n"],
      ["First (sec[]ond) third\n", "First [(second)] third\n"],
      ["First (second[]) third\n", "First [(second)] third\n"],
      ["First (second)[] third\n", "First (second) third\n"],
    ]);

    // Multi line:
    await testMotionCombinations("a(", [
      [
        ["First (second", "th[]ird) fourth"].join("\n"),
        ["First [(second", "third)] fourth"].join("\n"),
      ],
      [
        ["First (", "sec[]ond", "third)"].join("\n"),
        ["First [(", "second", "third)]"].join("\n"),
      ],
    ]);
  });

  test("bracket pair, 'inside'", async () => {
    await testMotionCombinations("i(", [
      ["First [](second) third\n", "First ([second]) third\n"],
      ["First[] (second) third\n", "First (second) third\n"],
      ["First ([]second) third\n", "First ([second]) third\n"],
      ["First (sec[]ond) third\n", "First ([second]) third\n"],
      ["First (second[]) third\n", "First ([second]) third\n"],
      ["First (second)[] third\n", "First (second) third\n"],
    ]);

    // Multi line:
    await testMotionCombinations("i(", [
      [
        ["First (second", "th[]ird) fourth"].join("\n"),
        ["First ([second", "third]) fourth"].join("\n"),
      ],
      [
        ["First (", "sec[]ond", "third)"].join("\n"),
        ["First ([", "second", "third])"].join("\n"),
      ],
    ]);
  });
});
