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
    keys: "c",
    command: async function () {
      await vscode.commands.executeCommand("deleteRight");
      await vscode.commands.executeCommand("scuba.changeMode", {
        mode: "insert",
      });
    },
    leaveInMode: "normal",
  },
  {
    keys: "S",
    leaveInMode: "surround",
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

  { keys: "w", command: "cursorWordEndRightSelect" },
  { keys: "b", command: "cursorWordStartLeftSelect" },

  { keys: "æ", command: "cursorWordPartRightSelect" },
  { keys: "ø", command: "cursorWordPartLeftSelect" },

  { keys: "*", command: "findWordAtCursor.next" },
  { keys: "#", command: "findWordAtCursor.previous" },
  { keys: "@", command: "editor.action.addSelectionToNextFindMatch" },

  { keys: "f", leaveInMode: "find-char" },
  { keys: "t", leaveInMode: "till-char" },

  { keys: "J", command: "editor.action.joinLines" },
  { keys: " m", command: "textmarker.toggleHighlight" },
  { keys: ",", command: "editor.action.insertCursorBelow" },

  // Goto "mode" (g)
  { keys: "gd", command: "editor.action.goToDeclaration" },
  { keys: "gr", command: "references-view.findReferences" },
  { keys: "gh", command: "editor.action.showHover" },

  // View "mode" (z)
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
  { keys: "m", leaveInMode: "match" },

  // Replace char mode (r)
  { keys: "r", leaveInMode: "replace-char" },

  // Line select mode (v)
  { keys: "V", leaveInMode: "line-select" },

  // Smart select mode (s)
  { keys: "s", leaveInMode: "smart-select" },

  { keys: "-", leaveInMode: "sneak" },

  ...clipboardKeys,
];

export const normalMode: Mode = {
  isInsertMode: false,
  name: "normal",
  statusItemText: "Normal",
  handleSubCommandChain: makeSubChainHandler(normalKeyMap),
};
