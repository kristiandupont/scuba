import * as vscode from "vscode";
import { activateSmartSelectCommands } from "./smart-select-commands";
import { moveAllCursorsRightUnlessTheyAreAtEOL } from "./utilities/movement";

const defaultMode = "normal";

let blockTypeSub: vscode.Disposable | null = null;
let modeIndicator: vscode.StatusBarItem | null = null;
let currentMode: string = defaultMode;

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
      onEnter?: () => Promise<void>;
      onExit?: () => Promise<void>;
    };

const insertMode: Mode = {
  isInsertMode: true,
  name: "insert",
  statusItemText: "Insert",
};

async function changeMode({ mode: modeName }: { mode: string }) {
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

function resetCommandChain() {
  activeCommandChain = [];
  updateModeIndicator();
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

const replaceCharMode: Mode = {
  isInsertMode: false,
  name: "replace-char",
  statusItemText: "Replace Char",
  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const key = keys[0];
    const charCode = key.charCodeAt(0);
    const char = String.fromCharCode(charCode);
    const selections = textEditor.selections;

    await textEditor.edit((editBuilder) => {
      selections.forEach((selection) => {
        const position = selection.active;
        const range = new vscode.Range(position, position.translate(0, 1));
        editBuilder.replace(range, char);
      });
    });

    // Update selections to reflect the new cursor positions
    const newSelections = selections.map((selection) => {
      const position = selection.active.translate(0, 1);
      return new vscode.Selection(position, position);
    });
    textEditor.selections = newSelections;

    changeMode({ mode: defaultMode });
  },
};

const lineSelectMode: Mode = {
  isInsertMode: false,
  name: "line-select",
  statusItemText: "Line Select",
  onEnter: async function () {
    await vscode.commands.executeCommand("cursorHome");
    await vscode.commands.executeCommand("cursorHome");
    await vscode.commands.executeCommand("cursorEndSelect");
  },

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const selections = textEditor.selections;

    if (keys === "<up>") {
      // If cursor is above the anchor, extend the selection with the entire line above the cursor
      // If it's below the anchor, move the cursor down one line and shrink the selection to just the cursor.

      const newSelections = selections.map((selection) => {
        const anchor = selection.anchor;
        const active = selection.active;

        if (active.line < anchor.line) {
          const start = new vscode.Position(active.line - 1, 0);
          const end = anchor;
          return new vscode.Selection(start, end);
        } else {
          const start = active.translate(1, 0);
          return new vscode.Selection(start, start);
        }
      });

      textEditor.selections = newSelections;
    } else if (keys === "<down>") {
      // If cursor is below the anchor, extend the selection with the entire line below the cursor
      // If it's above the anchor, move the cursor up one line and shrink the selection to just the cursor.

      const newSelections = selections.map((selection) => {
        const anchor = selection.anchor;
        const active = selection.active;

        if (active.line > anchor.line) {
          const start = anchor;
          const end = new vscode.Position(active.line + 1, 0);
          return new vscode.Selection(start, end);
        } else {
          const start = active.translate(-1, 0);
          return new vscode.Selection(start, start);
        }
      });

      textEditor.selections = newSelections;
    }

    resetCommandChain();
  },
};

const smartSelectMode: Mode = {
  isInsertMode: false,
  name: "smart-select",
  statusItemText: "Smart Select",
  onEnter: async function () {
    await vscode.commands.executeCommand("editor.action.smartSelect.expand");
  },
  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys === "<up>") {
      await vscode.commands.executeCommand("scuba.selectPrevSibling");
    } else if (keys === "<down>") {
      await vscode.commands.executeCommand("scuba.selectNextSibling");
    } else if (keys === "<left>") {
      await vscode.commands.executeCommand("editor.action.smartSelect.shrink");
    } else if (keys === "<right>") {
      await vscode.commands.executeCommand("editor.action.smartSelect.expand");
    }

    resetCommandChain();
  },
};

const normalKeyMap: KeyMap = [
  {
    keys: "<up>",
    command: "cursorUp",
  },
  {
    keys: "<down>",
    command: "cursorDown",
  },
  {
    keys: "<left>",
    command: "cursorLeft",
  },
  {
    keys: "<right>",
    command: "cursorRight",
  },
  {
    keys: "^",
    command: "cursorLineStart",
  },
  {
    keys: "$",
    command: "cursorLineEnd",
  },
  {
    keys: "i",
    leaveInMode: "insert",
  },
  {
    keys: "I",
    command: "cursorHome",
    leaveInMode: "insert",
  },
  {
    keys: "a",
    command: moveAllCursorsRightUnlessTheyAreAtEOL,
    leaveInMode: "insert",
  },
  {
    keys: "A",
    command: "cursorEnd",
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

  // Scroll the window up or down one line:
  { keys: "k", command: "scrollLineDown" },
  { keys: "j", command: "scrollLineUp" },

  { keys: "w", command: "cursorWordEndRightSelect" },
  { keys: "b", command: "cursorWordStartLeftSelect" },

  { keys: "æ", command: "cursorWordPartRightSelect" },
  { keys: "ø", command: "cursorWordPartLeftSelect" },

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
    leaveInMode: "match",
  },

  // Replace char mode (r)
  {
    keys: "r",
    leaveInMode: "replace-char",
  },

  // Line select mode (v)
  {
    keys: "V",
    leaveInMode: "line-elect",
  },

  // Smart select mode (s)
  {
    keys: "s",
    leaveInMode: "smart-select",
  },
];

const normalMode: Mode = {
  isInsertMode: false,
  name: "normal",
  statusItemText: "Normal (updated!)",
  handleSubCommandChain: makeSubChainHandler(normalKeyMap),
};

const modes: Mode[] = [
  insertMode,
  normalMode,
  matchMode,
  replaceCharMode,
  lineSelectMode,
  smartSelectMode,
];

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
