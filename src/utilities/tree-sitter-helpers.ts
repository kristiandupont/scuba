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

export function isFunctionDefinition(node: any): boolean {
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

export function isParameterNode(node: any): boolean {
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

export function isTagElement(node: any): boolean {
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

export function isComment(node: any): boolean {
  return ["comment", "line_comment"].includes(node.type);
}
