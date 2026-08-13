import * as assert from "assert";
import * as vscode from "vscode";

import { spreadToSiblings } from "./smart-select-commands";
import { loadLanguage } from "./utilities/parse-tree";

// These tests are all about arrays, so the usual `[`/`]` selection markers
// would collide with real array brackets in the source. Use guillemets
// instead, which never appear in the code under test.
const SELECTION_START = "«";
const SELECTION_END = "»";

async function setupJsEditorWithCursors(
  input: string,
): Promise<vscode.TextEditor> {
  let text = "";
  let selectionStart = 0;
  const selections: vscode.Selection[] = [];

  function positionFromOffset(src: string, offset: number): vscode.Position {
    let line = 0;
    let col = 0;
    for (let i = 0; i < offset; i++) {
      if (src[i] === "\n") {
        line++;
        col = 0;
      } else {
        col++;
      }
    }
    return new vscode.Position(line, col);
  }

  for (let i = 0; i < input.length; i++) {
    if (input[i] === SELECTION_START) {
      selectionStart = text.length;
    } else if (input[i] === SELECTION_END) {
      const startPos = positionFromOffset(text, selectionStart);
      const endPos = positionFromOffset(text, text.length);
      selections.push(new vscode.Selection(startPos, endPos));
    } else {
      text += input[i];
    }
  }

  const document = await vscode.workspace.openTextDocument({
    content: text,
    language: "javascript",
  });
  const editor = await vscode.window.showTextDocument(document);
  editor.selections = selections;
  return editor;
}

function applySelection(
  editor: vscode.TextEditor,
  selections: readonly vscode.Selection[],
): string {
  const { document } = editor;
  const text = document.getText();
  const result: string[] = [];
  let lastIndex = 0;

  const sorted = [...selections].sort(
    (a, b) => document.offsetAt(a.start) - document.offsetAt(b.start),
  );

  for (const selection of sorted) {
    const startOffset = document.offsetAt(selection.start);
    const endOffset = document.offsetAt(selection.end);
    result.push(text.substring(lastIndex, startOffset));
    result.push(SELECTION_START);
    result.push(text.substring(startOffset, endOffset));
    result.push(SELECTION_END);
    lastIndex = endOffset;
  }

  result.push(text.substring(lastIndex));
  return result.join("");
}

async function testSpread(
  input: string,
  expected: string,
  sameTypeOnly = true,
) {
  const editor = await setupJsEditorWithCursors(input);
  spreadToSiblings(sameTypeOnly);
  const result = applySelection(editor, editor.selections);
  assert.equal(result, expected, `spreadToSiblings failed from '${input}'`);
}

suite("spreadToSiblings", () => {
  suiteSetup(async () => {
    // loadLanguage resolves the parser wasm relative to the extension path,
    // which is only set once the extension has activated. Depending on suite
    // ordering this can run first, so activate explicitly rather than
    // relying on another suite having done it already.
    await vscode.extensions.getExtension("KristianDupont.scuba-modal")?.activate();
    await loadLanguage("javascript");
  });

  test("selects every object in an array regardless of formatting", async () => {
    // The whole point: the second object is split across lines by Prettier,
    // which makes it unreachable with line- or regex-based primitives.
    await testSpread(
      `
const items = [
  «{ id: 1, name: "a" }»,
  {
    id: 2,
    name: "b",
  },
  { id: 3, name: "c" },
];
`,
      `
const items = [
  «{ id: 1, name: "a" }»,
  «{
    id: 2,
    name: "b",
  }»,
  «{ id: 3, name: "c" }»,
];
`,
    );
  });

  test("selects every property in an object", async () => {
    await testSpread(
      "const x = { «a: 1», b: 2, c: 3 };\n",
      "const x = { «a: 1», «b: 2», «c: 3» };\n",
    );
  });

  test("skips siblings of a different type", async () => {
    await testSpread(
      'const items = [«{ a: 1 }», "skip me", { b: 2 }];\n',
      'const items = [«{ a: 1 }», "skip me", «{ b: 2 }»];\n',
    );
  });

  test("includes siblings of a different type when sameTypeOnly is false", async () => {
    await testSpread(
      'const items = [«{ a: 1 }», "keep me", { b: 2 }];\n',
      'const items = [«{ a: 1 }», «"keep me"», «{ b: 2 }»];\n',
      false,
    );
  });

  test("collapses two cursors in the same list to one set of selections", async () => {
    await testSpread(
      "const items = [«{ a: 1 }», { b: 2 }, «{ c: 3 }»];\n",
      "const items = [«{ a: 1 }», «{ b: 2 }», «{ c: 3 }»];\n",
    );
  });
});
