import * as vscode from "vscode";
const parseTreeExtension = vscode.extensions.getExtension("pokey.parse-tree");

let getTreeForUri: any;

export function getNodeFromSelection(
  selection: vscode.Selection,
  document: vscode.TextDocument
) {
  if (!getTreeForUri) {
    // Get the parse-tree API
    if (!parseTreeExtension) {
      throw new Error("Depends on pokey.parse-tree extension");
    }
    getTreeForUri = parseTreeExtension.exports.getTreeForUri;
  }

  const range = new vscode.Range(selection.start, selection.end);

  return getTreeForUri(document.uri)?.rootNode.namedDescendantForPosition(
    { row: range.start.line, column: range.start.character },
    { row: range.end.line, column: range.end.character }
  );
}

export async function getNodesAtCursors(editor: vscode.TextEditor) {
  const selections = editor.selections || [];
  return selections.map((selection) =>
    getNodeFromSelection(selection, editor.document)
  );
}

export function isFunctionDefinitionNode(node: any): boolean {
  return [
    "function_definition",
    "function_declaration",
    "function_expression",
    "method_definition",
    "arrow_function",
  ].includes(node.type);
}

export function isParametersNode(node: any): boolean {
  return ["parameters", "formal_parameters"].includes(node.type);
}

export function isParameterOrArgumentNode(node: any): boolean {
  if (!node.parent) {
    return false;
  }

  const parentType = node.parent.type;
  return [
    "parameters",
    "formal_parameters",
    "arguments",
    "argument_list",
    "tuple",
  ].includes(parentType);
}

export function isElementNode(node: any): boolean {
  return [
    // JSX types
    "jsx_element",
    "jsx_self_closing_element",
    // HTML types
    "element",
    "self_closing_tag",
  ].includes(node.type);
}

export function isCommentNode(node: any): boolean {
  return ["comment", "line_comment"].includes(node.type);
}

export function isPropertyLikeNode(node: any): boolean {
  if (!node.parent) {
    return false;
  }

  const parentType = node.parent.type;
  return [
    "dictionary",
    "object",
    "object_pattern",
    "class_body",
    "interface_body",
    "type_literal",
    "array",
    "array_pattern",
  ].includes(parentType);
}
