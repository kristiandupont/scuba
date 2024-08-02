import * as vscode from "vscode";
import { KeyMap, makeSubChainHandler, Mode } from "./extension";
import { moveCursorsRightUnlessTheyAreAtEOL } from "./utilities/movement";

export const clipboardKeys: KeyMap = [
  {
    keys: "y",
    command: "editor.action.clipboardCopyAction",
    leaveInMode: "normal",
  },
  {
    keys: "d",
    command: "editor.action.clipboardCutAction",
    leaveInMode: "normal",
  },
  { keys: "D", command: "deleteAllRight", leaveInMode: "normal" },
  {
    keys: "p",
    command: "editor.action.clipboardPasteAction",
    leaveInMode: "normal",
  },
  {
    keys: "P",
    command: async function () {
      await vscode.commands.executeCommand("cursorRight");
      await vscode.commands.executeCommand(
        "editor.action.clipboardPasteAction"
      );
    },
  },
  {
    keys: "π",
    command: async function () {
      // Insert a newline and paste the clipboard contents
      await vscode.commands.executeCommand("editor.action.insertLineAfter");
      await vscode.commands.executeCommand("cursorHome");
      await vscode.commands.executeCommand(
        "editor.action.clipboardPasteAction"
      );
    },
  },
  {
    keys: "c",
    command: async function () {
      await vscode.commands.executeCommand("deleteRight");
    },
    leaveInMode: "insert",
  },
  {
    keys: "C",
    // Clear the whole line and leave the cursor in insert mode, on the
    // character that matches indentation:
    command: async function () {
      await vscode.commands.executeCommand("cursorHome");
      await vscode.commands.executeCommand("deleteAllRight");
      await vscode.commands.executeCommand("scuba.changeMode", {
        mode: "insert",
      });
    },
  },
  {
    keys: "S",
    leaveInMode: "surround",
  },
  { keys: "gc", command: "editor.action.commentLine" },
  {
    keys: "zz",
    command: async function () {
      await vscode.commands.executeCommand("revealLine", {
        lineNumber: vscode.window.activeTextEditor?.selection.active.line,
        at: "center",
      });
    },
  },
];

const normalKeyMap: KeyMap = [
  { keys: "<up>", command: "cursorUp" },
  { keys: "<down>", command: "cursorDown" },
  { keys: "<left>", command: "cursorLeft" },
  { keys: "<right>", command: "cursorRight" },

  { keys: "^", command: "cursorLineStartSelect" },
  { keys: "$", command: "cursorLineEndSelect" },

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

  { keys: "u", command: "undo" },
  { keys: "U", command: "redo" },

  // Scroll the window up or down one line:
  { keys: "k", command: "scrollLineUp" },
  { keys: "j", command: "scrollLineDown" },

  {
    keys: "w",
    command: async function () {
      await vscode.commands.executeCommand("cursorWordStartLeft");
      await vscode.commands.executeCommand("cursorWordStartRight");
      await vscode.commands.executeCommand("cursorWordEndRightSelect");
    },
  },
  {
    keys: "b",
    command: async function () {
      await vscode.commands.executeCommand("cursorWordStartRight");
      await vscode.commands.executeCommand("cursorWordStartLeft");
      await vscode.commands.executeCommand("cursorWordStartLeftSelect");
    },
  },

  { keys: "æ", command: "cursorWordPartRightSelect" },
  { keys: "ø", command: "cursorWordPartLeftSelect" },

  { keys: "*", command: "findWordAtCursor.next" },
  { keys: "#", command: "findWordAtCursor.previous" },
  { keys: "@", command: "editor.action.addSelectionToNextFindMatch" },

  { keys: "f", leaveInMode: "find-char" },
  { keys: "t", leaveInMode: "till-char" },

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

  // View "mode" (z)
  { keys: "za", command: "editor.toggleFold" },

  // Match mode (m)
  { keys: "m", leaveInMode: "match" },

  // Replace char mode (r)
  { keys: "r", leaveInMode: "replace-char" },

  // Line select mode (v)
  { keys: "V", leaveInMode: "line-select" },

  // Smart select mode (s)
  { keys: "s", leaveInMode: "smart-select" },

  { keys: "  ", leaveInMode: "sneak" },

  ...clipboardKeys,
];

export const normalMode: Mode = {
  isInsertMode: false,
  name: "normal",
  statusItemText: "Normal",
  handleSubCommandChain: makeSubChainHandler(normalKeyMap),
};
