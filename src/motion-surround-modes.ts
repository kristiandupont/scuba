import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";
import { applyMotion, findMotion, motions } from "./motions/motions";
import {
  surroundMap,
  SurroundKey,
  surroundToMotionMap,
  addSurroundingToSelections,
  changeSurroundingInSelections,
  deleteSurroundingFromSelections,
} from "./surroundMode";

function isSurroundKey(key: string): key is SurroundKey {
  return key in surroundMap;
}

// You Surround Mode - handles "ys<motion><char>"
export const youSurroundMode: Mode = {
  isInsertMode: false,
  name: "you-surround",
  statusItemText: "You Surround",
  color: "cyan",

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    // "ss" surrounds the whole line, but needs the surround character first.
    if (keys === "ss") {
      return;
    }

    if (keys.startsWith("ss") && keys.length === 3) {
      const surroundChar = keys[2];
      if (!isSurroundKey(surroundChar)) {
        vscode.window.showWarningMessage(
          `Unknown surround character: ${surroundChar}.`
        );
        await changeMode({ mode: defaultMode });
        return;
      }

      const currentSelections = textEditor.selections;
      const lineSelections = currentSelections.map((selection) => {
        const line = textEditor.document.lineAt(selection.active.line);
        return new vscode.Selection(line.range.start, line.range.end);
      });

      await addSurroundingToSelections(
        textEditor,
        lineSelections,
        surroundChar
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    // Try to parse as <motion><char>
    // The last character should be the surround key
    // Everything before it should be the motion
    if (keys.length < 2) {
      // Still waiting for more input
      return;
    }

    // Try parsing with last character as surround key
    const surroundChar = keys[keys.length - 1];
    const motionKeys = keys.slice(0, -1);

    // First check if the motion is complete
    const motion = findMotion(motionKeys);

    if (motion === "partial") {
      // Still waiting for the motion to complete
      return;
    }

    if (motion === undefined) {
      // Maybe the surround character is not the last one yet
      // Or the motion is invalid
      // Let's check if any surround keys are in the current keys
      const hasSurroundKey = Array.from(keys).some(isSurroundKey);

      if (!hasSurroundKey) {
        // No surround key yet, keep waiting
        const motionStillPossible = findMotion(keys) === "partial";
        if (motionStillPossible) {
          return;
        }
      }

      vscode.window.showWarningMessage(`Unknown motion: ${motionKeys}.`);
      await changeMode({ mode: defaultMode });
      return;
    }

    // Motion is valid, check surround key
    if (!isSurroundKey(surroundChar)) {
      // Not a valid surround key, keep waiting for one
      return;
    }

    // Apply the motion to get selections
    const selections = applyMotion(motion, textEditor);
    if (selections.length === 0) {
      await changeMode({ mode: defaultMode });
      return;
    }

    // Add surrounding
    await addSurroundingToSelections(textEditor, selections, surroundChar);
    await changeMode({ mode: defaultMode });
  },
};

// Change Surround Mode - handles "cs<old><new>"
export const changeSurroundMode: Mode = {
  isInsertMode: false,
  name: "change-surround",
  statusItemText: "Change Surround",
  color: "cyan",

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys.length < 2) {
      // Waiting for both old and new surround keys
      return;
    }

    const oldChar = keys[0];
    const newChar = keys[1];

    if (!isSurroundKey(oldChar)) {
      vscode.window.showWarningMessage(
        `Unknown surround character: ${oldChar}.`
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    if (!isSurroundKey(newChar)) {
      vscode.window.showWarningMessage(
        `Unknown surround character: ${newChar}.`
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    const motionKey = surroundToMotionMap[oldChar];
    if (motionKey) {
      const motion = motions[motionKey];
      if (motion) {
        const selections = applyMotion(motion, textEditor);
        if (selections.length > 0) {
          await changeSurroundingInSelections(
            textEditor,
            selections,
            newChar
          );
        }
      }
    }

    await changeMode({ mode: defaultMode });
  },
};

// Delete Surround Mode - handles "ds<char>"
export const deleteSurroundMode: Mode = {
  isInsertMode: false,
  name: "delete-surround",
  statusItemText: "Delete Surround",
  color: "cyan",

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys.length < 1) {
      // Waiting for the surround key
      return;
    }

    const surroundChar = keys[0];

    if (!isSurroundKey(surroundChar)) {
      vscode.window.showWarningMessage(
        `Unknown surround character: ${surroundChar}.`
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    const motionKey = surroundToMotionMap[surroundChar];
    if (motionKey) {
      const motion = motions[motionKey];
      if (motion) {
        const selections = applyMotion(motion, textEditor);
        if (selections.length > 0) {
          await deleteSurroundingFromSelections(textEditor, selections);
        }
      }
    }

    await changeMode({ mode: defaultMode });
  },
};
