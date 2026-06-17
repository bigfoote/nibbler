# Confidence shown on a separate disc, not by fading the WDL bar

Low-visit candidate moves have noisy evals, so we signal confidence (how much the engine
searched a move) visually. We do this with a small **pie/disc** next to the EV number,
filled to the move's raw visit share — **not** by dimming the move's WDL bar.

We first implemented it as opacity on the bar (and EV number). That's wrong: the WDL bar
**encodes its data in colour** (white/grey/black = win/draw/loss), so reducing opacity
distorts the very channel that carries meaning — a faded white "win" segment drifts toward
grey and reads as more "draw". Confidence therefore rides a separate, colourless glyph,
leaving the bar at full fidelity. A pie also conveys *magnitude* (a 96%-visits move is a
full disc; a 0.8% move is nearly empty), which opacity cannot.

## Consequences

- The bar's colours are always trustworthy; the disc is the one confidence cue.
- Among the long tail (all <~1% of visits) discs are all near-empty and not distinguishable
  from each other — acceptable, since those evals are all equally untrustworthy.
- Raw share (not share-relative-to-best) means the top move's disc also shows how
  *concentrated* the search was: a not-full top disc signals the engine itself was unsure.
