import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";

const surroundMap = {
  '"': ['"', '"'],
  "'": ["'", "'"],
  "(": ["(", ")"],
  "[": ["[", "]"],
  "{": ["{ ", " }"],
  "}": ["{", "}"],
  "<": ["<", ">"],
  "`": ["`", "`"],
  d: ["<div>", "</div>"],
};

type SurroundKey = keyof typeof surroundMap;

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
