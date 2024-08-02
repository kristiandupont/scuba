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

  editor.revealRange(editor.selection);
}

// Select the first parameter in the function definition that the cursor is in:
async function selectFirstParameter() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = await getNodesAtCursors(editor);

  const newSelections = nodes
    .map((node) => {
      // Trace upwards to find the function definition
      while (node.parent && !isFunctionDefinition(node)) {
        node = node.parent;
      }

      // Now node is the function definition, trace downwards to find the first parameter
      const functionNode = node;
      const parametersNode = functionNode.children.find((child: any) =>
        isParametersNode(child)
      );

      if (!parametersNode) {
        // If no parameters node, select the function node itself
        const start = functionNode.startPosition;
        const end = functionNode.endPosition;
        return new vscode.Selection(
          start.row,
          start.column,
          end.row,
          end.column
        );
      }

      const firstParameterNode = parametersNode.children.find((child: any) =>
        isParameterNode(child)
      );

      if (!firstParameterNode) {
        // If no parameters, select the empty parentheses
        const start = parametersNode.startPosition;
        const end = parametersNode.endPosition;
        return new vscode.Selection(
          start.row,
          start.column,
          end.row,
          end.column
        );
      }

      // Select the first parameter
      const start = firstParameterNode.startPosition;
      const end = firstParameterNode.endPosition;
      return new vscode.Selection(start.row, start.column, end.row, end.column);
    })
    .filter((selection) => selection) as vscode.Selection[];

  editor.selections = newSelections;

  editor.revealRange(editor.selection);
}

function isFunctionDefinition(node: any): boolean {
  // Check if the node is a function definition
  // This should be adapted to the specific Tree-sitter grammar being used
  return [
    "function_definition",
    "function_declaration",
    "method_definition",
  ].includes(node.type);
}

function isParametersNode(node: any): boolean {
  // Check if the node is a parameters node
  // This should be adapted to the specific Tree-sitter grammar being used
  return ["parameters", "formal_parameters"].includes(node.type);
}

function isParameterNode(node: any): boolean {
  // Check if the node is a parameter node
  // This should be adapted to the specific Tree-sitter grammar being used
  return [
    "parameter",
    "typed_parameter",
    "required_parameter",
    "optional_parameter",
  ].includes(node.type);
}

async function selectJSXTag() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = await getNodesAtCursors(editor);
  const newSelections = nodes
    .map((node) => {
      // Trace upwards to find the nearest JSX tag
      while (node.parent && !isJSXElement(node)) {
        node = node.parent;
      }

      // If we didn't find a JSX element, return null
      if (!isJSXElement(node)) {
        return null;
      }

      // Select the entire JSX element
      const start = node.startPosition;
      const end = node.endPosition;
      return new vscode.Selection(start.row, start.column, end.row, end.column);
    })
    .filter((selection) => selection) as vscode.Selection[];

  editor.selections = newSelections;
  editor.revealRange(editor.selection);
}

function isJSXElement(node: any): boolean {
  // Check if the node is a JSX element
  // This should be adapted to the specific Tree-sitter grammar being used
  return ["jsx_element", "jsx_self_closing_element"].includes(node.type);
}

export function activateSmartSelectCommands(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.selectNextSibling", () =>
      selectSiblingNode("next")
    ),
    vscode.commands.registerCommand("scuba.selectPrevSibling", () =>
      selectSiblingNode("prev")
    ),
    vscode.commands.registerCommand(
      "scuba.selectFirstParameter",
      selectFirstParameter
    ),
    vscode.commands.registerCommand("scuba.selectJSXTag", selectJSXTag)
  );
}
