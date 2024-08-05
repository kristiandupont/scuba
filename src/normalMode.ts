import * as vscode from "vscode";
import { defaultMode, KeyMap, makeSubChainHandler, Mode } from "./extension";
import { moveCursorsRightUnlessTheyAreAtEOL } from "./utilities/movement";
import {
  changeObjectMode,
  deleteObjectMode,
  selectMode,
  yankObjectMode,
} from "./verb-object-modes";
import { matchMode } from "./matchMode";
import { replaceCharMode } from "./replaceCharMode";
import { lineSelectMode } from "./lineSelectMode";
import { smartSelectMode } from "./smartSelectMode";
import { sneakMode } from "./sneakMode";
import { insertMode } from "./insertMode";
import { surroundMode } from "./surroundMode";

const normalKeyMap: KeyMap = [
  { keys: "<up>", command: "cursorUp" },
  { keys: "<down>", command: "cursorDown" },
  { keys: "<left>", command: "cursorLeft" },
  { keys: "<right>", command: "cursorRight" },
  { keys: "<home>", command: "cursorHome" },
  { keys: "<end>", command: "cursorEnd" },
  { keys: "<pageup>", command: "cursorPageUp" },
  { keys: "<pagedown>", command: "cursorPageDown" },

  { keys: "^", command: "cursorLineStartSelect" },
  { keys: "$", command: "cursorLineEndSelect" },

  { keys: "i", leaveInMode: "insert" },
  { keys: "I", command: "cursorHome", leaveInMode: insertMode.name },
  {
    keys: "a",
    command: moveCursorsRightUnlessTheyAreAtEOL,
    leaveInMode: insertMode.name,
  },
  { keys: "A", command: "cursorEnd", leaveInMode: insertMode.name },
  {
    keys: "o",
    command: "editor.action.insertLineAfter",
    leaveInMode: insertMode.name,
  },
  {
    keys: "O",
    command: "editor.action.insertLineBefore",
    leaveInMode: insertMode.name,
  },
  {
    keys: "C",
    // Clear the whole line and leave the cursor in insert mode, on the
    // character that matches indentation:
    command: async function () {
      await vscode.commands.executeCommand("cursorHome");
      await vscode.commands.executeCommand("deleteAllRight");
      await vscode.commands.executeCommand("scuba.changeMode", {
        mode: insertMode.name,
      });
    },
  },
  { keys: "D", command: "deleteAllRight", leaveInMode: defaultMode },
  {
    keys: "p",
    command: "editor.action.clipboardPasteAction",
    leaveInMode: defaultMode,
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

  { keys: "u", command: "undo" },
  { keys: "U", command: "redo" },

  // Scroll the window up or down one line:
  { keys: "k", command: "scrollLineUp" },
  { keys: "j", command: "scrollLineDown" },

  {
    keys: "w",
    command: "cursorWordStartRight",
  },
  {
    keys: "b",
    command: "cursorWordStartLeft",
  },

  { keys: "æ", command: "cursorWordPartRight" },
  { keys: "ø", command: "cursorWordPartLeft" },

  { keys: "*", command: "findWordAtCursor.next" },
  { keys: "#", command: "findWordAtCursor.previous" },
  { keys: "@", command: "editor.action.addSelectionToNextFindMatch" },

  { keys: "f", leaveInMode: "find-char/inclusive" },
  { keys: "t", leaveInMode: "find-char/exclusive" },

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
  {
    keys: "x",
    command: "deleteRight",
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
  { keys: "gc", command: "editor.action.commentLine" },

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

  { keys: "v", leaveInMode: selectMode.name },
  { keys: "c", leaveInMode: changeObjectMode.name },
  { keys: "y", leaveInMode: yankObjectMode.name },
  { keys: "d", leaveInMode: deleteObjectMode.name },

  // Match mode (m)
  { keys: "m", leaveInMode: matchMode.name },

  // Replace char mode (r)
  { keys: "r", leaveInMode: replaceCharMode.name },

  // Line select mode (v)
  { keys: "V", leaveInMode: lineSelectMode.name },

  // Smart select mode (s)
  { keys: "S", leaveInMode: smartSelectMode.name },

  { keys: "  ", leaveInMode: sneakMode.name },

  { keys: " s", leaveInMode: surroundMode.name },
];

export const normalMode: Mode = {
  isInsertMode: false,
  name: "normal",
  statusItemText: "Normal",
  handleSubCommandChain: makeSubChainHandler(normalKeyMap),
};
