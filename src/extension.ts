import * as vscode from "vscode";
import { activateSmartSelectCommands } from "./smart-select-commands";

let blockTypeSub: vscode.Disposable | null = null;
let modeIndicator: vscode.StatusBarItem | null = null;
let currentMode: string | null = null;

let activeCommandChain: string[] = [];

type Mode =
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
    };

const insertMode: Mode = {
  isInsertMode: true,
  name: "insert",
  statusItemText: "Insert",
};

async function changeMode({ mode: modeName }: { mode: string }) {
  const mode = modes.find((mode) => mode.name === modeName);
  if (!mode) {
    vscode.window.showErrorMessage(`Unknown mode: ${modeName}`);
    return;
  }

  currentMode = modeName;
  resetCommandChain();

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

function resetCommandChain() {
  activeCommandChain = [];
  updateModeIndicator();
}

async function moveAllCursorsRightUnlessTheyAreAtEOL(
  textEditor: vscode.TextEditor
) {
  const selections = textEditor.selections;
  const newSelections = selections.map((selection) => {
    const position = selection.active;
    const lineEnd = textEditor.document.lineAt(position.line).range.end;
    if (!position.isEqual(lineEnd)) {
      // Move the cursor for this selection one character to the right
      const newPosition = position.translate(0, 1);
      return new vscode.Selection(newPosition, newPosition);
    }
    return selection;
  });
  textEditor.selections = newSelections;
}

type KeyDefinition = {
  keys: string;
  command?: string | ((textEditor: vscode.TextEditor) => void);
  args?: any;
  leaveInMode?: string;
};

type KeyMap = KeyDefinition[];

function makeSubChainHandler(keyMap: KeyMap, defaultLeaveInMode?: string) {
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
    }
  };
}

const matchMode: Mode = {
  isInsertMode: false,
  name: "match",
  statusItemText: "Match",

  handleSubCommandChain: makeSubChainHandler(
    [
      { keys: "m", command: "editor.action.jumpToBracket" },

      // Inside
      { keys: 'i"', command: "extension.selectDoubleQuote" },
      { keys: "i'", command: "extension.selectSingleQuote" },
      { keys: "i(", command: "extension.selectParenthesis" },
      { keys: "i[", command: "extension.selectSquareBrackets" },
      { keys: "i{", command: "extension.selectCurlyBrackets" },
      { keys: "i`", command: "extension.selectBackTick" },
      { keys: "i<", command: "extension.selectAngleBrackets" },
      {
        keys: "iw",
        command: async function () {
          await vscode.commands.executeCommand("cursorWordStartLeft");
          await vscode.commands.executeCommand("cursorWordEndRightSelect");
        },
      },
      { keys: "iq", command: "extension.selectEitherQuote" },

      // Around
      { keys: "a(", command: "extension.selectParenthesisOuter" },
      { keys: "a[", command: "extension.selectSquareBracketsOuter" },
      { keys: "a{", command: "extension.selectCurlyBracketsOuter" },
      { keys: "a<", command: "extension.selectInTag" },
      {
        keys: "aw",
        command: async function () {
          await vscode.commands.executeCommand("cursorWordStartLeft");
          await vscode.commands.executeCommand("cursorWordEndRightSelect");
        },
      },
    ],
    "normal"
  ),
};

const normalKeyMap: KeyMap = [
  {
    keys: "i",
    leaveInMode: "insert",
  },
  {
    keys: "a",
    command: moveAllCursorsRightUnlessTheyAreAtEOL,
    leaveInMode: "insert",
  },
  {
    keys: "o",
    command: async function () {
      await vscode.commands.executeCommand("editor.action.insertLineAfter");
    },
    leaveInMode: "insert",
  },
  {
    keys: "O",
    command: async function () {
      await vscode.commands.executeCommand("editor.action.insertLineBefore");
    },
    leaveInMode: "insert",
  },
  { keys: "u", command: "undo" },
  { keys: "U", command: "redo" },
  { keys: "w", command: "cursorWordEndRightSelect" },
  { keys: "b", command: "cursorWordStartLeftSelect" },
  { keys: "y", command: "editor.action.clipboardCopyAction" },
  { keys: "d", command: "editor.action.clipboardCutAction" },
  { keys: "p", command: "editor.action.clipboardPasteAction" },
  {
    keys: "c",
    command: async function () {
      await vscode.commands.executeCommand("deleteRight");
      await vscode.commands.executeCommand("scuba.changeMode", {
        mode: "insert",
      });
    },
  },
  { keys: "*", command: "findWordAtCursor.next" },
  { keys: "#", command: "findWordAtCursor.previous" },
  { keys: "J", command: "editor.action.joinLines" },
  { keys: " m", command: "textmarker.toggleHighlight" },

  // Goto mode (g)
  { keys: "gd", command: "editor.action.goToDeclaration" },
  { keys: "gr", command: "references-view.findReferences" },
  { keys: "gh", command: "editor.action.showHover" },

  // View mode (z)
  { keys: "za", command: "editor.toggleFold" },
  {
    keys: "zz",
    command: "revealLine",
    args: {
      lineNumber: vscode.window.activeTextEditor?.selection.active.line,
      at: "center",
    },
  },

  // Match mode (m)
  {
    keys: "m",
    command: async function () {
      changeMode({ mode: "match" });
    },
  },
];

const normalMode: Mode = {
  isInsertMode: false,
  name: "normal",
  statusItemText: "Normal",
  handleSubCommandChain: makeSubChainHandler(normalKeyMap),
};

const modes: Mode[] = [insertMode, normalMode, matchMode];

/*
{
  "key": "shift+alt+right",
  "command": "cursorWordEndRightSelect",
  "when": "textInputFocus"
}
*/

function updateModeIndicator() {
  if (!modeIndicator) {
    return;
  }

  const icon = currentMode === "insert" ? "edit" : "keyboard";

  const commandChain =
    activeCommandChain.length > 0
      ? activeCommandChain.join("")
      : "$(star-empty)";

  modeIndicator.text = `$(${icon}) ${currentMode} ${commandChain}`;
}

async function handleNonInsertKey(
  key: string,
  textEditor: vscode.TextEditor,
  edit: vscode.TextEditorEdit
) {
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

function initDefaultMode() {
  const defaultMode = "normal";
  changeMode({ mode: defaultMode });
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.changeMode", changeMode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.reset", resetCommandChain)
  );

  modeIndicator = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );
  modeIndicator.show();

  activateAdditionalCommands(context);

  initDefaultMode();
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
