import * as vscode from "vscode";
import {
  getNodesAtCursors,
  isFunctionDefinitionNode,
  isParameterOrArgumentNode,
  isParametersNode,
  isElementNode,
  getNodeFromSelection,
} from "./utilities/tree-sitter-helpers";

export async function selectSiblingNode(direction: "next" | "prev") {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const newSelections = editor.selections
    .map((selection) => {
      let node = getNodeFromSelection(selection, editor.document);

      while (
        node.parent &&
        node.parent.startPosition.column === node.startPosition.column &&
        node.parent.startPosition.row === node.startPosition.row &&
        node.parent.endPosition.column === node.endPosition.column &&
        node.parent.endPosition.row === node.endPosition.row
      ) {
        node = node.parent;
      }

      if (!node) {
        return selection;
      }

      node =
        direction === "next"
          ? node.nextNamedSibling
          : node.previousNamedSibling;

      if (!node) {
        return selection;
      }

      const start = node.startPosition;
      const end = node.endPosition;
      return new vscode.Selection(start.row, start.column, end.row, end.column);
    })
    .filter((selection) => selection) as vscode.Selection[];

  editor.selections = newSelections;

  editor.revealRange(editor.selection);
}

export async function moveSiblingNode(direction: "next" | "previous") {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const newSelections = await Promise.all(
    editor.selections.map(async (selection) => {
      let node = getNodeFromSelection(selection, editor.document);
      while (
        node.parent &&
        node.parent.startPosition.column === node.startPosition.column &&
        node.parent.startPosition.row === node.startPosition.row &&
        node.parent.endPosition.column === node.endPosition.column &&
        node.parent.endPosition.row === node.endPosition.row
      ) {
        node = node.parent;
      }

      if (!node) {
        return selection;
      }

      const sibling =
        direction === "next"
          ? node.nextNamedSibling
          : node.previousNamedSibling;

      if (!sibling) {
        return selection;
      }

      const oldText = editor.document.getText(
        new vscode.Range(
          new vscode.Position(
            node.startPosition.row,
            node.startPosition.column
          ),
          new vscode.Position(node.endPosition.row, node.endPosition.column)
        )
      );
      const newText = editor.document.getText(
        new vscode.Range(
          new vscode.Position(
            sibling.startPosition.row,
            sibling.startPosition.column
          ),
          new vscode.Position(
            sibling.endPosition.row,
            sibling.endPosition.column
          )
        )
      );

      await editor.edit((editBuilder) => {
        editBuilder.replace(
          new vscode.Range(
            new vscode.Position(
              node.startPosition.row,
              node.startPosition.column
            ),
            new vscode.Position(node.endPosition.row, node.endPosition.column)
          ),
          newText
        );
        editBuilder.replace(
          new vscode.Range(
            new vscode.Position(
              sibling.startPosition.row,
              sibling.startPosition.column
            ),
            new vscode.Position(
              sibling.endPosition.row,
              sibling.endPosition.column
            )
          ),
          oldText
        );
      });

      // Calculate the new selection range based on the original selection and the new node positions
      const newStart = new vscode.Position(
        selection.start.line +
          (node.startPosition.line - sibling.startPosition.line),
        selection.start.character +
          (node.startPosition.character - sibling.startPosition.character)
      );
      const newEnd = new vscode.Position(
        selection.end.line + (node.endPosition.line - sibling.endPosition.line),
        selection.end.character +
          (node.endPosition.character - sibling.endPosition.character)
      );
      return new vscode.Selection(newStart, newEnd);
    })
  );

  editor.selections = newSelections.filter(
    (selection) => selection
  ) as vscode.Selection[];
  editor.revealRange(editor.selection);
}
export function selectParentNode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const newSelections = editor.selections
    .map((selection) => {
      let currentNode = getNodeFromSelection(selection, editor.document);
      let node = currentNode;

      while (
        node &&
        node.startPosition.column === currentNode.startPosition.column &&
        node.startPosition.row === currentNode.startPosition.row &&
        node.endPosition.column === currentNode.endPosition.column &&
        node.endPosition.row === currentNode.endPosition.row
      ) {
        node = node.parent;
      }

      if (!node) {
        return selection;
      }

      const start = node.startPosition;
      const end = node.endPosition;
      return new vscode.Selection(start.row, start.column, end.row, end.column);
    })
    .filter((selection) => selection) as vscode.Selection[];

  editor.selections = newSelections;

  editor.revealRange(editor.selection);
}

export function selectFirstChildNode() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  const newSelections = editor.selections
    .map((selection) => {
      let currentNode = getNodeFromSelection(selection, editor.document);
      let node = currentNode;

      while (
        node &&
        node.startPosition.column === currentNode.startPosition.column &&
        node.startPosition.row === currentNode.startPosition.row &&
        node.endPosition.column === currentNode.endPosition.column &&
        node.endPosition.row === currentNode.endPosition.row
      ) {
        node = node.firstNamedChild;
      }

      if (!node) {
        return selection;
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
function selectFirstParameter() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = getNodesAtCursors(editor);

  const newSelections = nodes
    .map((node) => {
      // Trace upwards to find the function definition
      while (node.parent && !isFunctionDefinitionNode(node)) {
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
        isParameterOrArgumentNode(child)
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

function selectElement() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = getNodesAtCursors(editor);
  const newSelections = nodes
    .map((node) => {
      // Trace upwards to find the nearest JSX tag
      while (node.parent && !isElementNode(node)) {
        node = node.parent;
      }

      // If we didn't find a JSX element, return null
      if (!isElementNode(node)) {
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

// Create two selections per cursor: one that selects the name part of the opening tag
// and one that selects the name part of the closing tag:
function selectTagName() {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = getNodesAtCursors(editor);
  const newSelections = nodes
    .flatMap((node) => {
      // Trace upwards to find the nearest JSX element
      while (node.parent && !isElementNode(node)) {
        node = node.parent;
      }

      if (!isElementNode(node)) {
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
