# Scuba cheat sheet

Assumes you know vim. This covers what Scuba does **differently** and what it
adds **beyond** vim — not the parts that already work the way you expect.

---

## Start here: the things that will trip you up

| | Scuba |
| --- | --- |
| **`hjkl`** | **Not bound.** Movement is arrow keys, everywhere. |
| **Registers** | **None.** There is one clipboard — the system one. Linewise-ness is tracked beside it, not in it. |
| **`u` / `U`** | Undo / **redo** (not `<c-r>`). In selection modes they are lowercase/uppercase instead. |
| **`:`** | Go to line number, then `Enter`. Not a command line. |
| **`@`** | Add selection to next find match. **Macros play with `Q`.** |
| **`f` / `t`** | Two different things depending on how you use them — see below. As operators (`df`, `ct`) they match vim. Pressed on their own they don't. |
| **`n` / `N`** | Not bound. Use `*` / `#`, or `@` to multi-select matches. |
| **`gg` / `G`** | Not bound. Use `:<line>`. |
| **`>>` / `<<`** | `Tab` / `Shift-Tab`. |
| **`c` `d` `y`** | Real modes, not pending operators. The status bar shows which one you are in, and `Esc` backs out. |

Counts work on simple commands (`3x`), on `.` and on `Q`. They are **not**
wired up for mode-switch keys (`3v`) or most tree-sitter motions.

---

## Modes

| Key | Mode | Notes |
| --- | --- | --- |
| `i` `I` `a` `A` `o` `O` | Insert | As vim. |
| `v` | Select | Charwise. |
| `V` | Line select | `↑`/`↓` grow by whole lines from where you started. |
| `S` | **Smart select** | Structural, tree-sitter driven. See below. |
| `c` `d` `y` | Change / Delete / Yank | Then a motion. |
| `r` | Replace char | One character. |
| `f` `t` | Find char | Forward, whole document. |
| `Space Space` | Sneak | Then two characters, jumps forward. |
| `Space b` | Sneak backwards | Then two characters. |
| `:` | Go to line | Digits, then `Enter`. |
| `q` | Record macro | Then a register letter. |
| `Q` | Play macro | Then a register letter. |

`Esc` always returns to normal mode.

---

## `f` and `t` — two separate things

They run through different code depending on whether an operator is waiting.

**After an operator** — `df(`, `ct)`, `y` `t` `,` — behaves like vim:

| | Selects | Scope |
| --- | --- | --- |
| `f<char>` | up to **and including** the match | current line |
| `t<char>` | up to but **not** including it | current line |
| `F<char>` `T<char>` | same, searching backward | current line |

**On its own** — `f<char>` in normal mode, just moving the cursor:

| | Lands | Scope |
| --- | --- | --- |
| `f<char>` | one **past** the match (vim leaves you on it) | whole document, forward |
| `t<char>` | **on** the match (vim leaves you before it) | whole document, forward |

So a bare `f` lands where you'd expect a bare `t` to, and neither stops at the
end of the line. There is no standalone `F`/`T`. Backward `F`/`T` as operator
motions are currently swapped — see the bottom.

---

## Smart select — `S`

The main thing Scuba has that vim doesn't. Selections follow the syntax tree,
so they survive whatever the formatter did to the whitespace.

| Key | Does |
| --- | --- |
| `←` | Widen to parent node |
| `→` | Back to previous (narrower) selection |
| `↑` `↓` | Previous / next sibling node |
| `Alt-↑` `Alt-↓` | **Move** the node among its siblings |
| `*` | Spread to all siblings **of the same type** |
| `g*` | Spread to **all** siblings |
| `Ctrl-←` `Ctrl-→` | VSCode's own smart-select expand / shrink |
| `p` | First parameter of the enclosing function |
| `e` | Enclosing HTML/JSX element |
| `t` | Tag name, and drop into insert mode |

`*` is the one worth internalising: put the cursor in a list, press `S` then
`*`, and you get one cursor per sibling — then keep navigating structurally in
all of them at once. It doesn't matter which entries the formatter split
across several lines.

---

## Motions beyond vim

Used after `c`, `d`, `y`, or in select mode. `i` = inside, `a` = around.

### Tree-sitter

| Motion | Selects |
| --- | --- |
| `n` `in` `an` | Smallest named node at the cursor |
| `p` `ip` `ap` | Property, parameter or argument |
| `e` `ie` `ae` | HTML/JSX element |
| `if` `af` | Enclosing function |
| `ic` `ac` | Enclosing comment |

### Text shape

| Motion | Selects |
| --- | --- |
| `ii` `ai` | Indentation scope — the block at the current indent level |
| `iq` `aq` | Nearest quotes, whichever of `"` `'` `` ` `` is closest |
| `ib` `ab` | Nearest bracket, whichever of `()` `[]` `{}` `<>` is closest |
| `æ` `Æ` `iæ` | Word **part** — stops at camelCase and snake_case boundaries |

`iq` and `ib` save you from picking the right delimiter; `ii` is the one to
reach for in Python-ish code or deeply nested JSX.

### Also available

`w` `b` `iw` `aw` `W` `B` `iW` `aW`, `$` `§` (line end / line start),
`"` `'` `` ` `` and their `i`/`a` forms, each bracket pair explicitly
(`i(` `a(` `i[` `a[` `i{` `a{` `i<` `a<`), and `f` `F` `t` `T` as
operator motions.

