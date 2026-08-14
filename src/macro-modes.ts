import * as vscode from "vscode";
import { changeMode, defaultMode, Mode } from "./extension";
import { playMacro, startMacroRecording } from "./keystroke-log";

/**
 * Count for the playback about to be started.
 *
 * `3Qa` needs the count from the `Q` keypress, but the register arrives in a
 * separate mode and the command chain is reset on the way there, so it is
 * stashed rather than carried.
 */
let pendingPlaybackCount = 1;

export function setPendingPlaybackCount(count: number) {
  pendingPlaybackCount = count;
}

function isValidRegister(key: string) {
  return /^[a-zA-Z0-9]$/.test(key);
}

export const recordMacroMode: Mode = {
  isInsertMode: false,
  name: "record-macro",
  statusItemText: "Record macro",
  color: "cyan",

  handleSubCommandChain: async function (keys: string) {
    const register = keys[0];

    if (!isValidRegister(register)) {
      vscode.window.showWarningMessage(
        `${register} is not a macro register (use a letter or digit).`
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    // Back to normal mode first: recording starts from the next key, and the
    // mode change would otherwise be the first thing recorded.
    await changeMode({ mode: defaultMode });
    startMacroRecording(register);
  },
};

export const playMacroMode: Mode = {
  isInsertMode: false,
  name: "play-macro",
  statusItemText: "Play macro",
  color: "cyan",

  handleSubCommandChain: async function (keys: string) {
    const register = keys[0];

    if (!isValidRegister(register)) {
      vscode.window.showWarningMessage(
        `${register} is not a macro register (use a letter or digit).`
      );
      await changeMode({ mode: defaultMode });
      return;
    }

    await changeMode({ mode: defaultMode });
    await playMacro(register, pendingPlaybackCount);
    pendingPlaybackCount = 1;
  },
};
