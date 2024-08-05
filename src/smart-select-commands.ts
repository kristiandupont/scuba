import * as vscode from "vscode";
import {
  getNodesAtCursors,
  isFunctionDefinition,
  isParameterNode,
  isParametersNode,
  isTagElement,
} from "./utilities/tree-sitter-helpers";

export async function selectSiblingNode(direction: "next" | "prev") {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    return;
  }

  let nodes = await getNodesAtCursors(editor);

  const newSelections = nodes
    .map((node) => {
      // while (
      //   (direction === "next" && !node.nextNamedSibling) ||
      //   (direction === "prev" && !node.previousNamedSibling)
      // ) {
      //   node = node.parent;
      //   if (!node) {
      //     return;
      //   }
      // }

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
