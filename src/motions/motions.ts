import * as vscode from "vscode";
import { makeElementMotion } from "./makeElementMotion";
import { makeExtremityMotion } from "./makeExtremityMotion";
import { makeIndentationScopeMotion } from "./makeIndentationScopeMotion";
import { makePropertyOrParameterMotion } from "./makePropertyOrParameterMotion";
import { makeRegexMotion } from "./makeRegexMotion";
import { makeWordPartMotion } from "./makeWordPartMotion";
import { makeNarrowestPairMotion, makePairedMotion } from "./pair-motions";
import { commentMotion } from "./commentMotion";
import { functionMotion } from "./functionMotion";
import { makeNodeMotion } from "./nodeMotion";
import { makeSearchMotion } from "./makeSearchMotion";

export type Motion = (
  s: vscode.Selection,
  doc: vscode.TextDocument,
) => vscode.Selection[];

export const motions: Record<string, Motion> = {
  w: makeRegexMotion(/(\w+|[^\w\s]+)\s*/g, "forward"),
  b: makeRegexMotion(/\s*(\w+|[^\w\s]+)/g, "backward"),
  iw: makeRegexMotion(/\b\w+\b/g, "inside"),
  aw: makeRegexMotion(/\b\w+\b/g, "around"),

  W: makeRegexMotion(/\S+\s*/g, "forward"),
  B: makeRegexMotion(/\s*\S+/g, "backward"),
  iW: makeRegexMotion(/\S+/g, "inside"),
  aW: makeRegexMotion(/\S+/g, "around"),

  æ: makeWordPartMotion("forward"),
  Æ: makeWordPartMotion("backward"),
  iæ: makeWordPartMotion("inside"),

  $: makeExtremityMotion("end"),
  "§": makeExtremityMotion("start"),

  '"': makePairedMotion(['"', '"'], "forward"),
  'i"': makePairedMotion(['"', '"'], "inside"),
  'a"': makePairedMotion(['"', '"'], "around"),
  "'": makePairedMotion(["'", "'"], "forward"),
  "i'": makePairedMotion(["'", "'"], "inside"),
  "a'": makePairedMotion(["'", "'"], "around"),
  t: makePairedMotion(["`", "`"], "forward"),
  it: makePairedMotion(["`", "`"], "inside"),
  at: makePairedMotion(["`", "`"], "around"),
  iq: makeNarrowestPairMotion(
    [
      ['"', '"'],
      ["'", "'"],
      ["`", "`"],
    ],
    "inside",
  ),
  aq: makeNarrowestPairMotion(
    [
      ['"', '"'],
      ["'", "'"],
      ["`", "`"],
    ],
    "around",
  ),
  "(": makePairedMotion(["(", ")"], "backward"),
  ")": makePairedMotion(["(", ")"], "forward"),
  "i(": makePairedMotion(["(", ")"], "inside"),
  "a(": makePairedMotion(["(", ")"], "around"),
  "[": makePairedMotion(["[", "]"], "backward"),
  "]": makePairedMotion(["[", "]"], "forward"),
  "i[": makePairedMotion(["[", "]"], "inside"),
  "a[": makePairedMotion(["[", "]"], "around"),
  "{": makePairedMotion(["{", "}"], "backward"),
  "}": makePairedMotion(["{", "}"], "forward"),
  "i{": makePairedMotion(["{", "}"], "inside"),
  "a{": makePairedMotion(["{", "}"], "around"),
  "<": makePairedMotion(["<", ">"], "backward"),
  ">": makePairedMotion(["<", ">"], "forward"),
  "i<": makePairedMotion(["<", ">"], "inside"),
  "a<": makePairedMotion(["<", ">"], "around"),
  ib: makeNarrowestPairMotion(
    [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
      ["<", ">"],
    ],
    "inside",
  ),
  ab: makeNarrowestPairMotion(
    [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
      ["<", ">"],
    ],
    "around",
  ),
  e: makeElementMotion("forward"),
  ie: makeElementMotion("inside"),
  ae: makeElementMotion("around"),
  ii: makeIndentationScopeMotion("inside"),
  ai: makeIndentationScopeMotion("around"),

  p: makePropertyOrParameterMotion("forward"),
  ip: makePropertyOrParameterMotion("inside"),
  ap: makePropertyOrParameterMotion("around"),

  if: functionMotion,
  af: functionMotion,
  ic: commentMotion,
  ac: commentMotion,

  n: makeNodeMotion("forward"),
  in: makeNodeMotion("inside"),
  an: makeNodeMotion("around"),
};

/** Run a motion over every selection in the editor. */
export function applyMotion(
  motion: Motion,
  editor: vscode.TextEditor,
): vscode.Selection[] {
  return editor.selections
    .map((selection) => motion(selection, editor.document))
    .flat();
}

/**
 * Look up the motion for a key sequence.
 *
 * Returns "partial" when the keys could still grow into a motion, so callers
 * know to wait for more input rather than report an unknown sequence.
 */
export function findMotion(keys: string): Motion | "partial" | undefined {
  // Search motions aren't in the registry because they depend on a second
  // character that isn't known until it is typed.
  if (["f", "F", "t", "T"].includes(keys[0])) {
    if (keys.length === 1) {
      return "partial";
    }

    return makeSearchMotion(
      keys[1],
      ["f", "F"].includes(keys[0]) ? "inclusive" : "exclusive",
      ["f", "t"].includes(keys[0]) ? "forward" : "backward",
    );
  }

  const motion = motions[keys];
  if (motion) {
    return motion;
  }

  const partialMatch = Object.keys(motions).some((registered) =>
    registered.startsWith(keys),
  );
  return partialMatch ? "partial" : undefined;
}
