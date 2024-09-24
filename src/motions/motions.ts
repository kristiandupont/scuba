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

export type Motion = (
  s: vscode.Selection,
  doc: vscode.TextDocument
) => vscode.Selection[];

export const motions: Record<string, Motion> = {
  w: makeRegexMotion(/\w+\b\s*/g, "forward"),
  b: makeRegexMotion(/\s*\b\w+\b/g, "backward"),
  iw: makeRegexMotion(/\b\w+\b/g, "inside"),

  W: makeRegexMotion(/\S+\s*/g, "forward"),
  B: makeRegexMotion(/\s*\S+/g, "backward"),
  iW: makeRegexMotion(/\S+/g, "inside"),

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
    "inside"
  ),
  aq: makeNarrowestPairMotion(
    [
      ['"', '"'],
      ["'", "'"],
      ["`", "`"],
    ],
    "around"
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
    "inside"
  ),
  ab: makeNarrowestPairMotion(
    [
      ["(", ")"],
      ["[", "]"],
      ["{", "}"],
      ["<", ">"],
    ],
    "around"
  ),
  e: makeElementMotion("forward"),
  ie: makeElementMotion("inside"),
  ae: makeElementMotion("around"),
  ii: makeIndentationScopeMotion("inside"),
  ai: makeIndentationScopeMotion("around"),

  ip: makePropertyOrParameterMotion("inside"),
  ap: makePropertyOrParameterMotion("around"),

  af: functionMotion,
  ac: commentMotion,
};
