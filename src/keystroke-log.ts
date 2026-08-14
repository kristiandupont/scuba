import * as vscode from "vscode";

/**
 * A recorded unit of input. Keys are replayed through the normal dispatcher;
 * insert-mode typing is collapsed into the text it produced, which also picks
 * up completions and snippet expansions that no key sequence would reproduce.
 */
export type Keystroke = { key: string } | { insertedText: string };

type Dependencies = {
  handleKey: (key: string) => Promise<void>;
  leaveInsertMode: () => Promise<void>;
  resetChain: () => void;
  /** Version of the active document, or null when there is no editor. */
  getDocumentVersion: () => number | null;
};

let deps: Dependencies | null = null;

/** Keys of the command currently being built up, not yet a complete unit. */
let pending: Keystroke[] = [];

/** Document version when the current unit opened, for spotting real edits. */
let unitStartVersion: number | null = null;

/** The last completed unit that changed the document -- the dot register. */
let lastChange: Keystroke[] | null = null;

/** Text typed so far in the current insert session; null when not in one. */
let insertCapture: string | null = null;

/** Document offset the captured text currently ends at, for contiguity. */
let captureEndOffset: number | null = null;

/** Cleared when an insert session does something we can't faithfully replay. */
let insertRepeatable = true;

let replaying = false;

/** Register currently being recorded into, or null when not recording. */
let recordingRegister: string | null = null;

/** Strokes accumulated for the recording in progress. */
let recordingStrokes: Keystroke[] = [];

const macros = new Map<string, Keystroke[]>();

export function setKeystrokeLogDependencies(dependencies: Dependencies) {
  deps = dependencies;
}

export function activateKeystrokeLog(
  context: vscode.ExtensionContext,
  dependencies: Dependencies
) {
  setKeystrokeLogDependencies(dependencies);
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(handleDocumentChange)
  );
}

export function isReplaying() {
  return replaying;
}

export function getLastChange() {
  return lastChange;
}

/** Discards all state. Exported for tests. */
export function resetKeystrokeLog() {
  pending = [];
  unitStartVersion = null;
  lastChange = null;
  captureEndOffset = null;
  insertCapture = null;
  insertRepeatable = true;
  replaying = false;
  recordingRegister = null;
  recordingStrokes = [];
  macros.clear();
}

/**
 * Add a stroke to the command being built up, and to the macro being recorded
 * if there is one. The two consume the same stream but end at different times:
 * a unit ends at the next command boundary, a recording when the user stops it.
 */
function appendStroke(stroke: Keystroke) {
  if (pending.length === 0) {
    unitStartVersion = deps?.getDocumentVersion() ?? null;
  }
  pending.push(stroke);

  if (recordingRegister !== null) {
    recordingStrokes.push(stroke);
  }
}

/** Called for every key, before the dispatcher acts on it. */
export function recordKey(key: string) {
  if (replaying) {
    return;
  }
  appendStroke({ key });
}

/**
 * Called wherever the editor might have come to rest: after a key has been
 * dispatched, and after any mode change.
 *
 * A command is only finished once we are back in the default mode with nothing
 * left in the chain. Keys like `c` and `d` empty the chain but switch to an
 * operator mode, and they open a command rather than completing one -- treating
 * an empty chain alone as the boundary drops them, and `ciw` then replays as a
 * bare `iw`.
 *
 * Escape never reaches the dispatcher (it is bound straight to changeMode), so
 * the mode-change call site is what closes a unit the user abandoned.
 */
export function settle({
  inDefaultMode,
  chainIsEmpty,
}: {
  inDefaultMode: boolean;
  chainIsEmpty: boolean;
}) {
  if (replaying || !inDefaultMode || !chainIsEmpty) {
    return;
  }

  commitUnit();
}

/**
 * Whether the document moved on during the unit. Asking the document is what
 * lets any command count as a change without declaring itself one, and reading
 * it at commit time rather than per key avoids depending on whether the edit
 * landed before or after the mode switch that ended the command.
 */
function unitEditedDocument() {
  const version = deps?.getDocumentVersion() ?? null;
  return (
    unitStartVersion !== null && version !== null && version !== unitStartVersion
  );
}

function commitUnit() {
  if (pending.length > 0 && unitEditedDocument()) {
    lastChange = pending;
  }
  pending = [];
  unitStartVersion = null;
}

/**
 * Throw away the unit being accumulated without committing it.
 *
 * Used by the repeat command itself: pressing `.` edits the document, so
 * without this the `.` keystroke would become the new dot register and repeat
 * would start repeating itself.
 */
export function discardPendingUnit() {
  pending = [];
  unitStartVersion = null;
}

export function beginInsertCapture() {
  if (replaying) {
    return;
  }
  insertCapture = "";
  captureEndOffset = null;
  insertRepeatable = true;
}

export function endInsertCapture() {
  if (replaying) {
    return;
  }

  const captured = insertCapture;
  insertCapture = null;

  if (captured === null) {
    return;
  }

  if (!insertRepeatable) {
    // Something happened mid-session we can't reproduce; drop the whole unit
    // rather than replay a half-right edit.
    discardPendingUnit();

    // A recording can't just skip it -- the keys that opened the session are
    // already in the macro, and replaying those without the text they produced
    // would be wrong. Better to stop and say so than to store a broken macro.
    if (recordingRegister !== null) {
      abortMacroRecording();
    }
    return;
  }

  if (captured.length > 0) {
    appendStroke({ insertedText: captured });
  }

  // Left open deliberately: the mode change that ended the session calls
  // settle() straight after this, and that is what commits the unit.
}