> `if`/`af`, `ic`/`ac` and `in`/`an` currently behave identically — there is no
> inside/around distinction implemented for those three.

---

## Surround

Delimiters:

| Key | Wraps with |
| --- | --- |
| `"` `'` | `"…"` `'…'` |
| `(` `[` `<` | `(…)` `[…]` `<…>` |
| `{` | `{ … }` — **with** inner spaces |
| `}` | `{…}` — without |
| `b` | `` `…` `` backticks |
| `d` | `<div>…</div>` |
| `f` | `<>…</>` React fragment |

Operations:

| Sequence | Does |
| --- | --- |
| `ys<motion><key>` | Surround the motion — e.g. `ysiw"` |
| `cs<old><new>` | Change surrounding — e.g. `cs"'` |
| `ds<key>` | Delete surrounding — e.g. `ds"` |
| `s` *(in any selection mode)* | Enter surround mode, then `a<key>` add / `r<key>` replace / `d` delete |

The `s` form is Scuba's own: select structurally with `S`, then `s` `a` `"` to
quote it. vim-surround uses `S` in visual mode for this.

> Surrounding a whole line is `ysss<key>`, not vim's `yss<key>` — see the note
> at the bottom.

---

## Repeat and macros

| Key | Does |
| --- | --- |
| `.` | Repeat the last change. `3.` repeats it three times. |
| `q<reg>` | Start recording into a register (letter or digit) |
| `q` | Stop recording |
| `Q<reg>` | Play back. `3Qa` plays three times. |

While recording, the status bar shows `⏺ <reg>` next to the mode.

Differences worth knowing:

- **Insert-mode typing is captured as the text it produced**, not as keystrokes.
  Accepting a completion is recorded as the completed word, so `.` reproduces
  something vim's dot cannot.
- **Moving the cursor mid-insert makes the change unrepeatable.** Arrow keys in
  insert mode go straight to VSCode, so Scuba can't see them; rather than
  replay text that was never typed in that order, it declines. A recording in
  progress stops and says so.
- **Running a macro does not update the dot register.** `.` after `Qa` repeats
  whatever you changed before the macro.
- Undo is not grouped: one `.` may take several `u` presses to undo.

---

## Selection history

| Key | Does |
| --- | --- |
| `Backspace` | Back to the previous selection |
| `Shift-Backspace` | Forward again |

Kept per document. Pushed whenever you enter a selection mode or widen
structurally, so it pairs naturally with `S` `←` `←` `←` then `Backspace` to
walk back out.

---

## Clipboard behaviour

There are no registers — Scuba uses the system clipboard and remembers
separately whether the last yank was linewise.

- `Y` / `D` with nothing selected act on the **whole line** (linewise).
- `p` / `P` paste a linewise yank onto its **own line**, below / above.
- Text copied from **anywhere else** — a terminal, a browser — pastes charwise,
  even if it ends in a newline. That's deliberate: the flag only applies to
  what Scuba itself put there.
- Yanking the last line of a file still pastes as a line, despite having no
  trailing newline to copy.

---

## Leader (`Space`)

| Keys | Does |
| --- | --- |
| `Space Space` | Sneak forward |
| `Space b` | Sneak backward |
| `Space a` | Change all occurrences |
| `Space m` | Toggle highlight *(Text Marker extension)* |
| `Space c` | Clear all highlights *(Text Marker extension)* |

---

## Odds and ends

| Key | Does |
| --- | --- |
| `§` / `$` | Start / end of line |
| `æ` / `ø` | Word part right / left |
| `+` / `-` | Increment / decrement the number under the cursor |
| `,` | Add cursor below |
| `;` | Collapse selections, keeping multiple cursors |
| `%` | Jump to matching bracket |
| `C` | Clear the line, insert at the indent |
| `x` / `s` | Delete character / delete character and insert |
| `J` | Join lines |
| `Alt-↑` `Alt-↓` | Move line up / down |
| `Ctrl-↑` `Ctrl-↓` | Scroll one line |
| `gd` `gr` `gh` `gp` `gc` `ge` | Definition, references, hover, param hints, comment, next problem |
| `gn` | Split right and go to definition |
| `zz` / `za` | Centre / toggle fold |
| `*` / `#` | Next / previous occurrence of the word *(Find Word At Cursor extension)* |

---

## External extensions

A few bindings call commands Scuba doesn't provide. They do nothing if the
extension isn't installed:

- **Text Marker** — `Space m`, `Space c`
- **Find Word At Cursor** — `*`, `#`

---

## Known rough edges

- **`ysss<key>`** surrounds a line, where vim uses `yss<key>`. The `y`→`s`
  transition consumes one `s` and the line branch expects two more.
- **`ap`** is meant to include the trailing comma but only ever picks up a
  leading one.
- **Counts** are ignored by mode-switch keys and most tree-sitter motions.
- **`if`/`af`, `ic`/`ac`, `in`/`an`** have no inside/around distinction.
- **Backward `F`/`T` are swapped.** From `foo(bar)| baz`, `dF(` takes `bar)`
  where vim takes `(bar)`, and `dT(` takes `(bar)` where vim takes `bar)`.
  `makeSearchMotion` shifts by one for "inclusive" in both directions, but
  going backward that pushes the selection past the character it should
  include. Forward `f`/`t` are correct.
