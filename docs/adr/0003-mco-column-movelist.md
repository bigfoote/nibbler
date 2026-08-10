# MCO-style column movelist: rows are fullmove numbers, variations open a pair to the right

The movelist gets a second layout, `config.movelist_layout: "columns"`, alongside the
default `"inline"` flowing text. It renders the game tree the way *Modern Chess
Openings* lays out its tables: one row per fullmove number, a single shared move-number
column at the far left, and a **White/Black column pair** per line. The main line is the
leftmost pair; a variation opens in a new pair **to the right**, vertically aligned at
the row where it branches — so alternatives read like nested code, not like
parenthesized interruptions of the main text.

Key layout decisions:

- **Rows are fullmove numbers.** Every line advances one row per fullmove, so a
  variation's move 12 sits on the same row as the main line's move 12. This is what
  makes the branch point visually obvious and gives the one shared number column.
- **Pair reuse.** A strict pair-per-variation gets unusably wide in analysis trees.
  Instead each line is placed in the *leftmost* pair right of its parent line's pair
  whose rows are free over the line's row span (interval allocation). Unrelated
  variations far apart in the game share a pair; nesting still always moves right.
- **Black-first variations get an "…" placeholder** in their White cell, per standard
  print convention.
- **Rendered as an HTML `<table>`, not CSS grid.** The page CSP (`style-src 'self'`)
  forbids inline `style=` attributes (see the WDL-bar CSP incident, commit 34c1a17),
  and grid placement needs per-cell coordinates. A table needs only classes, and its
  auto-sizing handles ragged column widths for free.
- **`scrollIntoView` replaces manual `offsetTop` scroll math** in column mode: inside a
  table the `<td>` becomes the span's `offsetParent`, breaking the inline-mode
  arithmetic; the browser API also handles horizontal scroll, which column mode needs.

## Considered options

- **Inline with nesting styling (Lichess-like)** — status quo family; variations
  interrupt the main line, long analysis reads poorly.
- **Indented block per variation (true code style)** — variations as indented text
  blocks below the branch point; loses the two-column W/B scannability and the shared
  number column.
- **Strict new pair per variation** — simplest allocation, but width grows linearly
  with variation count even when variations don't overlap in time.
- **Rows + pair reuse (chosen)** — MCO look, bounded width, branch rows aligned.

## Consequences

- Wide trees scroll horizontally (`#movelist` is now `overflow-x: auto`).
- Node ids, highlight classes, and click handling are unchanged, so navigation,
  the blue/yellow highlight, and gray-vs-white current-line colouring work
  identically in both layouts.
- The PGN writer and inline layout still use `get_ordered_nodes()`; the column
  renderer walks the tree itself (it needs lines, not a token stream).
