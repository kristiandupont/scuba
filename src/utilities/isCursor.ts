import * as vscode from "vscode";

let isCursor = false;

export function getIsCursor(): boolean {
  return isCursor;
}

async function checkIsCursor() {
  try {
    await vscode.commands.executeCommand("editor.action.enableCppGlobally");
    isCursor = true;
  } catch (error) {
    isCursor = false;
  }
}

checkIsCursor();
