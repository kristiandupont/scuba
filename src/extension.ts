import * as vscode from "vscode";
import { activateSmartSelectCommands } from "./smart-select-commands";
import { insertMode } from "./insertMode";
import { lineSelectMode } from "./lineSelectMode";
import { normalMode } from "./normalMode";
import { replaceCharMode } from "./replaceCharMode";
import { smartSelectMode } from "./smartSelectMode";
import { surroundMode } from "./surroundMode";
import { sneakBackwardsMode, sneakMode } from "./sneak-modes";
import {
  changeObjectMode as changeObjectMode,
  deleteObjectMode,
  selectMode,
  yankObjectMode,
} from "./verb-object-modes";
import { findCharMode, tillCharMode } from "./char-search-modes";
import { goToLineMode } from "./goToLineMode";
import { activate as activateTreeSitter } from "./utilities/parse-tree";
import { activateClipboard } from "./utilities/clipboard";
import {
  activateKeystrokeLog,
  beginInsertCapture,
  endInsertCapture,
  getRecordingRegister,
  isRecordingMacro,
  recordKey,
  settle,
  stopMacroRecording,
} from "./keystroke-log";
import { playMacroMode, recordMacroMode } from "./macro-modes";
import {
  youSurroundMode,
  changeSurroundMode,
  deleteSurroundMode,
} from "./motion-surround-modes";

export const defaultMode = "normal";

let blockTypeSub: vscode.Disposable | null = null;
let modeIndicator: vscode.StatusBarItem | null = null;
let currentMode: string = defaultMode;

let activeCommandChain: string[] = [];

export type Mode = {
  name: string;
  statusItemText: string;
  onEnter?: (previousMode: string) => Promise<void>;
  onExit?: () => Promise<void>;
  color?: vscode.ThemeColor;
  backgroundColor?: vscode.ThemeColor;
  cursorStyle?: vscode.TextEditorCursorStyle;
} & (
  | { isInsertMode: true }
  | {
      isInsertMode: false;
      handleSubCommandChain: (
        keys: string,
        textEditor: vscode.TextEditor,
      ) => Promise<void>;
    }
);

export async function changeMode({ mode: modeName }: { mode: string }) {
  const previousMode = modes.find((mode) => mode.name === currentMode);
  if (!previousMode) {
    throw new Error(`Unknown mode: ${currentMode}`);
  }

  if (previousMode && previousMode.onExit) {
    await previousMode.onExit();
  }

  const mode = modes.find((mode) => mode.name === modeName);
  if (!mode) {
    vscode.window.showErrorMessage(`Unknown mode: ${modeName}`);
    return;
  }

  // Bracket the insert session before the mode actually flips, so the text
  // capture is listening for the first character typed and has stopped
  // listening before anything the next mode does reaches the document.
  if (mode.isInsertMode && !previousMode.isInsertMode) {
    beginInsertCapture();
  } else if (!mode.isInsertMode && previousMode.isInsertMode) {
    endInsertCapture();
  }

  currentMode = modeName;
  resetCommandChain();

  // Landing back in the default mode is what completes a command, including
  // one the user ended with Escape, which never reaches the dispatcher.
  settleKeystrokeLog();

  if (mode.onEnter) {
    await mode.onEnter(previousMode.name);
  }

  // Awaited because the keybinding `when` clauses are gated on this context
  // key; until it lands, keys are still routed to the previous mode.
  await vscode.commands.executeCommand(
    "setContext",
    "scuba.currentMode",
    currentMode,
  );
  updateModeIndicator();

  if (!mode.isInsertMode && !blockTypeSub) {
    blockTypeSub = vscode.commands.registerTextEditorCommand(
      "type",
      nonInsertType,
    );
  } else if (mode.isInsertMode && !!blockTypeSub) {
    blockTypeSub.dispose();
    blockTypeSub = null;
  }

  // Set cursor style:
  if (!vscode.window.activeTextEditor) {
    return;
  }
  vscode.window.activeTextEditor.options.cursorStyle =
    mode.cursorStyle || vscode.TextEditorCursorStyle.Block;
}

