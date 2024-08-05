import * as vscode from "vscode";
import {
  getNodeFromSelection,
  isComment,
  isFunctionDefinition,
  isTagElement,
} from "./utilities/tree-sitter-helpers";

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
    const isSameChar = left === right;

    // Search backwards for opening character
    for (let line = cursorPosition.line; line >= 0; line--) {
      const lineText = doc.lineAt(line).text;
      for (
        let char =
          line === cursorPosition.line
            ? cursorPosition.character - 1
            : lineText.length - 1;
        char >= 0;
        char--
      ) {
        if (lineText[char] === left) {
          if (isSameChar) {
            if (nestingLevel === 0) {
              start = new vscode.Position(
                line,
                char + (mode === "inside" ? 1 : 0)
              );
              break;
            }
            nestingLevel = 1 - nestingLevel; // Toggle between 0 and 1
          } else {
            if (nestingLevel === 0) {
              start = new vscode.Position(
                line,
                char + (mode === "inside" ? 1 : 0)
              );
              break;
            }
            nestingLevel--;
          }
        } else if (!isSameChar && lineText[char] === right) {
          nestingLevel++;
        }
      }
      if (start) {
        break;
      }
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
        if (lineText[char] === right) {
          if (isSameChar) {
            if (nestingLevel === 0) {
              end = new vscode.Position(
                line,
                char + (mode === "around" ? 1 : 0)
              );
              break;
            }
            nestingLevel = 1 - nestingLevel; // Toggle between 0 and 1
          } else {
            if (nestingLevel === 0) {
              end = new vscode.Position(
                line,
                char + (mode === "around" ? 1 : 0)
              );
              break;
            }
            nestingLevel--;
          }
        } else if (!isSameChar && lineText[char] === left) {
          nestingLevel++;
        }
      }
      if (end) {
        break;
      }
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
      const isSameChar = left === right;

      // Search backwards for opening character
      for (let line = cursorPosition.line; line >= 0; line--) {
        const lineText = doc.lineAt(line).text;
        for (
          let char =
            line === cursorPosition.line
              ? cursorPosition.character - 1
              : lineText.length - 1;
          char >= 0;
          char--
        ) {
          if (lineText[char] === left) {
            if (isSameChar) {
              if (nestingLevel === 0) {
                start = new vscode.Position(
                  line,
                  char + (mode === "inside" ? 1 : 0)
                );
                break;
              }
              nestingLevel = 1 - nestingLevel; // Toggle between 0 and 1
            } else {
              if (nestingLevel === 0) {
                start = new vscode.Position(
                  line,
                  char + (mode === "inside" ? 1 : 0)
                );
                break;
              }
              nestingLevel--;
            }
          } else if (!isSameChar && lineText[char] === right) {
            nestingLevel++;
          }
        }
        if (start) {
          break;
        }
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
          if (lineText[char] === right) {
            if (isSameChar) {
              if (nestingLevel === 0) {
                end = new vscode.Position(
                  line,
                  char + (mode === "around" ? 1 : 0)
                );
                break;
              }
              nestingLevel = 1 - nestingLevel; // Toggle between 0 and 1
            } else {
              if (nestingLevel === 0) {
                end = new vscode.Position(
                  line,
                  char + (mode === "around" ? 1 : 0)
                );
                break;
              }
              nestingLevel--;
            }
          } else if (!isSameChar && lineText[char] === left) {
            nestingLevel++;
          }
        }
        if (end) {
          break;
        }
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
  keys: "ip",
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

function matchInsideElement(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Range[] {
  let node = getNodeFromSelection(s, doc);
  while (node.parent && !isTagElement(node)) {
    node = node.parent;
  }

  if (!isTagElement(node)) {
    return [];
  }

  node = node.children[1]; // Contents node

  if (!node) {
    return [];
  }

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Range(start.row, start.column, end.row, end.column)];
}

const insideElement: Motion = {
  keys: "ie",
  matcher: matchInsideElement,
};

function matchAroundElement(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Range[] {
  let node = getNodeFromSelection(s, doc);
  while (node.parent && !isTagElement(node)) {
    node = node.parent;
  }

  if (!isTagElement(node)) {
    return [];
  }

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Range(start.row, start.column, end.row, end.column)];
}

const aroundElement: Motion = {
  keys: "ae",
  matcher: matchAroundElement,
};

function matchFunctionDefinition(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Range[] {
  let node = getNodeFromSelection(s, doc);
  while (node.parent && !isFunctionDefinition(node)) {
    node = node.parent;
  }

  if (!isFunctionDefinition(node)) {
    return [];
  }

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Range(start.row, start.column, end.row, end.column)];
}

const aroundFunction: Motion = {
  keys: "af",
  matcher: matchFunctionDefinition,
};

function matchComment(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Range[] {
  let node = getNodeFromSelection(s, doc);
  if (!isComment(node)) {
    return [];
  }

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Range(start.row, start.column, end.row, end.column)];
}

const aroundComment: Motion = {
  keys: "ac",
  matcher: matchComment,
};

function matchIndentationScope(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Range[] {
  const cursorLine = s.active.line;
  const cursorIndentation =
    doc.lineAt(cursorLine).firstNonWhitespaceCharacterIndex;
  let startLine = cursorLine;
  let endLine = cursorLine;

  for (let line = cursorLine; line >= 0; line--) {
    const lineText = doc.lineAt(line).text;
    if (lineText.trim() === "") {
      continue;
    }

    if (
      doc.lineAt(line).firstNonWhitespaceCharacterIndex >= cursorIndentation
    ) {
      startLine = line;
    } else {
      break;
    }
  }

  for (let line = cursorLine + 1; line < doc.lineCount; line++) {
    const lineText = doc.lineAt(line).text;
    if (lineText.trim() === "") {
      continue;
    }

    if (
      doc.lineAt(line).firstNonWhitespaceCharacterIndex >= cursorIndentation
    ) {
      endLine = line;
    } else {
      break;
    }
  }

  return [
    new vscode.Range(startLine, 0, endLine, doc.lineAt(endLine).text.length),
  ];
}

const aroundLinesWithSameIndentation: Motion = {
  keys: "al",
  matcher: matchIndentationScope,
};

export const motions: Motion[] = [
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
  insideElement,

  aroundElement,
  aroundFunction,
  aroundComment,

  aroundLinesWithSameIndentation,
];
