# Round 2 evidence

BEFORE: `main` `b64cd21` (released v0.1.8), seeded Member A / Member B 0.6/0.4.  
AFTER: this PR head, same seed. PNGs palette-quantized.

## Alignment (AFTER, Chromium dsf=1)

| Surface | Spec | Measured | Delta |
|---|---|---|---|
| Desktop 1440 `h1` / first card left | x=244 | 244 | 0 |
| Desktop 1440 card inner text | x=265 | 265 | 0 |
| Desktop 1440 `.page` width | 1172 | 1172 | 0 |
| Desktop 1440 first-use title left | x=244 (not 390) | 244 | 0 |
| Mobile 375 page / card left | 16 | 16 | 0 |
| Mobile 375 content width | 343 | 343 | 0 |
| Mobile 375 bottom bar | 56 | 56 | 0 |

Raw: `alignment.json`. First-use BEFORE filled the 1172 well; AFTER is left-aligned (`.page-form-wide` `margin-inline: 0`), not centered at x=390.

## Checks

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `vitest` | 221 pass |
| `next lint` | pass (existing unused-arg warnings) |
| `next build` | pass |
| `test:scroll-width` | pass, including tape 620 / 630 |
| `test:sticky` | pass |
| `test:sticky --inject-overflow-hidden` | fails as negative control (`sticky-fail-proof.txt`) |
| `test:ledger-filter` | 42 actions, 0 dropped |

## Data safety

Opened a v0.1.8 SQLite file (`data/safety-v018.sqlite`, created by the v0.1.8 migrator + current insert-only seed) with this build’s `pnpm db:migrate`.

| | Before | After migrate |
|---|---|---|
| Tables | 18, same names | unchanged |
| Row total | 25 | 25 |
| `users` / `members` / `books` / `cash_flows` / `trades` | 1 / 2 / 1 / 3 / 4 | same |

See `safety-before.json` and `safety-after.json`. No new tables or columns.

## Screenshot index

`before/` and `after/` each have `{page}-{1440\|375}-{light\|dark}.png` for:

login, first-use, overview, entry, holdings, watchlist, instrument-aapl, ledger, returns, account.

Plus AFTER-only: `overview-tips-*`, `entry-dividend-*`, `ledger-delete-*`, and `overview-1440-light-reduced.png` on both sides.
