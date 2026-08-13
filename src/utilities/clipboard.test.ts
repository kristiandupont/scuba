import * as assert from "assert";
import { isLinewise, writeClipboard } from "./clipboard";

suite("clipboard linewise tracking", () => {
  test("a linewise yank is recognized when the clipboard is untouched", async () => {
    await writeClipboard("const x = 1;\n", true);
    assert.strictEqual(isLinewise("const x = 1;\n"), true);
  });

  test("a charwise yank is not linewise", async () => {
    await writeClipboard("const x = 1;", false);
    assert.strictEqual(isLinewise("const x = 1;"), false);
  });

  test("text from elsewhere is charwise even when it ends in a newline", async () => {
    await writeClipboard("const x = 1;\n", true);
    assert.strictEqual(isLinewise("something else entirely\n"), false);
  });

  test("survives line endings being rewritten in transit", async () => {
    await writeClipboard("first\nsecond\n", true);
    assert.strictEqual(isLinewise("first\r\nsecond\r\n"), true);
  });

  test("survives the trailing newline being stripped in transit", async () => {
    await writeClipboard("first\nsecond\n", true);
    assert.strictEqual(isLinewise("first\nsecond"), true);
  });

  test("a linewise yank of the last line gains the newline it never had", async () => {
    // The last line of a file has no trailing newline to copy; normalizing on
    // write is what lets it still paste as a line.
    await writeClipboard("last line", true);
    assert.strictEqual(isLinewise("last line\n"), true);
    assert.strictEqual(isLinewise("last line"), true);
  });

  test("the most recent yank replaces the previous one", async () => {
    await writeClipboard("a line\n", true);
    await writeClipboard("a fragment", false);
    assert.strictEqual(isLinewise("a fragment"), false);
    assert.strictEqual(isLinewise("a line\n"), false);
  });
});
