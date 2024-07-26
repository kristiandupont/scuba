import * as vscode from "vscode";

const parseTreeExtension = vscode.extensions.getExtension("pokey.parse-tree");

let blockTypeSub: vscode.Disposable | null = null;
let modeIndicator: vscode.StatusBarItem | null = null;
let currentMode: string | null = null;

let activeCommandChain: string[] = [];

function resetCommandChain() {
  activeCommandChain = [];
}

const rootMap = [
  {
    keys: "i",
    command: "scuba.changeMode",
    args: {
      mode: "insert",
    },
  },
  {
    keys: "a",
    command: async function () {
      await vscode.commands.executeCommand("cursorRight");
      await vscode.commands.executeCommand("scuba.changeMode", {
        mode: "insert",
      });
    },
  },
  {
    keys: "u",
    command: "undo",
  },
  {
    keys: "y",
    command: "editor.action.clipboardCopyAction",
  },
  {
    keys: "d",
    command: "editor.action.clipboardCutAction",
  },
  {
    keys: "p",
    command: "editor.action.clipboardPasteAction",
  },
  {
    keys: " m",
    command: "textmarker.toggleHighlight",
  },
  {
    keys: "za",
    command: "editor.toggleFold",
  },
  {
    keys: "gd",
    command: "editor.action.goToDeclaration",
  },
  {
    keys: "gr",
    command: "references-view.findReferences",
  },
  {
    keys: "gh",
    command: "editor.action.showHover",
  },
];

function updateModeIndicator() {
  if (!modeIndicator) {
    return;
  }

  const icon = currentMode === "insert" ? "edit" : "lock";

  const commandChain =
    activeCommandChain.length > 0 ? activeCommandChain.join("") : "$(keyboard)";

  modeIndicator.text = `$(${icon}) ${currentMode} ${commandChain}`;
}

async function normalType(
  textEditor: vscode.TextEditor,
  edit: vscode.TextEditorEdit,
  ...args: any[]
) {
  const key = args[0].text;
  activeCommandChain.push(key);
  updateModeIndicator();
  const command = activeCommandChain.join("");
  const root = rootMap.find((root) => root.keys === command);
  if (root) {
    if (typeof root.command === "function") {
      await root.command();
    } else {
      await vscode.commands.executeCommand(root.command, root.args);
    }
    resetCommandChain();
  }
}

async function changeMode({ mode }: { mode: string }) {
  currentMode = mode;
  resetCommandChain();

  vscode.commands.executeCommand("setContext", "scuba.current", currentMode);
  updateModeIndicator();

  if (currentMode === "normal" && !blockTypeSub) {
    blockTypeSub = vscode.commands.registerTextEditorCommand(
      "type",
      normalType
    );
  } else if (currentMode !== "normal" && !!blockTypeSub) {
    blockTypeSub.dispose();
    blockTypeSub = null;
  }

  // Set cursor style:
  if (!vscode.window.activeTextEditor) {
    return;
  }
  vscode.window.activeTextEditor.options.cursorStyle =
    currentMode === "insert"
      ? vscode.TextEditorCursorStyle.Line
      : vscode.TextEditorCursorStyle.Block;
}

function initDefaultMode() {
  const defaultMode = "normal";
  changeMode({ mode: defaultMode });
}

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.changeMode", changeMode)
  );
  context.subscriptions.push(
    vscode.commands.registerCommand("scuba.reset", resetCommandChain)
  );

  modeIndicator = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    0
  );

  activateAdditionalCommands(context);

  modeIndicator.command = "scuba.change";
  modeIndicator.show();
  initDefaultMode();
}

function activateAdditionalCommands(context: vscode.ExtensionContext) {
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

async function getNodeAtCursor(editor: vscode.TextEditor) {
  // Get the parse-tree API
  if (!parseTreeExtension) {
    throw new Error("Depends on pokey.parse-tree extension");
  }
  const { getTreeForUri } = await parseTreeExtension.activate();

  const document = editor.document;
  const selection = editor.selection;

  // Create a range from the start and end of the selection
  const range = new vscode.Range(selection.start, selection.end);

  const location: vscode.Location = new vscode.Location(document.uri, range);

  console.log("Location:", location.range.start, location.range.end);

  // Get the parse tree for the current document
  // let node = getNodeAtLocation(location);
  let node = getTreeForUri(document.uri)?.rootNode.namedDescendantForPosition(
    { row: location.range.start.line, column: location.range.start.character },
    { row: location.range.end.line, column: location.range.end.character }
  );

  console.log(`node [${node.type}]: ${node.text}`);

  return node;
}

async function expandSelection() {
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

async function selectSiblingNode(direction: "next" | "prev") {
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
    console.log("no sibling for ", node.type, ": ", node.text);
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
  console.log("sibling for ", node.type, ": ", node.text);

  const start = node.startPosition;
  const end = node.endPosition;
  editor.selection = new vscode.Selection(
    start.row,
    start.column,
    end.row,
    end.column
  );

  console.log("New range: ", start, end);
}

export function deactivate() {}