export function getCurrentMode() {
  return currentMode;
}

export function resetCommandChain() {
  activeCommandChain = [];
  updateModeIndicator();
}

export type KeyDefinition = {
  keys: string;

  /**
   * The command to execute when the key sequence is matched.
   * If the command is a function, it will be called with the text editor
   * and should return the mode to leave in (if any).
   */
  command?:
    | string
    | ((
        count: number,
        textEditor: vscode.TextEditor,
      ) => Promise<string | void>);
  args?: any;
  leaveInMode?: string;
};

export type KeyMap = KeyDefinition[];

export function makeSubChainHandler(
  keyMap: KeyMap,
  defaultLeaveInMode?: string,
  leaveInModeOnNoMatch: string | undefined = defaultMode,
) {
  return async (keys: string, textEditor: vscode.TextEditor) => {
    let count = 1;

    // If keys begin with a number, that is the count. The command is the rest.
    const countMatch = keys.match(/^\d+/);
    if (countMatch) {
      count = parseInt(countMatch[0], 10);
      keys = keys.slice(countMatch[0].length);
    }

    const keyDefinition = keyMap.find((root) => root.keys === keys);
    if (keyDefinition) {
      let leaveInMode = keyDefinition.leaveInMode || defaultLeaveInMode;

      if (keyDefinition.command) {
        if (typeof keyDefinition.command === "function") {
          const leaveInOverride = await keyDefinition.command(
            count,
            textEditor,
          );
          if (leaveInOverride) {
            leaveInMode = leaveInOverride;
          }
        } else {
          try {
            for (let i = 0; i < count; i++) {
              await vscode.commands.executeCommand(
                keyDefinition.command,
                keyDefinition.args,
              );
            }
          } catch (e) {
            vscode.window.showErrorMessage(
              `Failed to execute command: ${keyDefinition.command}`,
              (e as Error).message,
            );
          }
        }
      }
      if (leaveInMode) {
        await changeMode({ mode: leaveInMode });
      } else {
        resetCommandChain();
      }
    } else {
      // If no key definition starts with the current chain, give a warning
      // and reset the chain.

      const partialMatch = keyMap.some((root) => root.keys.startsWith(keys));

      if (!partialMatch) {
        vscode.window.showWarningMessage(`Unknown key sequence: ${keys}.`);
        if (leaveInModeOnNoMatch) {
          await changeMode({ mode: leaveInModeOnNoMatch });
        } else {
          resetCommandChain();
        }
      }
    }
  };
}

const modes: Mode[] = [
  insertMode,
  normalMode,
  changeObjectMode,
  yankObjectMode,
  deleteObjectMode,
  selectMode,
  replaceCharMode,
  lineSelectMode,
  smartSelectMode,
  surroundMode,
  youSurroundMode,
  changeSurroundMode,
  deleteSurroundMode,
  sneakMode,
  sneakBackwardsMode,
  findCharMode,
  tillCharMode,
  goToLineMode,
  recordMacroMode,
  playMacroMode,
];

function updateModeIndicator() {
  if (!modeIndicator) {
    return;
  }

  const mode = modes.find((mode) => mode.name === currentMode);
  if (!mode) {
    return;
  }

  let text = "";
  if (mode.isInsertMode) {
    text = "$(edit) " + mode.statusItemText;
  } else {
    const commandChain =
      activeCommandChain.length > 0
        ? activeCommandChain.join("")
        : "$(star-empty)";

    text = "$(keyboard) " + mode.statusItemText + " " + commandChain;
  }

  const register = getRecordingRegister();
  if (register !== null) {
    text += `  $(record) ${register}`;
  }

  modeIndicator.text = text;

  modeIndicator.color =
    mode.color || new vscode.ThemeColor("statusBar.foreground");
  modeIndicator.backgroundColor =
    mode.backgroundColor || new vscode.ThemeColor("statusBar.background");
}

