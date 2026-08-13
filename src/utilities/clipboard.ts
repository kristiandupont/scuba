import * as vscode from "vscode";

type Yank = { text: string; linewise: boolean };

const storageKey = "scuba.lastYank";

let lastYank: Yank | null = null;
let storage: vscode.Memento | null = null;

export function activateClipboard(context: vscode.ExtensionContext) {
  storage = context.globalState;
  lastYank = context.globalState.get<Yank>(storageKey) ?? null;
}

/**
 * Line endings and the trailing newline are the parts most likely to be
 * rewritten as the clipboard crosses an app boundary (clipboard managers,
 * remote desktop bridges), so neither takes part in the comparison. The
 * linewise flag is what records that a trailing newline belongs -- it doesn't
 * need to survive the round trip.
 */
function canonical(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\n$/, "");
}

/**
 * Whether the clipboard holds a whole-line yank.
 *
 * The flag lives here rather than in the clipboard itself: annotating the text
 * would leak Scuba's bookkeeping into every other app pasted into. Anything we
 * didn't put there is treated as charwise, which is what vim does with a
 * clipboard it doesn't recognize.
 */
export function isLinewise(clipboardText: string): boolean {
  return (
    lastYank !== null &&
    lastYank.linewise &&
    canonical(lastYank.text) === canonical(clipboardText)
  );
}

async function remember(text: string, linewise: boolean) {
  lastYank = { text, linewise };
  // Persisted so an extension host reload doesn't drop the flag while the OS
  // clipboard survives it.
  await storage?.update(storageKey, lastYank);
}

/** Put text on the clipboard, recording whether it is a whole-line yank. */
export async function writeClipboard(text: string, linewise: boolean) {
  // Normalized on write so that a linewise yank of the last line of a file --
  // which has no trailing newline to copy -- still pastes as a line.
  const body = linewise ? canonical(text) + "\n" : text;
  await vscode.env.clipboard.writeText(body);
  await remember(body, linewise);
}

/**
 * Run one of VSCode's own clipboard commands, then record the shape of what it
 * left behind. Used where VSCode's semantics are worth keeping -- its
 * whole-line copy when nothing is selected, its undo grouping for cut -- but we
 * still need to know whether the result was linewise.
 */
export async function runClipboardCommand(command: string, linewise: boolean) {
  await vscode.commands.executeCommand(command);
  await remember(await vscode.env.clipboard.readText(), linewise);
}
