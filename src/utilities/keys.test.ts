import * as assert from "assert";
import {
  isNonCharacterKey,
  singleCharacter,
  splitKeyTokens,
} from "./keys";

suite("key tokens", () => {
  test("plain characters are one token each", () => {
    assert.deepStrictEqual(splitKeyTokens("abc"), ["a", "b", "c"]);
  });

  test("a bracketed key is a single token", () => {
    assert.deepStrictEqual(splitKeyTokens("<up>"), ["<up>"]);
  });

  test("bracketed and plain keys mix", () => {
    assert.deepStrictEqual(splitKeyTokens("d<s-tab>x"), ["d", "<s-tab>", "x"]);
  });

  test("a bare angle bracket is still a character", () => {
    assert.deepStrictEqual(splitKeyTokens("<"), ["<"]);
    assert.deepStrictEqual(splitKeyTokens("a<b"), ["a", "<", "b"]);
  });

  test("an empty chain has no tokens", () => {
    assert.deepStrictEqual(splitKeyTokens(""), []);
  });

  test("recognizes non-character keys", () => {
    assert.strictEqual(isNonCharacterKey("<pagedown>"), true);
    assert.strictEqual(isNonCharacterKey("<"), false);
    assert.strictEqual(isNonCharacterKey("a"), false);
  });

  test("a single character is returned as itself", () => {
    assert.strictEqual(singleCharacter("x"), "x");
    assert.strictEqual(singleCharacter("<"), "<");
  });

  test("a non-character key has no character", () => {
    assert.strictEqual(singleCharacter("<up>"), null);
  });

  test("more than one key has no single character", () => {
    assert.strictEqual(singleCharacter("ab"), null);
    assert.strictEqual(singleCharacter(""), null);
  });
});