/**
 * Fold one document change into the captured insert text.
 *
 * Insertions append. A change that replaces text covered by what we've already
 * captured rewinds that much and appends the replacement, which handles both
 * backspace (empty replacement) and accepting a completion (the typed prefix
 * swapped for the full word). Anything reaching further back than our own
 * capture is something else editing the document, and isn't repeatable.
 */
export function foldInsertChange(
  captured: string,
  change: { text: string; rangeLength: number }
): string | null {
  if (change.rangeLength === 0) {
    return captured + change.text;
  }
  if (change.rangeLength <= captured.length) {
    return captured.slice(0, captured.length - change.rangeLength) + change.text;
  }
  return null;
}

/**
 * Fold one edit into the current insert session.
 *
 * Edits have to form one contiguous run to be replayable as a single block of
 * text. Moving the cursor mid-session -- with the arrow keys, which Scuba
 * leaves to VSCode while in insert mode, or by clicking -- breaks the run, and
 * the session stops being repeatable rather than replaying text that was never
 * typed in that order.
 */
export function captureInsertChange(change: {
  text: string;
  rangeLength: number;
  rangeOffset: number;
}) {
  if (insertCapture === null) {
    return;
  }

  const contiguous =
    captureEndOffset === null ||
    change.rangeOffset + change.rangeLength === captureEndOffset;
  if (!contiguous) {
    insertRepeatable = false;
    return;
  }

  const folded = foldInsertChange(insertCapture, change);
  if (folded === null) {
    insertRepeatable = false;
    return;
  }

  insertCapture = folded;
  captureEndOffset = change.rangeOffset + change.text.length;
}

function handleDocumentChange(e: vscode.TextDocumentChangeEvent) {
  if (insertCapture === null || replaying) {
    return;
  }
  if (e.document !== vscode.window.activeTextEditor?.document) {
    return;
  }
  if (e.contentChanges.length === 0) {
    return;
  }

  // With several cursors a single keystroke arrives as one change per cursor.
  // They describe the same edit, so only one is folded in.
  const [first, ...rest] = e.contentChanges;
  const uniform = rest.every(
    (change) =>
      change.text === first.text && change.rangeLength === first.rangeLength
  );
  if (!uniform) {
    insertRepeatable = false;
    return;
  }

  captureInsertChange(first);
}

export function isRecordingMacro() {
  return recordingRegister !== null;
}

export function getRecordingRegister() {
  return recordingRegister;
}

export function getMacro(register: string) {
  return macros.get(register) ?? null;
}

export function startMacroRecording(register: string) {
  recordingRegister = register;
  recordingStrokes = [];
}

export function stopMacroRecording() {
  if (recordingRegister === null) {
    return;
  }
  macros.set(recordingRegister, recordingStrokes);
  recordingRegister = null;
  recordingStrokes = [];
}

function abortMacroRecording() {
  const register = recordingRegister;
  recordingRegister = null;
  recordingStrokes = [];

  vscode.window.showWarningMessage(
    `Recording to ${register} stopped: that edit can't be replayed faithfully.`
  );
}

/** Replay a recorded macro. */
export async function playMacro(register: string, count: number) {
  const strokes = macros.get(register);
  if (!strokes) {
    vscode.window.showWarningMessage(`No macro recorded in ${register}.`);
    return;
  }

  for (let i = 0; i < count; i++) {
    await replay(strokes);
  }

  // As with `.`, the keys that triggered the playback shouldn't become the
  // change that a later `.` repeats.
  discardPendingUnit();
}

/** Repeat the last document-changing command, vim's `.`. */
export async function repeatLastChange(count: number) {
  const strokes = lastChange;
  if (!strokes) {
    return;
  }

  for (let i = 0; i < count; i++) {
    await replay(strokes);
  }

  // The `.` keystroke is in the pending unit; drop it so the register still
  // holds the original change and a second `.` repeats that, not this.
  discardPendingUnit();
}

/**
 * Feed a recorded sequence back through the dispatcher.
 *
 * Runs with recording suppressed and refuses to nest, so a macro that invokes
 * its own register terminates instead of recursing.
 */
export async function replay(strokes: Keystroke[]) {
  if (replaying || !deps) {
    return;
  }

  replaying = true;
  try {
    // The key that triggered the replay is still sitting in the command chain;
    // the replayed keys have to start from an empty one or they would append
    // to it and match nothing.
    deps.resetChain();

    for (const stroke of strokes) {
      if ("key" in stroke) {
        await deps.handleKey(stroke.key);
        continue;
      }

      // Inserted as a plain edit rather than replayed through `type`: the
      // captured text already contains whatever auto-closing and auto-indent
      // produced the first time, and typing it again would apply them twice.
      const editor = vscode.window.activeTextEditor;
      if (editor) {
        await editor.edit((editBuilder) => {
          for (const selection of editor.selections) {
            editBuilder.insert(selection.active, stroke.insertedText);
          }
        });
      }

      // The Escape that ended the recorded session was never a recorded key
      // -- it is bound straight to changeMode -- so it is reapplied here.
      await deps.leaveInsertMode();
    }
  } finally {
    replaying = false;
  }
}