let keyQueue: Promise<void> = Promise.resolve();

/**
 * Keys are handled strictly one at a time.
 *
 * Handlers await editor commands, and a key pressed during one of those awaits
 * used to append to the command chain of the key still being processed -- two
 * quick presses of right became the unknown combination "<right><right>".
 * Queueing also means a replayed key sequence (dot, macros) can run as one
 * unit without live keypresses interleaving into it.
 */
function enqueue(work: () => Promise<void>): Promise<void> {
  keyQueue = keyQueue
    .then(work)
    .catch((e) => console.error("Scuba: key handling failed", e));
  return keyQueue;
}

function enqueueKey(key: string): Promise<void> {
  return enqueue(() => handleNonInsertKey(key));
}

async function handleNonInsertKey(key: string) {
  // Resolved here rather than at enqueue time: a queued key may not run until
  // after the editor it was typed into has stopped being the active one.
  const textEditor = vscode.window.activeTextEditor;
  if (!textEditor) {
    return;
  }

  const mode = modes.find((mode) => mode.name === currentMode);
  if (!mode || mode.isInsertMode) {
    return;
  }

  // `q` ends a recording. Caught before the key is chained or recorded, so it
  // neither lands in the macro nor starts a new recording via its own binding.
  if (
    isRecordingMacro() &&
    key === "q" &&
    currentMode === defaultMode &&
    activeCommandChain.length === 0
  ) {
    stopMacroRecording();
    updateModeIndicator();
    return;
  }

  activeCommandChain.push(key);
  updateModeIndicator();
  recordKey(key);

  const command = activeCommandChain.join("");
  await mode.handleSubCommandChain(command, textEditor);

  settleKeystrokeLog();
}

function settleKeystrokeLog() {
  settle({
    inDefaultMode: currentMode === defaultMode,
    chainIsEmpty: activeCommandChain.length === 0,
  });
}

function nonInsertType(
  textEditor: vscode.TextEditor,
  edit: vscode.TextEditorEdit,
  ...args: any[]
) {
  return enqueueKey(args[0].text);
}

function handleNonCharacterKey({ key }: { key: string }) {
  return enqueueKey(key);
}

export function activate(context: vscode.ExtensionContext) {
  activateTreeSitter(context);
  activateClipboard(context);
  activateKeystrokeLog(context, {
    // Replay goes through the dispatcher directly rather than the queue: it is
    // already running inside a queued unit, and enqueueing from there would
    // deadlock on the entry it is itself part of.
    handleKey: handleNonInsertKey,
    leaveInsertMode: () => changeMode({ mode: defaultMode }),
    resetChain: resetCommandChain,
    getDocumentVersion: () =>
      vscode.window.activeTextEditor?.document.version ?? null,
  });

  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.changeMode", changeMode),
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "scuba.handleNonCharacterKey",
      handleNonCharacterKey,
    ),
  );
  activateAdditionalCommands(context);

  modeIndicator = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0,
  );
  modeIndicator.show();

  enqueue(() => changeMode({ mode: defaultMode }));

  // Listen for selection changes with the mouse. These go through the same
  // queue as keys, so a click landing mid-chain can't interleave with the key
  // that is still being handled.
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.kind !== vscode.TextEditorSelectionChangeKind.Mouse) {
        return;
      }

      enqueue(async () => {
        if (currentMode !== insertMode.name) {
          await changeMode({ mode: normalMode.name });
        }

        resetCommandChain();
      });
    }),
  );

  // Listen for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      enqueue(() => changeMode({ mode: defaultMode }));
    }),
  );

  // vscode.workspace.onDidChangeTextDocument((event) => {
  //     console.log('Change detected:', event);
  // });
}

function activateAdditionalCommands(context: vscode.ExtensionContext) {
  activateSmartSelectCommands(context);
}

export function deactivate() {
  if (blockTypeSub) {
    blockTypeSub.dispose();
  }
  if (modeIndicator) {
    modeIndicator.dispose();
  }
}
