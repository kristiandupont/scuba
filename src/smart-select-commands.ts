import * as vscode from "vscode";
const parseTreeExtension = vscode.extensions.getExtension("pokey.parse-tree");

async function getNodesAtCursors(editor: vscode.TextEditor) {
  // Get the parse-tree API
  if (!parseTreeExtension) {
    throw new Error("Depends on pokey.parse-tree extension");
  }
  const { getTreeForUri } = await parseTreeExtension.activate();

  const document = editor.document;
  const selections = editor.selections || [];

  const nodes = selections.map((selection) => {
    const range = new vscode.Range(selection.start, selection.end);

    return getTreeForUri(document.uri)?.rootNode.namedDescendantForPosition(
      { row: range.start.line, column: range.start.character },
      { row: range.end.line, column: range.end.character }
    );
  });

  return nodes;
}

export async function selectSiblingNode(direction: "next" | "prev") {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = await getNodesAtCursors(editor);

  const newSelections = nodes
    .map((node) => {
      while (
        (direction === "next" && !node.nextNamedSibling) ||
        (direction === "prev" && !node.previousNamedSibling)
      ) {
        node = node.parent;
        if (!node) {
          return;
        }
      }

      node =
        direction === "next"
          ? node.nextNamedSibling
          : node.previousNamedSibling;

      if (!node) {
        return;
      }

      const start = node.startPosition;
      const end = node.endPosition;
      return new vscode.Selection(start.row, start.column, end.row, end.column);
    })
    .filter((selection) => selection) as vscode.Selection[];

  editor.selections = newSelections;
}

export function activateSmartSelectCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.selectNextSibling", () =>
      selectSiblingNode("next")
    )
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.selectPrevSibling", () =>
      selectSiblingNode("prev")
    )
  );
}
