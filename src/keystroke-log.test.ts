import * as assert from "assert";
import {
  beginInsertCapture,
  captureInsertChange,
  endInsertCapture,
  foldInsertChange,
  getLastChange,
  recordKey,
  repeatLastChange,
  resetKeystrokeLog,
  setKeystrokeLogDependencies,
  settle,
} from "./keystroke-log";

let documentVersion = 0;
let replayedKeys: string[] = [];

/**
 * Points the log at a stand-in dispatcher that records what it was asked to
 * replay, and at a document version the test drives by hand.
 */
function installLog() {
  resetKeystrokeLog();
  documentVersion = 0;
  replayedKeys = [];

  setKeystrokeLogDependencies({
    handleKey: async (key) => {
      replayedKeys.push(key);
      documentVersion++;
    },
    leaveInsertMode: async () => {},
    resetChain: () => {},
    getDocumentVersion: () => documentVersion,
  });
}

/** The document was edited. */
function edited() {
  documentVersion++;
}

/** Back in normal mode with nothing pending -- a command boundary. */
function atRest() {
  settle({ inDefaultMode: true, chainIsEmpty: true });
}

/** In an operator or visual mode: the chain emptied but we aren't done. */
function inOperatorMode() {
  settle({ inDefaultMode: false, chainIsEmpty: true });
}

/** Mid-chain, waiting for more keys. */
function awaitingMoreKeys() {
  settle({ inDefaultMode: false, chainIsEmpty: false });
}

suite("keystroke log", () => {
  setup(() => installLog());

  test("a command that edits the document becomes the last change", () => {
    recordKey("x");
    edited();
    atRest();
    assert.deepStrictEqual(getLastChange(), [{ key: "x" }]);
  });

  test("a motion that edits nothing is discarded", () => {
    recordKey("w");
    atRest();
    assert.strictEqual(getLastChange(), null);
  });

  test("a motion does not displace an earlier change", () => {
    recordKey("x");
    edited();
    atRest();

    recordKey("w");
    atRest();

    assert.deepStrictEqual(getLastChange(), [{ key: "x" }]);
  });

  test("an operator plus motion is recorded whole", () => {
    // `diw`: d switches to delete mode, i waits, w completes and returns to
    // normal mode.
    recordKey("d");
    inOperatorMode();
    recordKey("i");
    awaitingMoreKeys();
    recordKey("w");
    edited();
    atRest();

    assert.deepStrictEqual(getLastChange(), [
      { key: "d" },
      { key: "i" },
      { key: "w" },
    ]);
  });

  test("the operator key is not dropped when it empties the chain", () => {
    // `ciw` then typing then Escape. `c` empties the command chain but only
    // switches to change mode; treating that as a completed command loses it,
    // and the repeat replays a bare `iw` that inserts instead of replacing.
    recordKey("c");
    inOperatorMode();
    recordKey("i");
    awaitingMoreKeys();
    recordKey("w");
    edited(); // the motion's text is deleted
    inOperatorMode(); // now in insert mode

    beginInsertCapture();
    typeCharacters("xyz");
    endInsertCapture();
    atRest(); // Escape

    assert.deepStrictEqual(getLastChange(), [
      { key: "c" },
      { key: "i" },
      { key: "w" },
      { insertedText: "xyz" },
    ]);
  });

  test("entering and leaving insert without typing records nothing", () => {
    recordKey("i");
    inOperatorMode();
    beginInsertCapture();
    endInsertCapture();
    atRest();

    assert.strictEqual(getLastChange(), null);
  });

  test("a deletion counts as a change even when nothing is typed after it", () => {
    recordKey("c");
    inOperatorMode();
    recordKey("w");
    edited();
    inOperatorMode();

    beginInsertCapture();
    endInsertCapture();
    atRest();

    assert.deepStrictEqual(getLastChange(), [{ key: "c" }, { key: "w" }]);
  });

  test("a selection abandoned with Escape is discarded", () => {
    // Escape never reaches the dispatcher, so the mode change is the only
    // thing that closes this unit.
    recordKey("v");
    inOperatorMode();
    recordKey("<left>");
    inOperatorMode();
    atRest();

    assert.strictEqual(getLastChange(), null);
  });
});

