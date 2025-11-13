import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";
import { Motion, motions } from "./motions/motions";
import { makeSearchMotion } from "./motions/makeSearchMotion";
import {
  surroundMap,
  SurroundKey,
  addSurroundingToSelections,
  changeSurroundingInSelections,
  deleteSurroundingFromSelections,
} from "./surroundMode";

function applyMotion(
  motion: Motion,
  editor: vscode.TextEditor
): vscode.Selection[] {
  const document = editor.document;
  const selections: vscode.Selection[] = editor.selections
    .map((selection) => motion(selection, document))
    .flat();

  return selections;
}

function findMotion(keys: string): Motion | "partial" | undefined {
  // Search motions aren't registered because they rely on an
  // unknown second character.
  if (["f", "F", "t", "T"].includes(keys[0])) {
    if (keys.length === 1) {
      return "partial";
    }

    const mode = ["f", "F"].includes(keys[0]) ? "inclusive" : "exclusive";
    const direction = ["f", "t"].includes(keys[0]) ? "forward" : "backward";
    const character = keys[1];

    return makeSearchMotion(character, mode, direction);
  }

  // Otherwise, check the registry
  const motion = motions[keys];
  if (motion) {
    return motion;
  }

  const partialMatch = Object.keys(motions).some((motion) =>
    motion.startsWith(keys)
  );
  if (partialMatch) {
    return "partial";
  }

  return undefined;
}

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
    // Special case: "ss" surrounds the entire line
    if (keys === "ss") {
      // Select the whole line(s)
      const currentSelections = textEditor.selections;
      const lineSelections = currentSelections.map((selection) => {
        const line = textEditor.document.lineAt(selection.active.line);
        return new vscode.Selection(line.range.start, line.range.end);
      });

      // Wait for the surround character
      // We'll use a special marker to indicate we're waiting for the surround char
      return;
    }

    // Check if we have captured a motion already (keys should be at least 2 chars)
    if (keys.startsWith("ss") && keys.length === 3) {
      // "ss<char>" - surround line with char
      const surroundChar = keys[2];
      if (!isSurroundKey(surroundChar)) {
        vscode.window.showWarningMessage(
          `Unknown surround character: ${surroundChar}.`
        );
        changeMode({ mode: defaultMode });
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
      changeMode({ mode: defaultMode });
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
      changeMode({ mode: defaultMode });
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
      changeMode({ mode: defaultMode });
      return;
    }

    // Add surrounding
    await addSurroundingToSelections(textEditor, selections, surroundChar);
    changeMode({ mode: defaultMode });
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
      changeMode({ mode: defaultMode });
      return;
    }

    if (!isSurroundKey(newChar)) {
      vscode.window.showWarningMessage(
        `Unknown surround character: ${newChar}.`
      );
      changeMode({ mode: defaultMode });
      return;
    }

    // Find the text object motion for the old surround character
    // Map surround keys to their "inside" motion equivalents
    const surroundToMotionMap: Record<string, string> = {
      '"': 'i"',
      "'": "i'",
      "(": "i(",
      ")": "i(",
      "[": "i[",
      "]": "i[",
      "{": "i{",
      "}": "i{",
      "<": "i<",
      ">": "i<",
      b: "it", // backticks
    };

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

    changeMode({ mode: defaultMode });
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
      changeMode({ mode: defaultMode });
      return;
    }

    // Find the text object motion for the surround character
    // Map surround keys to their "inside" motion equivalents
    const surroundToMotionMap: Record<string, string> = {
      '"': 'i"',
      "'": "i'",
      "(": "i(",
      ")": "i(",
      "[": "i[",
      "]": "i[",
      "{": "i{",
      "}": "i{",
      "<": "i<",
      ">": "i<",
      b: "it", // backticks
    };

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

    changeMode({ mode: defaultMode });
  },
};
