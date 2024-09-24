import * as vscode from "vscode";

export const makeWordPartMotion = (mode: "forward" | "backward" | "inside") => {
  return (s: vscode.Selection, doc: vscode.TextDocument) => {
    const cursorPosition = s.active;
    const line = doc.lineAt(cursorPosition.line).text;
    let start = cursorPosition.character;
    let end = cursorPosition.character;

    // Helper function to detect boundaries between camelCase, snake_case, and non-letter characters
    const isBoundary = (current: string, next: string) => {
      return (
        // camelCase boundary: lowercase followed by uppercase
        (/[a-z]/.test(current) && /[A-Z]/.test(next)) ||
        // snake_case boundary: alphanumeric followed by underscore or vice versa
        (/\w/.test(current) && next === "_") ||
        (current === "_" && /\w/.test(next)) ||
        // Non-letter character boundary
        (!/[a-zA-Z]/.test(current) && /[a-zA-Z]/.test(next)) ||
        (/[a-zA-Z]/.test(current) && !/[a-zA-Z]/.test(next))
      );
    };

    // Forward motion
    if (mode === "forward") {
      while (end < line.length - 1) {
        if (isBoundary(line[end], line[end + 1])) {
          break;
        }
        end++;
      }
      end++; // Move past the boundary
    }

    // Backward motion
    if (mode === "backward") {
      while (start > 0) {
        if (isBoundary(line[start - 1], line[start])) {
          break;
        }
        start--;
      }
    }

    // Inside motion (select the current word part)
    if (mode === "inside") {
      while (start > 0 && !isBoundary(line[start - 1], line[start])) {
        start--;
      }
      while (end < line.length - 1 && !isBoundary(line[end], line[end + 1])) {
        end++;
      }
      end++; // Include the last character in the selection
    }

    const anchor = new vscode.Position(cursorPosition.line, start);
    const active = new vscode.Position(cursorPosition.line, end);
    return [new vscode.Selection(anchor, active)];
  };
};
