import * as assert from "assert";
import * as vscode from "vscode";

import { nodeMotion } from "./nodeMotion";
import { loadLanguage } from "../utilities/parse-tree";
import { applySelection } from "../test/helpers";

async function setupJsEditorWithCursors(input: string): Promise<vscode.TextEditor> {
  let text = "";
  let selectionStart = 0;
  const selections: vscode.Selection[] = [];

  function positionFromOffset(src: string, offset: number): vscode.Position {
    let line = 0;
    let col = 0;
    for (let i = 0; i < offset; i++) {
      if (src[i] === "\n") { line++; col = 0; } else { col++; }
    }
    return new vscode.Position(line, col);
  }

  for (let i = 0; i < input.length; i++) {
    if (input[i] === "[") {
      selectionStart = text.length;
    } else if (input[i] === "]") {
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

async function testNodeMotion(input: string, expected: string) {
  const editor = await setupJsEditorWithCursors(input);
  const selections = nodeMotion(editor.selections[0], editor.document);
  const result = applySelection(editor, selections);
  assert.equal(result, expected, `nodeMotion failed from '${input}'`);
}

suite("nodeMotion", () => {
  suiteSetup(async () => {
    // Ensure the JS parser wasm is loaded before any test runs
    await loadLanguage("javascript");
  });

  test("selects identifier under cursor", async () => {
    await testNodeMotion(
      "const fo[]o = 42;\n",
      "const [foo] = 42;\n"
    );
  });

  test("selects number literal", async () => {
    await testNodeMotion(
      "const foo = 4[]2;\n",
      "const foo = [42];\n"
    );
  });

  test("selects string content (tree-sitter excludes quotes)", async () => {
    // namedDescendantForPosition returns the string_fragment node (content
    // without quotes) when the cursor is inside a string literal
    await testNodeMotion(
      'const x = "hel[]lo";\n',
      'const x = "[hello]";\n'
    );
  });

  test("selects pair node under cursor in object", async () => {
    // The smallest named node at `b` inside an object is the pair node (`b: 2`),
    // not just the identifier — use `ib`/`ab` for the whole object scope
    await testNodeMotion(
      "const x = { a: 1, b[]: 2 };\n",
      "const x = { a: 1, [b: 2] };\n"
    );
  });

  test("selects argument node under cursor", async () => {
    // The smallest named node at `baz` is the identifier `baz`,
    // not the enclosing call expression
    await testNodeMotion(
      "foo(bar, ba[]z);\n",
      "foo(bar, [baz]);\n"
    );
  });
});
