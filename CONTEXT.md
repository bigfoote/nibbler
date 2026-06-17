# Nibbler

A real-time analysis GUI for the Leela Chess Zero (Lc0) engine. It runs an engine
in the background and continuously displays its opinions about the current position.

## Language

### Engine opinion

**Candidate move**:
A legal move the engine has evaluated (or could) from the current position. The infobox
lists candidate moves, best first.

**WDL**:
The engine's win / draw / loss probabilities for a position or move, reported by Lc0 as
three per-mille integers. Only some engines emit it (Lc0 always; Stockfish only with
`UCI_ShowWDL`).
_Avoid_: win-draw-loss triple, outcome odds

**EV** (expected value):
A single-number summary of a position/move from one side's perspective, equal to
`win + draw/2` (a 0–100% "expected winning percentage"). When WDL is present, EV is
derived from it; otherwise it comes from centipawns. Shown in blue in the infobox.
_Avoid_: winrate, expected score, Q (Q is the engine's internal −1..+1 form of the same idea)

### Display

**Infoline**:
One row in the infobox representing a single candidate move — its EV, principal
variation, and per-move stats.
_Avoid_: info row, move line

**Winrate graph** / **graph mode**:
The graph beneath the board plotting the game over time. Has two modes: the
**evaluation line** (EV across the game) and the **W/D/L view** (stacked area of the
position's WDL). Selected by `config.graph_type`.

**WDL bar**:
A horizontal stacked bar shown on an infoline that renders a candidate move's WDL as
three proportional segments in fixed **White / Draw / Black** order (like the Lichess
opening explorer), for visual comparison across candidate moves. Always White POV so
the segment order never switches. Augments (does not replace) the blue EV number.

**Confidence disc**:
A small pie next to each candidate's EV number, filled clockwise to that move's raw share
of the search (`N / total visits`). Signals how much the engine actually explored a move —
a nearly-empty disc means a noisy eval not to be trusted. Kept off the WDL bar deliberately:
the bar's colours *are* its data, so confidence rides a separate, colourless glyph rather
than dimming the bar (see ADR 0002).

**EV tick**:
A thin vertical mark on a WDL bar at `win + draw/2` (White POV) — i.e. the expected-score
point, the same quantity the blue EV number expresses, drawn where it falls within the bands.

## Flagged ambiguities

**POV (point of view)**: WDL and EV can be shown from White's perspective, Black's, or
the side-to-move's. The winrate graph and the **WDL bar** are fixed to **White POV**
(resolved). The infobox EV (blue number) follows `config.ev_pov` and the infobox WDL
text follows `config.wdl_pov` (both default to side-to-move). Consequence: when the bar
sits beside a mover-relative EV number, the two use different reference frames — the bar
is colour-absolute, the number is "good for the mover."
