# Mobile document width

Overflow is measured from element bounding rects (right edge > viewport + 1), excluding `.tape-track` and horizontal scrollers. `documentElement.scrollWidth` is reported but is not the pass/fail signal.

Proof that the check catches a tape regression: `--inject-old-tape` (`flex-shrink:0` on lead/pin) fails with `tape-pin@477` (see `scroll-width-fail-proof.txt`). Current CSS passes (`scroll-width-pass-proof.txt`).
375 spec: page margin 16 / content 343 / bottom bar 56.

| Page | 360 | 375 | 414 | 375 margin | 375 content | 375 bar |
|---|---:|---:|---:|---:|---:|---:|
| login | 360 | 375 | 414 | 16 | 343 | 56 |
| overview | 360 | 375 | 414 | 16 | 343 | 56 |
| entry | 360 | 375 | 414 | 16 | 343 | 56 |
| holdings | 360 | 375 | 414 | 16 | 343 | 56 |
| watchlist | 360 | 375 | 414 | 16 | 343 | 56 |
| instrument | 360 | 375 | 414 | 16 | 343 | 56 |
| ledger | 360 | 375 | 414 | 16 | 343 | 56 |
| returns | 360 | 375 | 414 | 16 | 343 | 56 |
| account | 360 | 375 | 414 | 16 | 343 | 56 |

