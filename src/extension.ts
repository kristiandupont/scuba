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
        textEditor: vscode.TextEditor
      ) => Promise<void>;
    }
);

export async function changeMode({ mode: modeName }: { mode: string }) {
  const previousMode = modes.find((mode) => mode.name === currentMode);
  if (!previousMode) {
    throw new Error(`Unknown mode: ${currentMode}`);
  }

  if (previousMode && previousMode.onExit) {
    previousMode.onExit();
  }

  const mode = modes.find((mode) => mode.name === modeName);
  if (!mode) {
    vscode.window.showErrorMessage(`Unknown mode: ${modeName}`);
    return;
  }

  currentMode = modeName;
  resetCommandChain();
  if (mode.onEnter) {
    mode.onEnter(previousMode?.name);
  }

  vscode.commands.executeCommand(
    "setContext",
    "scuba.currentMode",
    currentMode
  );
  updateModeIndicator();

  if (!mode.isInsertMode && !blockTypeSub) {
    blockTypeSub = vscode.commands.registerTextEditorCommand(
      "type",
      nonInsertType
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
        textEditor: vscode.TextEditor
      ) => Promise<string | void>);
  args?: any;
  leaveInMode?: string;
};

export type KeyMap = KeyDefinition[];

export function makeSubChainHandler(
  keyMap: KeyMap,
  defaultLeaveInMode?: string,
  leaveInModeOnNoMatch: string | undefined = defaultMode
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
            textEditor
          );
          if (leaveInOverride) {
            leaveInMode = leaveInOverride;
          }
        } else {
          try {
            for (let i = 0; i < count; i++) {
              await vscode.commands.executeCommand(
                keyDefinition.command,
                keyDefinition.args
              );
            }
          } catch (e) {
            vscode.window.showErrorMessage(
              `Failed to execute command: ${keyDefinition.command}`,
              (e as Error).message
            );
          }
        }
      }
      if (leaveInMode) {
        changeMode({ mode: leaveInMode });
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
          changeMode({ mode: leaveInModeOnNoMatch });
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
  modeIndicator.text = text;

  modeIndicator.color =
    mode.color || new vscode.ThemeColor("statusBar.foreground");
  modeIndicator.backgroundColor =
    mode.backgroundColor || new vscode.ThemeColor("statusBar.background");
}

async function handleNonInsertKey(
  key: string,
  textEditor: vscode.TextEditor,
  edit?: vscode.TextEditorEdit
) {
  console.info("handleNonInsertKey", key);

  activeCommandChain.push(key);
  updateModeIndicator();

  const mode = modes.find((mode) => mode.name === currentMode);
  if (!mode) {
    return;
  }

  if (mode.isInsertMode) {
    return;
  }

  const command = activeCommandChain.join("");
  await mode.handleSubCommandChain(command, textEditor);
}

async function nonInsertType(
  textEditor: vscode.TextEditor,
  edit: vscode.TextEditorEdit,
  ...args: any[]
) {
  const key = args[0].text;
  handleNonInsertKey(key, textEditor, edit);
}

async function handleNonCharacterKey({ key }: { key: string }) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  handleNonInsertKey(key, editor);
}

export function activate(context: vscode.ExtensionContext) {
  activateTreeSitter(context);

  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.changeMode", changeMode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "scuba.handleNonCharacterKey",
      handleNonCharacterKey
    )
  );
  activateAdditionalCommands(context);

  modeIndicator = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  modeIndicator.show();

  changeMode({ mode: defaultMode });

  // Listen for selection changes with the mouse
  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((e) => {
      if (e.kind === vscode.TextEditorSelectionChangeKind.Mouse) {
        if (currentMode !== insertMode.name) {
          changeMode({ mode: normalMode.name });
        }

        resetCommandChain();
      }
    })
  );

  // Listen for active editor changes
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(() => {
      changeMode({ mode: defaultMode });
    })
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
