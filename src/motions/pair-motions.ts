import * as vscode from "vscode";

type Pair = [left: string, right: string];

export function makePairedMotion(
  [left, right]: Pair,
  mode: "inside" | "around" | "forward" | "backward"
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
        let char =
          line === cursorPosition.line
            ? Math.max(0, cursorPosition.character - 1)
            : 0;
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
      let anchor = s.anchor;
      let active = s.active;

      if (mode === "forward") {
        active = end;
      } else if (mode === "backward") {
        active = start;
      } else {
        anchor = start;
        active = end;
      }
      return [new vscode.Selection(anchor, active)];
    }

    return [];
  };
}

export function makeNarrowestPairMotion(
  pairs: Pair[],
  mode: "inside" | "around"
) {
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
            line === cursorPosition.line
              ? Math.max(0, cursorPosition.character - 1)
              : 0;
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
