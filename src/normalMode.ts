import * as vscode from "vscode";
import { defaultMode, KeyMap, makeSubChainHandler, Mode } from "./extension";
import {
  moveCursorsRightUnlessTheyAreAtEOL,
  moveCursorsToStartOfLine,
} from "./utilities/movement";
import {
  changeObjectMode,
  deleteObjectMode,
  selectMode,
  yankObjectMode,
} from "./verb-object-modes";
import { replaceCharMode } from "./replaceCharMode";
import { lineSelectMode } from "./lineSelectMode";
import { smartSelectMode } from "./smartSelectMode";
import { sneakMode } from "./sneakMode";
import { insertMode } from "./insertMode";
import { lineModeAwarePaste, popSelections } from "./utilities/selection";

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
      moveCursorsToStartOfLine(vscode.window.activeTextEditor!);
      await vscode.commands.executeCommand("cursorHome");
      await vscode.commands.executeCommand("deleteAllRight");
      await vscode.commands.executeCommand("scuba.changeMode", {
        mode: insertMode.name,
      });
    },
  },
  {
    keys: "D",
    command: "editor.actions.clipboardCutAction",
  },
  { keys: "Y", command: "editor.action.clipboardCopyAction" },
  {
    keys: "p",
    command: async function () {
      return lineModeAwarePaste(vscode.window.activeTextEditor!, "after");
    },
    leaveInMode: defaultMode,
  },
  {
    keys: "P",
    command: async function () {
      return lineModeAwarePaste(vscode.window.activeTextEditor!, "before");
    },
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
  { keys: "%", command: "editor.action.jumpToBracket" },

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

  { keys: "v", leaveInMode: selectMode.name },
  { keys: "V", leaveInMode: lineSelectMode.name },
  { keys: "S", leaveInMode: smartSelectMode.name },

  { keys: "c", leaveInMode: changeObjectMode.name },
  { keys: "y", leaveInMode: yankObjectMode.name },
  { keys: "d", leaveInMode: deleteObjectMode.name },

  { keys: "r", leaveInMode: replaceCharMode.name },

  { keys: ":", leaveInMode: "go-to-line" },
  { keys: "f", leaveInMode: "find-char/inclusive" },
  { keys: "t", leaveInMode: "find-char/exclusive" },
  { keys: "  ", leaveInMode: sneakMode.name },
];

export const normalMode: Mode = {
  isInsertMode: false,
  name: "normal",
  statusItemText: "Normal",
  onEnter: async function () {
    vscode.commands.executeCommand("cancelSelection");
  },
  handleSubCommandChain: makeSubChainHandler(normalKeyMap),
};
