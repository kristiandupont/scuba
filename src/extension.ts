import * as vscode from "vscode";
import { activateSmartSelectCommands } from "./smart-select-commands";
import { insertMode } from "./insertMode";
import { lineSelectMode } from "./lineSelectMode";
import { matchMode } from "./matchMode";
import { normalMode } from "./normalMode";
import { replaceCharMode } from "./replaceCharMode";
import { smartSelectMode } from "./smartSelectMode";

export const defaultMode = "normal";

let blockTypeSub: vscode.Disposable | null = null;
let modeIndicator: vscode.StatusBarItem | null = null;
let currentMode: string = defaultMode;

let activeCommandChain: string[] = [];

export type Mode =
  | {
      isInsertMode: true;
      name: string;
      statusItemText: string;
    }
  | {
      isInsertMode: false;
      name: string;
      statusItemText: string;
      handleSubCommandChain: (
        keys: string,
        textEditor: vscode.TextEditor
      ) => Promise<void>;
      onEnter?: () => Promise<void>;
      onExit?: () => Promise<void>;
    };

export async function changeMode({ mode: modeName }: { mode: string }) {
  const previousMode = currentMode
    ? modes.find((mode) => mode.name === currentMode)
    : null;

  if (previousMode && !previousMode.isInsertMode && previousMode.onExit) {
    previousMode.onExit();
  }

  const mode = modes.find((mode) => mode.name === modeName);
  if (!mode) {
    vscode.window.showErrorMessage(`Unknown mode: ${modeName}`);
    return;
  }

  currentMode = modeName;
  resetCommandChain();
  if (!mode.isInsertMode && mode.onEnter) {
    mode.onEnter();
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
    currentMode === "insert"
      ? vscode.TextEditorCursorStyle.Line
      : vscode.TextEditorCursorStyle.Block;
}

export function resetCommandChain() {
  activeCommandChain = [];
  updateModeIndicator();
}

export type KeyDefinition = {
  keys: string;
  command?: string | ((textEditor: vscode.TextEditor) => void);
  args?: any;
  leaveInMode?: string;
};

export type KeyMap = KeyDefinition[];

export function makeSubChainHandler(
  keyMap: KeyMap,
  defaultLeaveInMode?: string
) {
  return async (keys: string, textEditor: vscode.TextEditor) => {
    const keyDefinition = keyMap.find((root) => root.keys === keys);
    if (keyDefinition) {
      if (keyDefinition.command) {
        if (typeof keyDefinition.command === "function") {
          keyDefinition.command(textEditor);
        } else {
          vscode.commands.executeCommand(
            keyDefinition.command,
            keyDefinition.args
          );
        }
      }
      const leaveInMode = keyDefinition.leaveInMode || defaultLeaveInMode;
      if (leaveInMode) {
        changeMode({ mode: leaveInMode });
      }
      resetCommandChain();
    } else {
      // If no key definition starts with the current chain, give a warning
      // and reset the chain.

      const partialMatch = keyMap.some((root) => root.keys.startsWith(keys));

      if (!partialMatch) {
        vscode.window.showWarningMessage(`Unknown key sequence: ${keys}.`);
        changeMode({ mode: defaultMode });
      }
    }
  };
}

const modes: Mode[] = [
  insertMode,
  normalMode,
  matchMode,
  replaceCharMode,
  lineSelectMode,
  smartSelectMode,
];

function updateModeIndicator() {
  if (!modeIndicator) {
    return;
  }

  const mode = modes.find((mode) => mode.name === currentMode);

  const icon = mode?.isInsertMode ? "edit" : "keyboard";

  const commandChain =
    activeCommandChain.length > 0
      ? activeCommandChain.join("")
      : "$(star-empty)";

  modeIndicator.text = `$(${icon}) ${mode?.statusItemText} ${commandChain}`;
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
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.changeMode", changeMode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.reset", resetCommandChain)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "scuba.handleNonCharacterKey",
      handleNonCharacterKey
    )
  );

  modeIndicator = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  modeIndicator.show();

  activateAdditionalCommands(context);

  changeMode({ mode: defaultMode });
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
