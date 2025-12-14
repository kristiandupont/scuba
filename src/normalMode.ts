import * as vscode from "vscode";
import { defaultMode, KeyMap, makeSubChainHandler, Mode } from "./extension";
import {
  moveCursorsRightUnlessTheyAreAtEOL,
  moveCursorsToStartOfLine,
} from "./utilities/movement";
import {
  lineModeAwarePaste,
  popSelections,
  undoPopSelections,
} from "./utilities/selection";
import { incrementNumberUnderCursor } from "./utilities/edits";

const normalKeyMap: KeyMap = [
  { keys: "<up>", command: "cursorUp" },
  { keys: "<down>", command: "cursorDown" },
  { keys: "<left>", command: "cursorLeft" },
  { keys: "<right>", command: "cursorRight" },
  { keys: "<home>", command: "cursorHome" },
  { keys: "<end>", command: "cursorEnd" },
  { keys: "<pageup>", command: "cursorPageUp" },
  { keys: "<pagedown>", command: "cursorPageDown" },

  { keys: "<a-up>", command: "editor.action.moveLinesUpAction" },
  { keys: "<a-down>", command: "editor.action.moveLinesDownAction" },
  { keys: "<a-left>", command: "cursorWordStartLeft" },
  { keys: "<a-right>", command: "cursorWordStartRight" },

  { keys: "§", command: "cursorLineStart" },
  { keys: "$", command: "cursorLineEnd" },

  { keys: "i", leaveInMode: "insert" },
  { keys: "I", command: "cursorHome", leaveInMode: "insert" },
  {
    keys: "a",
    command: moveCursorsRightUnlessTheyAreAtEOL,
    leaveInMode: "insert",
  },
  { keys: "A", command: "cursorEnd", leaveInMode: "insert" },
  {
    keys: "o",
    command: "editor.action.insertLineAfter",
    leaveInMode: "insert",
  },
  {
    keys: "O",
    command: "editor.action.insertLineBefore",
    leaveInMode: "insert",
  },
  {
    keys: "C",
    // Clear the whole line and leave the cursor in insert mode, on the
    // character that matches indentation:
    command: async function () {
      moveCursorsToStartOfLine(vscode.window.activeTextEditor!);
      await vscode.commands.executeCommand("cursorHome");
      await vscode.commands.executeCommand("deleteAllRight");
      return "insert";
    },
  },
  { keys: "D", command: "editor.action.clipboardCutAction" },
  { keys: "Y", command: "editor.action.clipboardCopyAction" },
  {
    keys: "p",
    command: async () =>
      lineModeAwarePaste(vscode.window.activeTextEditor!, "after"),
    leaveInMode: defaultMode,
  },
  {
    keys: "P",
    command: async () =>
      lineModeAwarePaste(vscode.window.activeTextEditor!, "before"),
  },
  {
    keys: "<tab>",
    command: "editor.action.indentLines",
  },
  {
    keys: "<s-tab>",
    command: "editor.action.outdentLines",
  },

  { keys: "u", command: "undo" },
  { keys: "U", command: "redo" },

  // Scroll the window up or down one line:
  { keys: "<c-up>", command: "scrollLineUp" },
  { keys: "<c-down>", command: "scrollLineDown" },

  { keys: "w", command: "cursorWordStartRight" },
  { keys: "b", command: "cursorWordStartLeft" },

  { keys: "æ", command: "cursorWordPartRight" },
  { keys: "ø", command: "cursorWordPartLeft" },

  { keys: "*", command: "findWordAtCursor.next" },
  { keys: "#", command: "findWordAtCursor.previous" },
  { keys: "@", command: "editor.action.addSelectionToNextFindMatch" },
  { keys: " a", command: "editor.action.changeAll" },
  { keys: "%", command: "editor.action.jumpToBracket" },

  {
    keys: "-",
    command: async function () {
      incrementNumberUnderCursor(vscode.window.activeTextEditor!, -1);
    },
  },
  {
    keys: "+",
    command: async function () {
      incrementNumberUnderCursor(vscode.window.activeTextEditor!, 1);
    },
  },

  { keys: "J", command: "editor.action.joinLines" },
  { keys: " m", command: "textmarker.toggleHighlight" },
  { keys: " c", command: "textmarker.clearAllHighlight" },
  { keys: ",", command: "editor.action.insertCursorBelow" },
  {
    keys: ";",
    command: async function () {
      // Cancel selection, retaining multiple cursors
      await vscode.commands.executeCommand("cursorWordStartRight");
      await vscode.commands.executeCommand("cursorWordStartLeft");
    },
  },
  { keys: "x", command: "deleteRight" },
  { keys: "s", command: "deleteRight", leaveInMode: "insert" },

  // Goto "mode" (g)
  { keys: "gd", command: "editor.action.goToDeclaration" },
  {
    keys: "gn",
    command: async function () {
      // Split the editor right and go to the definition
      await vscode.commands.executeCommand("workbench.action.splitEditorRight");
      await vscode.commands.executeCommand("editor.action.goToDeclaration");
    },
  },
  { keys: "gr", command: "references-view.findReferences" },
  { keys: "gh", command: "editor.action.showHover" },
  { keys: "gp", command: "editor.action.triggerParameterHints" },
  { keys: "gc", command: "editor.action.commentLine" },
  { keys: "ge", command: "editor.action.marker.next" },

  // View "mode" (z)
  {
    keys: "zz",
    command: async function () {
      await vscode.commands.executeCommand("revealLine", {
        lineNumber: vscode.window.activeTextEditor?.selection.active.line,
        at: "center",
      });
    },
  },
  { keys: "za", command: "editor.toggleFold" },

  {
    keys: "<backspace>",
    command: async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      popSelections(editor);
    },
  },
  {
    keys: "<s-backspace>",
    command: async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }
      undoPopSelections(editor);
    },
  },

  { keys: "v", leaveInMode: "select" },
  { keys: "V", leaveInMode: "line-select" },
  { keys: "S", leaveInMode: "smart-select" },

  { keys: "c", leaveInMode: "change" },
  { keys: "y", leaveInMode: "yank" },
  { keys: "d", leaveInMode: "delete" },

  { keys: "r", leaveInMode: "replace-char" },

  { keys: ":", leaveInMode: "go-to-line" },
  { keys: "f", leaveInMode: "find-char/inclusive" },
  { keys: "t", leaveInMode: "find-char/exclusive" },
  { keys: "  ", leaveInMode: "sneak" },
  { keys: " b", leaveInMode: "sneak-backwards" },
];

export const normalMode: Mode = {
  isInsertMode: false,
  name: "normal",
  statusItemText: "Normal",
  handleSubCommandChain: makeSubChainHandler(normalKeyMap),
};
