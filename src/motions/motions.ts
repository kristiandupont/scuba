import * as vscode from "vscode";
import {
  getNodeFromSelection,
  isComment,
  isFunctionDefinition,
  isTagElement,
} from "../utilities/tree-sitter-helpers";

export type Motion = (
  s: vscode.Selection,
  doc: vscode.TextDocument
) => vscode.Selection[];

const makeRegexMotion =
  (regex: RegExp, mode: "inside" | "around" | "forward" | "backward") =>
  (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    const line = doc.lineAt(cursorPosition.line).text;

    const matches = [...line.matchAll(regex)];
    const matchTouchingCursor = matches.find(
      (match) =>
        match.index! <= cursorPosition.character &&
        match.index! + match[0].length >= cursorPosition.character
    );

    if (!matchTouchingCursor) {
      return [];
    }

    let anchor = s.anchor;
    let active = s.active;

    if (mode === "forward") {
      active = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index! + matchTouchingCursor[0].length
      );
    } else if (mode === "backward") {
      active = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index!
      );
    } else if (mode === "inside") {
      anchor = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index!
      );
      active = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index! + matchTouchingCursor[0].length
      );
    } else {
      // Mode is 'around'
      anchor = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index!
      );
      active = new vscode.Position(
        cursorPosition.line,
        matchTouchingCursor.index! + matchTouchingCursor[0].length
      );
    }

    return [new vscode.Selection(anchor, active)];
  };

type Pair = [left: string, right: string];

function makePairedMotion([left, right]: Pair, mode: "inside" | "around") {
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
      return [new vscode.Selection(start, end)];
    }

    return [];
  };
}

function makeNarrowestPairMotion(pairs: Pair[], mode: "inside" | "around") {
  return (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    let narrowestRange: vscode.Selection | null = null;

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
        const range = new vscode.Selection(start, end);
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

const makeElementMotion =
  (mode: "inside" | "around") =>
  (s: vscode.Selection, doc: vscode.TextDocument): vscode.Selection[] => {
    let node = getNodeFromSelection(s, doc);
    while (node.parent && !isTagElement(node)) {
      node = node.parent;
    }

    if (!isTagElement(node)) {
      return [];
    }

    if (mode === "inside") {
      node = node.children[1]; // Contents node
    }

    if (!node) {
      return [];
    }

    const start = node.startPosition;
    const end = node.endPosition;
    return [new vscode.Selection(start.row, start.column, end.row, end.column)];
  };

function functionMotion(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Selection[] {
  let node = getNodeFromSelection(s, doc);
  while (node.parent && !isFunctionDefinition(node)) {
    node = node.parent;
  }

  if (!isFunctionDefinition(node)) {
    return [];
  }

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Selection(start.row, start.column, end.row, end.column)];
}

function commentMotion(
  s: vscode.Selection,
  doc: vscode.TextDocument
): vscode.Selection[] {
  let node = getNodeFromSelection(s, doc);
  if (!isComment(node)) {
    return [];
  }

  const start = node.startPosition;
  const end = node.endPosition;
  return [new vscode.Selection(start.row, start.column, end.row, end.column)];
}

const makeIndentationScopeMotion =
  (mode: "inside" | "around") =>
  (s: vscode.Selection, doc: vscode.TextDocument): vscode.Selection[] => {
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

    if (mode === "inside") {
      return [
        new vscode.Selection(
          startLine,
          cursorIndentation,
          endLine,
          doc.lineAt(endLine).text.length
        ),
      ];
    } else {
      // Mode is 'around'.
      // If there is a line below, go to the start of that.

      const isEOF = endLine === doc.lineCount - 1;
      const endChar = isEOF ? doc.lineAt(endLine).text.length : 0;
      endLine = isEOF ? endLine : endLine + 1;
      return [new vscode.Selection(startLine, 0, endLine, endChar)];
    }
  };

export const motions: Record<string, Motion> = {
  w: makeRegexMotion(/\b\w+\b/g, "forward"),
  b: makeRegexMotion(/\b\w+\b/g, "backward"),
  iw: makeRegexMotion(/\b\w+\b/g, "inside"),

  W: makeRegexMotion(/\S+/g, "forward"),
  B: makeRegexMotion(/\S+/g, "backward"),
  iW: makeRegexMotion(/\S+/g, "inside"),

  'i"': makePairedMotion(['"', '"'], "inside"),
  'a"': makePairedMotion(['"', '"'], "around"),
  "i'": makePairedMotion(["'", "'"], "inside"),
  "a'": makePairedMotion(["'", "'"], "around"),
  ib: makePairedMotion(["`", "`"], "inside"),
  ab: makePairedMotion(["`", "`"], "around"),
  iq: makeNarrowestPairMotion(
    [
      ['"', '"'],
      ["'", "'"],
      ["`", "`"],
    ],
    "inside"
  ),
  aq: makeNarrowestPairMotion(
    [
      ['"', '"'],
      ["'", "'"],
      ["`", "`"],
    ],
    "around"
  ),
  "i(": makePairedMotion(["(", ")"], "inside"),
  "a(": makePairedMotion(["(", ")"], "around"),
  "i[": makePairedMotion(["[", "]"], "inside"),
  "a[": makePairedMotion(["[", "]"], "around"),
  "i{": makePairedMotion(["{", "}"], "inside"),
  "a{": makePairedMotion(["{", "}"], "around"),
  "i<": makePairedMotion(["<", ">"], "inside"),
  "a<": makePairedMotion(["<", ">"], "around"),
  ip: makeNarrowestPairMotion(
    [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
      ["<", ">"],
    ],
    "inside"
  ),
  ap: makeNarrowestPairMotion(
    [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
      ["<", ">"],
    ],
    "around"
  ),
  ie: makeElementMotion("inside"),
  ae: makeElementMotion("around"),
  ii: makeIndentationScopeMotion("inside"),
  ai: makeIndentationScopeMotion("around"),

  af: functionMotion,
  ac: commentMotion,
};