suite("repeating the last change", () => {
  setup(() => installLog());

  test("replays the recorded keys through the dispatcher", async () => {
    recordKey("x");
    edited();
    atRest();

    await repeatLastChange(1);

    assert.deepStrictEqual(replayedKeys, ["x"]);
  });

  test("a count repeats the change that many times", async () => {
    recordKey("x");
    edited();
    atRest();

    await repeatLastChange(3);

    assert.deepStrictEqual(replayedKeys, ["x", "x", "x"]);
  });

  test("repeating does not make the repeat itself the new change", async () => {
    recordKey("x");
    edited();
    atRest();

    recordKey(".");
    await repeatLastChange(1);
    atRest();

    assert.deepStrictEqual(getLastChange(), [{ key: "x" }]);
  });

  test("a second repeat still applies the original change", async () => {
    recordKey("x");
    edited();
    atRest();

    recordKey(".");
    await repeatLastChange(1);
    atRest();

    replayedKeys = [];
    recordKey(".");
    await repeatLastChange(1);
    atRest();

    assert.deepStrictEqual(replayedKeys, ["x"]);
  });

  test("does nothing when no change has been recorded", async () => {
    await repeatLastChange(1);
    assert.deepStrictEqual(replayedKeys, []);
  });
});

suite("insert capture folding", () => {
  test("an insertion appends", () => {
    assert.strictEqual(
      foldInsertChange("con", { text: "s", rangeLength: 0 }),
      "cons"
    );
  });

  test("backspace rewinds", () => {
    assert.strictEqual(
      foldInsertChange("cons", { text: "", rangeLength: 1 }),
      "con"
    );
  });

  test("accepting a completion swaps the typed prefix for the full word", () => {
    assert.strictEqual(
      foldInsertChange("cons", { text: "console", rangeLength: 4 }),
      "console"
    );
  });

  test("an edit reaching past our own capture is not repeatable", () => {
    assert.strictEqual(
      foldInsertChange("ab", { text: "", rangeLength: 5 }),
      null
    );
  });
});

suite("insert capture contiguity", () => {
  setup(() => installLog());

  test("typing straight through is repeatable", () => {
    recordKey("i");
    inOperatorMode();
    beginInsertCapture();
    typeCharacters("abc", 10);
    endInsertCapture();
    atRest();

    assert.deepStrictEqual(getLastChange(), [
      { key: "i" },
      { insertedText: "abc" },
    ]);
  });

  test("moving the cursor mid-session drops the change", () => {
    recordKey("i");
    inOperatorMode();
    beginInsertCapture();

    change({ text: "a", rangeOffset: 10 });
    change({ text: "b", rangeOffset: 11 });
    // Arrow key back to the start of the line, then more typing. Replaying
    // "abX" as one contiguous block would put text where it never was.
    change({ text: "X", rangeOffset: 3 });

    endInsertCapture();
    atRest();

    assert.strictEqual(getLastChange(), null);
  });

  test("backspacing stays contiguous", () => {
    recordKey("i");
    inOperatorMode();
    beginInsertCapture();

    change({ text: "a", rangeOffset: 10 });
    change({ text: "b", rangeOffset: 11 });
    change({ text: "", rangeOffset: 11, rangeLength: 1 });
    change({ text: "c", rangeOffset: 11 });

    endInsertCapture();
    atRest();

    assert.deepStrictEqual(getLastChange(), [
      { key: "i" },
      { insertedText: "ac" },
    ]);
  });
});

function change({
  text,
  rangeOffset,
  rangeLength = 0,
}: {
  text: string;
  rangeOffset: number;
  rangeLength?: number;
}) {
  captureInsertChange({ text, rangeLength, rangeOffset });
  edited();
}

/** Types text into the open insert session one character at a time. */
function typeCharacters(text: string, startOffset = 0) {
  text.split("").forEach((character, index) => {
    change({ text: character, rangeOffset: startOffset + index });
  });
}
