import * as vscode from "vscode";
const parseTreeExtension = vscode.extensions.getExtension("pokey.parse-tree");

async function getNodeAtCursor(editor: vscode.TextEditor) {
  // Get the parse-tree API
  if (!parseTreeExtension) {
    throw new Error("Depends on pokey.parse-tree extension");
  }
  const { getTreeForUri } = await parseTreeExtension.activate();

  const document = editor.document;
  const selection = editor.selection;

  const range = new vscode.Range(selection.start, selection.end);

  let node = getTreeForUri(document.uri)?.rootNode.namedDescendantForPosition(
    { row: range.start.line, column: range.start.character },
    { row: range.end.line, column: range.end.character }
  );

  return node;
}

export async function expandSelection() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const node = await getNodeAtCursor(editor);
  if (node) {
    const parentNode = node.parent;
    if (parentNode) {
      const start = parentNode.startPosition;
      const end = parentNode.endPosition;
      editor.selection = new vscode.Selection(
        start.row,
        start.column,
        end.row,
        end.column
      );
    }
  }
}

export async function selectSiblingNode(direction: "next" | "prev") {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let node = await getNodeAtCursor(editor);
  if (!node) {
    return;
  }

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
    direction === "next" ? node.nextNamedSibling : node.previousNamedSibling;

  if (!node) {
    return;
  }

  const start = node.startPosition;
  const end = node.endPosition;
  editor.selection = new vscode.Selection(
    start.row,
    start.column,
    end.row,
    end.column
  );
}

export function activateSmartSelectCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.expandSelection", expandSelection)
  );

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
