# Round 2 evidence

BEFORE: `main` `b64cd21` (released v0.1.8), seeded Member A / Member B 0.6/0.4.  
AFTER: this PR head (Litora + Versora remap), same seed.

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

Raw: `alignment.json`. Sidebar stays 220 (Litora nav 208 is a documented deviation). First-use stays left-aligned.

## Checks

| Check | Result |
|---|---|
| `tsc --noEmit` | pass |
| `vitest` | 235 pass |
| `next lint` | pass (existing unused-arg warnings) |
| `next build` | pass |
| `test:scroll-width` | pass, including tape 620 / 630; no overflow at 360/375/414 |
| `test:scroll-width --inject-old-tape` | fails as negative control (exit 2, overflows=27) |
| `test:sticky` | pass |
| `test:sticky --inject-overflow-hidden` | fails as negative control (exit 2) |
| `test:ledger-filter` | 42 actions, 0 dropped |

## Data safety

Opened a v0.1.8 SQLite file (`data/safety-v018.sqlite`) with this build’s `pnpm db:migrate`. No new tables or columns. Overlay update paths untouched.

## Screenshot index

`before/` and `after/` each have `{page}-{1440|375}-{light|dark}.png` for:

login, first-use, overview, entry, holdings, watchlist, instrument-aapl, ledger, returns, account.

Plus AFTER-only: `overview-tips-*`, `entry-dividend-*`, `ledger-delete-*`, and `overview-1440-light-reduced.png`.
