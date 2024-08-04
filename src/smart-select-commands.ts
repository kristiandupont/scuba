import * as vscode from "vscode";
const parseTreeExtension = vscode.extensions.getExtension("pokey.parse-tree");

async function getNodesAtCursors(editor: vscode.TextEditor) {
  // Get the parse-tree API
  if (!parseTreeExtension) {
    const allExtensions = vscode.extensions.all;
    const extensionIds = allExtensions.map((ext) => ext.id);
    console.log("All extensions:", extensionIds);
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
  return [
    "function_definition",
    "function_declaration",
    "method_definition",
    "arrow_function",
  ].includes(node.type);
}

function isParametersNode(node: any): boolean {
  return ["parameters", "formal_parameters"].includes(node.type);
}

function isParameterNode(node: any): boolean {
  return [
    "parameter",
    "typed_parameter",
    "required_parameter",
    "typed_required_parameter",
    "default_parameter",
    "typed_default_parameter",
    "optional_parameter",
    "typed_optional_parameter",
  ].includes(node.type);
}

async function selectElement() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = await getNodesAtCursors(editor);
  const newSelections = nodes
    .map((node) => {
      // Trace upwards to find the nearest JSX tag
      while (node.parent && !isTagElement(node)) {
        node = node.parent;
      }

      // If we didn't find a JSX element, return null
      if (!isTagElement(node)) {
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

function isTagElement(node: any): boolean {
  // Check if the node is a JSX or HTML element
  // This should be adapted to the specific Tree-sitter grammar being used
  return [
    // JSX types
    "jsx_element",
    "jsx_self_closing_element",
    // HTML types
    "element",
    "self_closing_tag",
  ].includes(node.type);
}

// Create two selections per cursor: one that selects the name part of the opening tag
// and one that selects the name part of the closing tag:
async function selectTagName() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = await getNodesAtCursors(editor);
  const newSelections = nodes
    .flatMap((node) => {
      // Trace upwards to find the nearest JSX tag
      while (node.parent && !isTagElement(node)) {
        node = node.parent;
      }

      if (!isTagElement(node)) {
        return [];
      }

      if (node.type === "jsx_self_closing_element") {
        const namePart = node.children[1];
        if (!namePart) {
          return [];
        }

        const start = namePart.startPosition;
        const end = namePart.endPosition;
        return [
          new vscode.Selection(start.row, start.column, end.row, end.column),
        ];
      }

      const openingTag = node.children[0];
      const closingTag = node.children[node.children.length - 1];

      return [openingTag, closingTag].map((node: any) => {
        if (!node) {
          return null;
        }
        const namePart = node.children[1];
        if (!namePart) {
          return null;
        }

        const start = namePart.startPosition;
        const end = namePart.endPosition;
        return new vscode.Selection(
          start.row,
          start.column,
          end.row,
          end.column
        );
      });
    })
    .filter((selection) => selection) as vscode.Selection[];

  editor.selections = newSelections;
  editor.revealRange(editor.selection);
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
    vscode.commands.registerCommand("scuba.selectElement", selectElement),
    vscode.commands.registerCommand("scuba.selectTagName", selectTagName)
  );
}
