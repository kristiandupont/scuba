import * as vscode from "vscode";
import {
  changeMode,
  defaultMode,
  makeSubChainHandler,
  Mode,
} from "./extension";
import { insertMode } from "./insertMode";
import { sharedSelectionKeys } from "./sharedSelectionKeys";

type Pair = [left: string, right: string];
export type Motion = {
  keys: string;
  matcher: (s: vscode.Selection, doc: vscode.TextDocument) => vscode.Range[];
};

function makePairedMotionMatcher(
  [left, right]: Pair,
  mode: "inside" | "around"
) {
  return (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    let start: vscode.Position | null = null;
    let end: vscode.Position | null = null;
    let nestingLevel = 0;

    // Search backwards for opening character
    for (let line = cursorPosition.line; line >= 0; line--) {
      const lineText = doc.lineAt(line).text;
      for (
        let char =
          line === cursorPosition.line
            ? cursorPosition.character
            : lineText.length - 1;
        char >= 0;
        char--
      ) {
        if (lineText[char] === right) nestingLevel++;
        if (lineText[char] === left) {
          if (nestingLevel === 0) {
            start = new vscode.Position(
              line,
              char + (mode === "inside" ? 1 : 0)
            );
            break;
          }
          nestingLevel--;
        }
      }
      if (start) break;
    }

    nestingLevel = 0;
    // Search forwards for closing character
    for (let line = cursorPosition.line; line < doc.lineCount; line++) {
      const lineText = doc.lineAt(line).text;
      for (
        let char = line === cursorPosition.line ? cursorPosition.character : 0;
        char < lineText.length;
        char++
      ) {
        if (lineText[char] === left) nestingLevel++;
        if (lineText[char] === right) {
          if (nestingLevel === 0) {
            end = new vscode.Position(line, char + (mode === "around" ? 1 : 0));
            break;
          }
          nestingLevel--;
        }
      }
      if (end) break;
    }

    if (start && end) {
      return [new vscode.Range(start, end)];
    }

    return [];
  };
}

function makeNarrowestPairMotionMatcher(
  pairs: Pair[],
  mode: "inside" | "around"
) {
  return (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    let narrowestRange: vscode.Range | null = null;

    for (const [left, right] of pairs) {
      let start: vscode.Position | null = null;
      let end: vscode.Position | null = null;
      let nestingLevel = 0;

      // Search backwards for opening character
      for (let line = cursorPosition.line; line >= 0; line--) {
        const lineText = doc.lineAt(line).text;
        for (
          let char =
            line === cursorPosition.line
              ? cursorPosition.character
              : lineText.length - 1;
          char >= 0;
          char--
        ) {
          if (lineText[char] === right) nestingLevel++;
          if (lineText[char] === left) {
            if (nestingLevel === 0) {
              start = new vscode.Position(
                line,
                char + (mode === "inside" ? 1 : 0)
              );
              break;
            }
            nestingLevel--;
          }
        }
        if (start) break;
      }

      nestingLevel = 0;
      // Search forwards for closing character
      for (let line = cursorPosition.line; line < doc.lineCount; line++) {
        const lineText = doc.lineAt(line).text;
        for (
          let char =
            line === cursorPosition.line ? cursorPosition.character : 0;
          char < lineText.length;
          char++
        ) {
          if (lineText[char] === left) nestingLevel++;
          if (lineText[char] === right) {
            if (nestingLevel === 0) {
              end = new vscode.Position(
                line,
                char + (mode === "around" ? 1 : 0)
              );
              break;
            }
            nestingLevel--;
          }
        }
        if (end) break;
      }

      if (start && end) {
        const range = new vscode.Range(start, end);
        if (
          !narrowestRange ||
          range.end.line - range.start.line <
            narrowestRange.end.line - narrowestRange.start.line ||
          (range.end.line === narrowestRange.end.line &&
            range.start.line === narrowestRange.start.line &&
            range.end.character - range.start.character <
              narrowestRange.end.character - narrowestRange.start.character)
        ) {
          narrowestRange = range;
        }
      }
    }

    return narrowestRange ? [narrowestRange] : [];
  };
}

const insideWord: Motion = {
  keys: "iw",
  matcher: (s: vscode.Selection, doc: vscode.TextDocument) => {
    const wordRange = doc.getWordRangeAtPosition(s.active);
    return wordRange ? [wordRange] : [];
  },
};

const insideDoubleQuotes: Motion = {
  keys: 'i"',
  matcher: makePairedMotionMatcher(['"', '"'], "inside"),
};

