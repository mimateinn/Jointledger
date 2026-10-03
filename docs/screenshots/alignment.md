# Alignment check (seeded demo, 2026-10-03)

Measured in Chromium at deviceScaleFactor 1 against `jl-design-v3` ui-spec §0.2.

| Surface | Spec | Measured | Delta |
|---|---|---|---|
| Desktop 1440 `h1` / `.page-title` left | x=244 | x=244 | 0 |
| Desktop 1440 first `.card` left | x=244 | x=244 | 0 |
| Desktop 1440 card inner text | x=265 | x=265 | 0 |
| Desktop 1440 `.page` content width | 1172 | 1172 | 0 |
| Mobile 375 page / card left | 16 | 16 | 0 |
| Mobile 375 content width | 343 | 343 | 0 |
| Mobile 375 bottom bar height | 56 | 56 | 0 |

Re-measured after the 0.6/0.4 re-seed. Same edges.

Raw `alignment.json` is the Playwright `getBoundingClientRect` dump from `/overview`.

Reduced-motion: `globals.css` no longer sets `.skeleton { animation }`. `motion.css` now forces `animation: none` on `.skeleton` and `transform: none` on `.mobile-bar a:active` / `.theme-toggle:active`. Account **減少動態** still sets `html.is-reduced`. See `overview-1440-light-reduced.png`.
