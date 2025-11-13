import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";

export const surroundMap = {
  '"': ['"', '"'],
  "'": ["'", "'"],
  "(": ["(", ")"],
  "[": ["[", "]"],
  "{": ["{ ", " }"],
  "}": ["{", "}"],
  "<": ["<", ">"],
  b: ["`", "`"], // backticks
  d: ["<div>", "</div>"],
  f: ["<>", "</>"], // React fragment
} as const;

export type SurroundKey = keyof typeof surroundMap;

/*
scheme:
a<key> = surround selections with <key> (add)
r<key> = replace surrounding (whatever is surrounding the selection) with <key> (replace)
d = delete surrounding
*/

function surroundWith(textEditor: vscode.TextEditor, key: SurroundKey) {
  if (!surroundMap[key]) {
    return;
  }

  const [prefix, suffix] = surroundMap[key];
  const { selections } = textEditor;
  const edits = selections.flatMap(({ start, end }) => [
    vscode.TextEdit.insert(start, prefix),
    vscode.TextEdit.insert(end, suffix),
  ]);
  textEditor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

function replaceSurrounding(textEditor: vscode.TextEditor, key: SurroundKey) {
  if (!surroundMap[key]) {
    return;
  }

  const [prefix, suffix] = surroundMap[key];
  const { selections } = textEditor;
  const edits = selections.flatMap(({ start, end }) => {
    // Figure out what the surrounding key is
    const existingKey = Object.keys(surroundMap).find((k) => {
      const [p, s] = surroundMap[k as SurroundKey];
      return (
        textEditor.document.getText(
          new vscode.Range(start.translate(0, -p.length), start)
        ) === p &&
        textEditor.document.getText(
          new vscode.Range(end, end.translate(0, s.length))
        ) === s
      );
    });
    if (!existingKey) {
      return [];
    }
    const [p, s] = surroundMap[existingKey as SurroundKey];
    return [
      vscode.TextEdit.replace(
        new vscode.Range(start.translate(0, -p.length), start),
        prefix
      ),
      vscode.TextEdit.replace(
        new vscode.Range(end, end.translate(0, s.length)),
        suffix
      ),
    ];
  });
  textEditor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

function deleteSurrounding(textEditor: vscode.TextEditor) {
  const { selections } = textEditor;
  const edits = selections.flatMap(({ start, end }) => {
    // Figure out what the surrounding key is
    const existingKey = Object.keys(surroundMap).find((k) => {
      const [p, s] = surroundMap[k as SurroundKey];
      return (
        textEditor.document.getText(
          new vscode.Range(start.translate(0, -p.length), start)
        ) === p &&
        textEditor.document.getText(
          new vscode.Range(end, end.translate(0, s.length))
        ) === s
      );
    });
    if (!existingKey) {
      return [];
    }
    const [p, s] = surroundMap[existingKey as SurroundKey];
    return [
      vscode.TextEdit.delete(
        new vscode.Range(start.translate(0, -p.length), start)
      ),
      vscode.TextEdit.delete(new vscode.Range(end, end.translate(0, s.length))),
    ];
  });
  textEditor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

// Shared utility functions for motion-based surround operations

/**
 * Finds the existing surrounding characters/tags around a selection.
 * Returns the SurroundKey if found, undefined otherwise.
 */
export function findExistingSurrounding(
  document: vscode.TextDocument,
  start: vscode.Position,
  end: vscode.Position
): SurroundKey | undefined {
  const existingKey = Object.keys(surroundMap).find((k) => {
    const [p, s] = surroundMap[k as SurroundKey];
    return (
      document.getText(new vscode.Range(start.translate(0, -p.length), start)) ===
        p &&
      document.getText(new vscode.Range(end, end.translate(0, s.length))) === s
    );
  });
  return existingKey as SurroundKey | undefined;
}

/**
 * Adds surrounding characters/tags to selections.
 */
export async function addSurroundingToSelections(
  textEditor: vscode.TextEditor,
  selections: vscode.Selection[],
  key: SurroundKey
): Promise<void> {
  if (!surroundMap[key]) {
    return;
  }

  const [prefix, suffix] = surroundMap[key];
  const edits = selections.flatMap(({ start, end }) => [
    vscode.TextEdit.insert(start, prefix),
    vscode.TextEdit.insert(end, suffix),
  ]);
  await textEditor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

/**
 * Changes existing surrounding characters/tags to new ones.
 */
export async function changeSurroundingInSelections(
  textEditor: vscode.TextEditor,
  selections: vscode.Selection[],
  newKey: SurroundKey
): Promise<void> {
  if (!surroundMap[newKey]) {
    return;
  }

  const [newPrefix, newSuffix] = surroundMap[newKey];
  const edits = selections.flatMap(({ start, end }) => {
    const existingKey = findExistingSurrounding(
      textEditor.document,
      start,
      end
    );
    if (!existingKey) {
      return [];
    }
    const [oldPrefix, oldSuffix] = surroundMap[existingKey];
    return [
      vscode.TextEdit.replace(
        new vscode.Range(start.translate(0, -oldPrefix.length), start),
        newPrefix
      ),
      vscode.TextEdit.replace(
        new vscode.Range(end, end.translate(0, oldSuffix.length)),
        newSuffix
      ),
    ];
  });
  await textEditor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

/**
 * Deletes surrounding characters/tags from selections.
 */
export async function deleteSurroundingFromSelections(
  textEditor: vscode.TextEditor,
  selections: vscode.Selection[]
): Promise<void> {
  const edits = selections.flatMap(({ start, end }) => {
    const existingKey = findExistingSurrounding(
      textEditor.document,
      start,
      end
    );
    if (!existingKey) {
      return [];
    }
    const [prefix, suffix] = surroundMap[existingKey];
    return [
      vscode.TextEdit.delete(
        new vscode.Range(start.translate(0, -prefix.length), start)
      ),
      vscode.TextEdit.delete(
        new vscode.Range(end, end.translate(0, suffix.length))
      ),
    ];
  });
  await textEditor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

export const surroundMode: Mode = {
  isInsertMode: false,
  name: "surround",
  statusItemText: "Surround",
  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys === "a" || keys === "r") {
      // Wait for the next key
    } else if (keys.length === 2 && keys[0] === "a") {
      surroundWith(textEditor, keys[1] as SurroundKey);
      changeMode({ mode: defaultMode });
    } else if (keys.length === 2 && keys[0] === "r") {
      replaceSurrounding(textEditor, keys[1] as SurroundKey);
      changeMode({ mode: defaultMode });
    } else if (keys === "d") {
      deleteSurrounding(textEditor);
      changeMode({ mode: defaultMode });
    } else {
      vscode.window.showWarningMessage(`Unknown key sequence: ${keys}.`);
      changeMode({ mode: defaultMode });
    }
  },
};
