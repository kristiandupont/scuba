import * as vscode from "vscode";

export function incrementNumberUnderCursor(
  editor: vscode.TextEditor,
  addition = 1
) {
  editor.edit((editBuilder) => {
    for (const selection of editor.selections) {
      let text: string;
      let range: vscode.Range;

      if (selection.isEmpty) {
        // Handle case when there's no selection
        const line = editor.document.lineAt(selection.start.line);
        text = line.text;
        range = line.range;

        const numbers = [...text.matchAll(/\d+/g)];
        if (numbers.length === 0) {
          continue;
        }

        let targetNumber;
        if (numbers.length === 1) {
          // Rule 1: If there's only one number, use it
          targetNumber = numbers[0];
        } else {
          // Rule 2 & 3: Multiple numbers
          const numbersAfterCursor = numbers.filter(
            (match) => match.index! >= selection.start.character
          );
          targetNumber =
            numbersAfterCursor.length > 0
              ? numbersAfterCursor[0]
              : numbers[numbers.length - 1];
        }

        const start = new vscode.Position(
          selection.start.line,
          targetNumber.index!
        );
        const end = new vscode.Position(
          selection.start.line,
          targetNumber.index! + targetNumber[0].length
        );
        range = new vscode.Range(start, end);
        text = targetNumber[0];
      } else {
        // Original behavior for when there's a selection
        text = editor.document.getText(selection);
        range = selection;
      }

      const num = parseInt(text);
      if (!isNaN(num)) {
        const incrementedNum = (num + addition).toString();
        editBuilder.replace(range, incrementedNum);
      }
    }
  });
}
