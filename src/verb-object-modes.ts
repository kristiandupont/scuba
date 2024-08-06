import * as vscode from "vscode";
import {
  changeMode,
  defaultMode,
  makeSubChainHandler,
  Mode,
  resetCommandChain,
} from "./extension";
import { sharedSelectionKeys } from "./sharedSelectionKeys";
import { Motion, motions } from "./motions/motions";

function applyMotion(
  motion: Motion,
  editor: vscode.TextEditor
): vscode.Range[] {
  const document = editor.document;
  const ranges: vscode.Range[] = [];

  for (const selection of editor.selections) {
    const results = motion(selection, document);
    ranges.push(...results);
  }

  return ranges;
}

async function selectFromMotion(
  motion: Motion,
  editor: vscode.TextEditor
): Promise<void> {
  const ranges = applyMotion(motion, editor);
  editor.selections = ranges.map(
    (range) => new vscode.Selection(range.start, range.end)
  );
}

async function yank(motion: Motion, editor: vscode.TextEditor): Promise<void> {
  const ranges = applyMotion(motion, editor);
  const textsToCopy: string[] = [];

  ranges.forEach((range) => {
    const text = editor.document.getText(range);
    textsToCopy.push(text);
  });

  const textToCopy = textsToCopy.join("\n");
  await vscode.env.clipboard.writeText(textToCopy);
}

async function deleteFromMotion(
  motion: Motion,
  editor: vscode.TextEditor
): Promise<void> {
  const ranges = applyMotion(motion, editor);
  const edits: vscode.TextEdit[] = ranges.map((range) =>
    vscode.TextEdit.delete(range)
  );

  await editor.edit((editBuilder) => {
    edits.forEach((edit) => editBuilder.replace(edit.range, edit.newText));
  });
}

const selectSubChainHandler = makeSubChainHandler([
  { keys: "<up>", command: "cursorUpSelect" },
  { keys: "<down>", command: "cursorDownSelect" },
  { keys: "<left>", command: "cursorLeftSelect" },
  { keys: "<right>", command: "cursorRightSelect" },
  { keys: "<home>", command: "cursorHomeSelect" },
  { keys: "<end>", command: "cursorEndSelect" },
  { keys: "<pageup>", command: "cursorPageUpSelect" },
  { keys: "<pagedown>", command: "cursorPageDownSelect" },

  { keys: "S", leaveInMode: "smart-select" },
  { keys: "V", leaveInMode: "line-select" },

  ...sharedSelectionKeys,
]);

export const selectMode: Mode = {
  isInsertMode: false,
  name: "select",
  statusItemText: "Select",
  color: new vscode.ThemeColor("editor.foreground"),

  onEnter: async function () {
    vscode.commands.executeCommand("cursorRightSelect");
  },

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions[keys];
    if (motion) {
      await selectFromMotion(motion, textEditor);
      resetCommandChain();
    } else {
      const partialMatch = Object.keys(motions).some((motion) =>
        motion.startsWith(keys)
      );
      if (!partialMatch) {
        // Not a motion. Try with the fallback select sub-chain handler.
        return selectSubChainHandler(keys, textEditor);
      }
    }
  },
};

export const changeObjectMode: Mode = {
  isInsertMode: false,
  name: "change",
  statusItemText: "Change",
  color: new vscode.ThemeColor("editor.foreground"),

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions[keys];
    if (motion) {
      await selectFromMotion(motion, textEditor);
      const anySelection = textEditor.selections.some(
        (selection) => !selection.isEmpty
      );
      if (anySelection) {
        await vscode.commands.executeCommand("deleteRight");
      }

      changeMode({ mode: anySelection ? "insert" : defaultMode });
    } else {
      const partialMatch = Object.keys(motions).some((motion) =>
        motion.startsWith(keys)
      );

      if (!partialMatch) {
        vscode.window.showWarningMessage(
          `Unknown motion key sequence: ${keys}.`
        );
        changeMode({ mode: defaultMode });
      }
    }
  },
};

export const deleteObjectMode: Mode = {
  isInsertMode: false,
  name: "delete",
  statusItemText: "Delete",
  color: new vscode.ThemeColor("editor.foreground"),

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions[keys];
    if (motion) {
      await yank(motion, textEditor);
      await deleteFromMotion(motion, textEditor);
      changeMode({ mode: defaultMode });
    } else {
      const partialMatch = Object.keys(motions).some((motion) =>
        motion.startsWith(keys)
      );
      if (!partialMatch) {
        vscode.window.showWarningMessage(
          `Unknown motion key sequence: ${keys}.`
        );
        changeMode({ mode: defaultMode });
      }
    }
  },
};

export const yankObjectMode: Mode = {
  isInsertMode: false,
  name: "yank",
  statusItemText: "Yank",
  color: new vscode.ThemeColor("editor.foreground"),

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions[keys];
    if (motion) {
      await yank(motion, textEditor);
      changeMode({ mode: defaultMode });
    } else {
      const partialMatch = Object.keys(motions).some((motion) =>
        motion.startsWith(keys)
      );
      if (!partialMatch) {
        vscode.window.showWarningMessage(
          `Unknown motion key sequence: ${keys}.`
        );
        changeMode({ mode: defaultMode });
      }
    }
  },
};
