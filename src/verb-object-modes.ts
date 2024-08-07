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
import { makeSearchMotion } from "./motions/makeSearchMotion";
import { isAnyTextSelected, storeSelections } from "./utilities/selection";

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

    { keys: "S", leaveInMode: "smart-select" },
    { keys: "V", leaveInMode: "line-select" },

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

    storeSelections(editor);

    if (!isAnyTextSelected(editor)) {
      vscode.commands.executeCommand("cursorRightSelect");
    }
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
  color: new vscode.ThemeColor("editor.foreground"),

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
      const anySelection = textEditor.selections.some(
        (selection) => !selection.isEmpty
      );
      if (anySelection) {
        await vscode.commands.executeCommand("deleteRight");
      }

      changeMode({ mode: anySelection ? "insert" : defaultMode });
    } else {
      vscode.window.showWarningMessage(`Unknown motion key sequence: ${keys}.`);
      changeMode({ mode: defaultMode });
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
    const motion = findMotion(keys);

    if (motion) {
      if (motion === "partial") {
        return;
      }

      await yank(motion, textEditor);
      await deleteFromMotion(motion, textEditor);
      changeMode({ mode: defaultMode });
    } else {
      vscode.window.showWarningMessage(`Unknown motion key sequence: ${keys}.`);
      changeMode({ mode: defaultMode });
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
    const motion = findMotion(keys);

    if (motion) {
      if (motion === "partial") {
        return;
      }

      await yank(motion, textEditor);
      changeMode({ mode: defaultMode });
    } else {
      vscode.window.showWarningMessage(`Unknown motion key sequence: ${keys}.`);
      changeMode({ mode: defaultMode });
    }
  },
};
