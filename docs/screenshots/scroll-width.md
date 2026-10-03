# Mobile document width

Overflow is measured from element bounding rects (right edge > viewport + 1), excluding marked `.table-scroll` / `.tape-track` / `.chip-scroll`. A plain `overflow-x: auto` wrapper (for example a 600px box with a 900px child) is not excluded. `documentElement.scrollWidth` must also be <= the viewport.

375 spec: page margin 16 / content 343 / bottom bar 56.

Proof that the check catches a tape regression: `--inject-old-tape` (`flex-shrink:0` on lead/pin) fails with `tape-pin@477` (see `scroll-width-fail-proof.txt`). Current CSS passes (`scroll-width-pass-proof.txt`).

`scripts/measure-scroll-width.mjs` writes the generated table to `scroll-width-table.md` and does not overwrite this proof section.
