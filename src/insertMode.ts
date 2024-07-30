import * as vscode from "vscode";
import { Mode } from "./extension";

export const insertMode: Mode = {
  isInsertMode: true,
  name: "insert",
  statusItemText: "Insert",
  color: new vscode.ThemeColor("editor.foreground"),
  cursorStyle: vscode.TextEditorCursorStyle.Line,
};
