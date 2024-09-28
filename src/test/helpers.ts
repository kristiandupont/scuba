import * as vscode from "vscode";

export async function setupTextEditorWithCursors(
  input: string
): Promise<vscode.TextEditor> {
  // Create a new untitled document
  const document = await vscode.workspace.openTextDocument({
    content: "",
    language: "plaintext",
  });

  // Show the document in an editor
  const editor = await vscode.window.showTextDocument(document);

  // Parse the input string and set up the text and selections
  const { text, selections } = parseInputString(input);

  // Replace the entire document content
  await editor.edit((editBuilder) => {
    const fullRange = new vscode.Range(
      document.positionAt(0),
      document.positionAt(document.getText().length)
    );
    editBuilder.replace(fullRange, text);
  });

  // Set the selections
  editor.selections = selections;

  return editor;
}

function parseInputString(input: string): {
  text: string;
  selections: vscode.Selection[];
} {
  let text = "";
  const selections: vscode.Selection[] = [];
  let offset = 0;
  let selectionStart = 0;
  let line = 0;
  let column = 0;

  for (let i = 0; i < input.length; i++) {
    if (input[i] === "[") {
      selectionStart = offset;
    } else if (input[i] === "]") {
      const selectionEnd = offset;
      const startPos = positionFromOffset(input, selectionStart);
      const endPos = positionFromOffset(input, selectionEnd);
      selections.push(new vscode.Selection(startPos, endPos));
    } else {
      text += input[i];
      if (input[i] === "\n") {
        line++;
        column = 0;
      } else {
        column++;
      }
      offset++;
    }
  }

  return { text, selections };
}

function positionFromOffset(input: string, offset: number): vscode.Position {
  let line = 0;
  let column = 0;
  for (let i = 0; i < offset; i++) {
    if (input[i] === "\n") {
      line++;
      column = 0;
    } else {
      column++;
    }
  }
  return new vscode.Position(line, column);
}

export function applySelection(
  editor: vscode.TextEditor,
  selections: readonly vscode.Selection[]
): string {
  const document = editor.document;
  const text = document.getText();
  const result: string[] = [];
  let lastIndex = 0;

  // Sort selections by start position
  const sortedSelections = [...selections].sort(
    (a, b) => document.offsetAt(a.start) - document.offsetAt(b.start)
  );

  for (const selection of sortedSelections) {
    const startOffset = document.offsetAt(selection.start);
    const endOffset = document.offsetAt(selection.end);

    // Add text before the selection
    result.push(text.substring(lastIndex, startOffset));

    // Add the selection with brackets
    result.push("[");
    result.push(text.substring(startOffset, endOffset));
    result.push("]");

    lastIndex = endOffset;
  }

  // Add any remaining text after the last selection
  result.push(text.substring(lastIndex));

  return result.join("");
}
