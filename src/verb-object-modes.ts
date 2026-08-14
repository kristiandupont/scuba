import * as vscode from "vscode";
import {
  changeMode,
  defaultMode,
  makeSubChainHandler,
  Mode,
  resetCommandChain,
} from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";
import { applyMotion, findMotion, Motion } from "./motions/motions";
import { isAnyTextSelected, pushSelections } from "./utilities/selection";
import { moveCursorsToStartOfLine } from "./utilities/movement";
import { runClipboardCommand, writeClipboard } from "./utilities/clipboard";

async function selectFromMotion(
  motion: Motion,
  editor: vscode.TextEditor
): Promise<void> {
  const selections = applyMotion(motion, editor);
  if (selections.length === 0) {
    return;
  }
  editor.selections = selections;
}

async function yank(motion: Motion, editor: vscode.TextEditor): Promise<void> {
  const selections = applyMotion(motion, editor);
  if (selections.length === 0) {
    return;
  }
  const textsToCopy = selections.map((selection) =>
    editor.document.getText(selection)
  );

  // No motion in the registry is line-shaped, so a motion yank is always
  // charwise. Recording that explicitly also keeps a previous linewise yank
  // from being what the clipboard is next compared against.
  await writeClipboard(textsToCopy.join("\n"), false);
}

async function deleteFromMotion(
  motion: Motion,
  editor: vscode.TextEditor
): Promise<void> {
  const selections = applyMotion(motion, editor);
  if (selections.length === 0) {
    return;
  }
  const edits = selections.map((selection) =>
    vscode.TextEdit.delete(selection)
  );

  await editor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

const selectSubChainHandler = makeSubChainHandler(
  [
    { keys: "<up>", command: "cursorUpSelect" },
    { keys: "<down>", command: "cursorDownSelect" },
    { keys: "<left>", command: "cursorLeftSelect" },
    { keys: "<right>", command: "cursorRightSelect" },
    { keys: "<home>", command: "cursorHomeSelect" },
    { keys: "<end>", command: "cursorEndSelect" },
    { keys: "<pageup>", command: "cursorPageUpSelect" },
    { keys: "<pagedown>", command: "cursorPageDownSelect" },
    { keys: "%", command: "editor.action.selectToBracket" },

    ...sharedSelectionKeys,
  ],
  undefined, // leaveInMode -- don't change after a subcommand
  undefined // leaveInModeOnNoMatch -- don't even change if no match
);

export const selectMode: Mode = {
  isInsertMode: false,
  name: "select",
  statusItemText: "Select",
  color: new vscode.ThemeColor("editor.foreground"),

  onEnter: async function () {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      return;
    }

    pushSelections(editor);
  },

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = findMotion(keys);

    if (motion) {
      if (motion === "partial") {
        return;
      }

      await selectFromMotion(motion, textEditor);
      resetCommandChain();
    } else {
      selectSubChainHandler(keys, textEditor);
    }
  },
};

export const changeObjectMode: Mode = {
  isInsertMode: false,
  name: "change",
  statusItemText: "Change",
  color: "pink",

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys === "c") {
      moveCursorsToStartOfLine(vscode.window.activeTextEditor!);
      await vscode.commands.executeCommand("cursorHome");
      await vscode.commands.executeCommand("deleteAllRight");
      await changeMode({ mode: "insert" });
      return;
    }

    // Delegate to change-surround mode if keys start with "s"
    if (keys === "s") {
      await changeMode({ mode: "change-surround" });
      return;
    }

    const motion = findMotion(keys);

    if (motion) {
      if (motion === "partial") {
        return;
      }

      await selectFromMotion(motion, textEditor);
      const anySelection = textEditor.selections.some(
        (selection) => !selection.isEmpty
      );
      if (anySelection) {
        await vscode.commands.executeCommand("deleteRight");
      }

      await changeMode({ mode: anySelection ? "insert" : defaultMode });
    } else {
      vscode.window.showWarningMessage(`Unknown motion key sequence: ${keys}.`);
      await changeMode({ mode: defaultMode });
    }
  },
};

export const deleteObjectMode: Mode = {
  isInsertMode: false,
  name: "delete",
  statusItemText: "Delete",
  color: "pink",

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys === "d") {
      await runClipboardCommand(
        "editor.action.clipboardCutAction",
        !isAnyTextSelected(textEditor)
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    // Delegate to delete-surround mode if keys start with "s"
    if (keys === "s") {
      await changeMode({ mode: "delete-surround" });
      return;
    }

    const motion = findMotion(keys);

    if (motion) {
      if (motion === "partial") {
        return;
      }

      await yank(motion, textEditor);
      await deleteFromMotion(motion, textEditor);
      await changeMode({ mode: defaultMode });
    } else {
      vscode.window.showWarningMessage(`Unknown motion key sequence: ${keys}.`);
      await changeMode({ mode: defaultMode });
    }
  },
};

export const yankObjectMode: Mode = {
  isInsertMode: false,
  name: "yank",
  statusItemText: "Yank",
  color: "pink",

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    if (keys === "y") {
      await runClipboardCommand(
        "editor.action.clipboardCopyAction",
        !isAnyTextSelected(textEditor)
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    // Delegate to you-surround mode if keys start with "s"
    if (keys === "s") {
      await changeMode({ mode: "you-surround" });
      return;
    }

    const motion = findMotion(keys);

    if (motion) {
      if (motion === "partial") {
        return;
      }

      await yank(motion, textEditor);
      await changeMode({ mode: defaultMode });
    } else {
      vscode.window.showWarningMessage(`Unknown motion key sequence: ${keys}.`);
      await changeMode({ mode: defaultMode });
    }
  },
};