const insideSingleQuotes: Motion = {
  keys: "i'",
  matcher: makePairedMotionMatcher(["'", "'"], "inside"),
};

const insideBackticks: Motion = {
  keys: "ib",
  matcher: makePairedMotionMatcher(["`", "`"], "inside"),
};

const insideNarrowestQuotes: Motion = {
  keys: "iq",
  matcher: makeNarrowestPairMotionMatcher(
    [
      ['"', '"'],
      ["'", "'"],
      ["`", "`"],
    ],
    "inside"
  ),
};

const insideParentheses: Motion = {
  keys: "i(",
  matcher: makePairedMotionMatcher(["(", ")"], "inside"),
};

const insideBrackets: Motion = {
  keys: "i[",
  matcher: makePairedMotionMatcher(["[", "]"], "inside"),
};

const insideBraces: Motion = {
  keys: "i{",
  matcher: makePairedMotionMatcher(["{", "}"], "inside"),
};

const insideAngleBrackets: Motion = {
  keys: "i<",
  matcher: makePairedMotionMatcher(["<", ">"], "inside"),
};

const insideNarrowestBrackets: Motion = {
  keys: "ib",
  matcher: makeNarrowestPairMotionMatcher(
    [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
      ["<", ">"],
    ],
    "inside"
  ),
};

const motions: Motion[] = [
  insideWord,
  insideDoubleQuotes,
  insideSingleQuotes,
  insideBackticks,
  insideNarrowestQuotes,
  insideParentheses,
  insideBrackets,
  insideBraces,
  insideAngleBrackets,
  insideNarrowestBrackets,
];

function applyMotion(
  motion: Motion,
  editor: vscode.TextEditor
): vscode.Range[] {
  const document = editor.document;
  const ranges: vscode.Range[] = [];

  for (const selection of editor.selections) {
    const results = motion.matcher(selection, document);
    ranges.push(...results);
  }

  return ranges;
}

async function select(
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

const visualSubChainHandler = makeSubChainHandler([
  { keys: "<up>", command: "cursorUpSelect" },
  { keys: "<down>", command: "cursorDownSelect" },
  { keys: "<left>", command: "cursorLeftSelect" },
  { keys: "<right>", command: "cursorRightSelect" },
  ...sharedSelectionKeys,
]);

export const visualMode: Mode = {
  isInsertMode: false,
  name: "visual",
  statusItemText: "Visual",
  color: new vscode.ThemeColor("editor.foreground"),

  onEnter: async function () {
    vscode.commands.executeCommand("cursorRightSelect");
  },

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions.find((m) => m.keys === keys);
    if (motion) {
      await select(motion, textEditor);
      changeMode({ mode: defaultMode });
    } else {
      const partialMatch = motions.some((m) => m.keys.startsWith(keys));
      if (!partialMatch) {
        // Not a motion. Try with the fallback visual sub-chain handler.
        return visualSubChainHandler(keys, textEditor);
      }
    }
  },
};

export const changeObjectMode: Mode = {
  isInsertMode: false,
  name: "change",
  statusItemText: "Change",
  color: new vscode.ThemeColor("editor.foreground"),
  cursorStyle: vscode.TextEditorCursorStyle.Block,

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions.find((m) => m.keys === keys);
    if (motion) {
      await select(motion, textEditor);
      const anySelection = textEditor.selections.some(
        (selection) => !selection.isEmpty
      );

      changeMode({ mode: anySelection ? insertMode.name : defaultMode });
    } else {
      const partialMatch = motions.some((motion) =>
        motion.keys.startsWith(keys)
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
  cursorStyle: vscode.TextEditorCursorStyle.Line,

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions.find((m) => m.keys === keys);
    if (motion) {
      await yank(motion, textEditor);
      await deleteFromMotion(motion, textEditor);
      changeMode({ mode: defaultMode });
    } else {
      const partialMatch = motions.some((motion) =>
        motion.keys.startsWith(keys)
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
  cursorStyle: vscode.TextEditorCursorStyle.Line,

  handleSubCommandChain: async function (
    keys: string,
    textEditor: vscode.TextEditor
  ) {
    const motion = motions.find((m) => m.keys === keys);
    if (motion) {
      await yank(motion, textEditor);
      changeMode({ mode: defaultMode });
    } else {
      const partialMatch = motions.some((motion) =>
        motion.keys.startsWith(keys)
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
