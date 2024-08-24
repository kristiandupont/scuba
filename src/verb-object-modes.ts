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
import { isAnyTextSelected, pushSelections } from "./utilities/selection";
import { moveCursorsRightUnlessTheyAreAtEOL } from "./utilities/movement";

function applyMotion(
  motion: Motion,
  editor: vscode.TextEditor
): vscode.Selection[] {
  const document = editor.document;
  const selections: vscode.Selection[] = [];

  for (const selection of editor.selections) {
    const results = motion(selection, document);
    selections.push(...results);
  }

  return selections;
}

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
  const textsToCopy: string[] = [];

  selections.forEach((selection) => {
    const text = editor.document.getText(selection);
    textsToCopy.push(text);
  });

  const textToCopy = textsToCopy.join("\n");
  await vscode.env.clipboard.writeText(textToCopy);
}

async function deleteFromMotion(
  motion: Motion,
  editor: vscode.TextEditor
): Promise<void> {
  const selections = applyMotion(motion, editor);
  if (selections.length === 0) {
    return;
  }
  const edits: vscode.TextEdit[] = selections.map((selection) =>
    vscode.TextEdit.delete(selection)
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

    if (!isAnyTextSelected(editor)) {
      moveCursorsRightUnlessTheyAreAtEOL(1, editor);
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
  color: "pink",

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
  color: "pink",

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
  color: "pink",

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
