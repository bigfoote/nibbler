# WDL bar is fixed White POV; the EV beside it stays mover-relative

The per-move **WDL bar** in the infobox renders win/draw/loss in fixed
**White / Draw / Black** order (always White POV), like the Lichess opening
explorer, so the segment order never switches as the side-to-move alternates and
bars can be scanned and compared across moves and positions. The blue **EV** number
beside it is left **mover-relative** (it follows `config.ev_pov`, default
side-to-move), unchanged from prior behavior.

This is deliberately inconsistent: a strong move for Black shows a high EV% next to a
bar dominated by the Black segment. We accept the split because the two answer
different questions — the bar is colour-absolute ("who is winning"), the number is
mover-relative ("how good for the side to move") — and forcing them to agree would
either override a user's existing `ev_pov` setting or make the bar order flip
per-move (the confusion we set out to avoid). A user who wants them aligned can set
`ev_pov: "w"`.

## Considered options

- **Bar follows side-to-move (or `ev_pov`)** — coheres with the adjacent number, but
  the White/Black ends swap every half-move, defeating cross-line comparison.
- **Force the EV number to White POV when the bar is shown** — perfect agreement, but
  silently overrides `ev_pov` and changes long-standing infobox behavior.
- **Fixed White POV bar + mover-relative number** (chosen) — keeps the bar scannable
  and leaves existing EV behavior untouched.
