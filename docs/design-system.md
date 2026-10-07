# Jointledger design system

Date 2026-10-07. This file is the product UI source of truth. Tokens live in CSS variables; pages must not invent a second scale.

Canonical files:

| Layer | File |
|---|---|
| Colour, spacing, type, radius, layout, z-index, icon stroke | `src/app/tokens.css` |
| Shared components (page, card, button, input, table, toast, dialog, nav) | `src/app/components.css` |
| Motion tokens, keyframes, `prefers-reduced-motion` / `.is-reduced` | `src/app/motion.css` |
| App chrome leftovers (tape, kline, tables) | `src/app/globals.css` — use tokens only; do not reintroduce raw 10/14/18px |
| Icons | `src/components/icons.tsx` + `public/icons/icons-paths.json` |

If a value is not in the tables below, do not use it.

---

## Spacing (4px base)

| Token | Value | Use |
|---|---|---|
| `--sp-1` | 4px | Icon–text gap, chip icon gap |
| `--sp-2` | 8px | Control groups, label → input |
| `--sp-3` | 12px | Table cell vertical, small card stacks, mobile `--gap` |
| `--sp-4` | 16px | Desktop `--gap`, mobile page / card pad |
| `--sp-5` | 20px | Desktop `--card-pad` only |
| `--sp-6` | 24px | Desktop `--page-pad`, dialog pad, tab gap |
| `--sp-8` | 32px | Empty-state pad, large section gap |
| `--sp-12` | 48px | Page bottom, login wordmark gap |

Allowed padding / margin / gap: those values or `0`. No 10 / 14 / 18px.

Vertical rhythm: page head ≥44px → 8px → content; cards 16px apart; metric label → 4px → display → 4px → sub.

---

## Type

Font: `--font-sans` = Inter → Noto Sans TC → system. Weights 400 / 500 / 600 only. Figures use `.num` / `.tabular` (`tabular-nums` + `"tnum" 1, "lnum" 1`).

| Role | Class | Desktop | Mobile ≤800 | Use |
|---|---|---|---|---|
| Display | `.display` | 32 / 36 / 500 / −0.02em | 28 / 32 | NAV, cash, last price |
| Page title | `.page-title` | 24 / 32 / 600 / −0.01em | 22 / 30 | One `<h1>` per page |
| Title | `.title` | 20 / 28 / 600 | 20 / 28 | Dialog / first-use section |
| Card title | `.card-title` | 16 / 24 / 600 | 16 / 24 | Card `<h2>` |
| Body | default / `.body` | 14 / 22 / 400 | 14 / 22 (inputs 16) | Copy, table cells |
| Meta | `.meta` | 12 / 18 / 500 / +0.01em | 12 / 18 | Labels, timestamps |
| Compact display | `.display-compact` | 20 / 28 / 500 | 20 / 28 | Mobile paired metrics |
| Caption | `.caption` | 11 / 16 / 500 | 11 / 16 | Bottom bar, chart axis |

Currency: `<span class="unit">US$</span>` + display figure. Example numbers are labelled 示意 in design mocks only.

---

## Radius and shadow

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 2px | Skeleton, progress |
| `--radius-sm` / `--chip-radius` | 4px | Button, input, chip |
| `--radius-md` / `--card-radius` | 8px | Card, table, chart, banner |
| `--radius-lg` | 12px | Dialog, toast, sheet |
| `--radius-pill` | 999px | Avatar, status dot |

Cards use `--shadow-0` (border only). Popovers `--shadow-2`. Dialogs `--shadow-3`.

---

## Colour (light 暖紙 / dark 墨紙)

One accent: `--ink`. Green / red only for P&L or field error. Success toasts use ink icon + text, not a green wash. P&L always carries `+` / `-` (ASCII minus). Disabled: opacity .45 + `not-allowed`.

### Light `[data-theme="light"]`

| Token | Hex | Notes |
|---|---|---|
| `--bg` | `#f4f3ef` | Page |
| `--surface` | `#ffffff` | Card, dialog, input fill |
| `--border` | `#e3e1da` | Decorative divider only |
| `--border-strong` | `#85887f` | Input / secondary / seg edge (≥3:1) |
| `--text` | `#1b1c19` | Body |
| `--muted` | `#6b6e66` | Label, meta |
| `--ink` | `#2f5d56` | Primary, link, focus |
| `--ink-hover` / `--ink-press` | `#264c46` / `#1f3f3a` | Primary hover / active |
| `--on-ink` | `#ffffff` | Text on primary |
| `--up` | `#166c40` | Gain (≥4.5:1 on bg / surface) |
| `--down` | `#c0392b` | Loss / error |
| `--up-bg` / `--down-bg` | `#e8f2ed` / `#f9ebea` | Chip wash |
| `--delay-bg` / `--delay-text` | `#f3ebd8` / `#7a6238` | Delay chip (do not put `--muted` on delay-bg) |
| `--surface-hover` / `--surface-selected` | `#f1f1f1` / `#eef2f1` | Row hover / selected |
| `--focus-ring` | `#2f5d56` | `= ink` |
| `--scrim` | `rgba(27,28,25,.48)` | Modal mask |
| `--skeleton-base` / `--skeleton-shine` | `#e9e7e1` / `rgba(255,255,255,.7)` | Skeleton |

### Dark `[data-theme="dark"]`

| Token | Hex | Notes |
|---|---|---|
| `--bg` | `#121411` | Page |
| `--surface` | `#1c1e1b` | Card, dialog, input fill |
| `--border` | `#2c2f2a` | Decorative divider only |
| `--border-strong` | `#6f766b` | Control edge (≥3:1) |
| `--text` | `#edeee8` | Body |
| `--muted` | `#9aa196` | Label, meta |
| `--ink` | `#7a9a8a` | Primary, link, focus |
| `--ink-hover` / `--ink-press` | `#8fae9e` / `#a0bdae` | Primary hover / active |
| `--on-ink` | `#121411` | Text on primary |
| `--up` | `#42a375` | Gain |
| `--down` | `#e6746c` | Loss / error |
| `--up-bg` / `--down-bg` | `#1f2922` / `#2c2521` | Chip wash |
| `--delay-bg` / `--delay-text` | `#2a261c` / `#c4a574` | Delay chip |
| `--surface-hover` / `--surface-selected` | `#292a27` / `#272d28` | Row hover / selected |
| `--focus-ring` | `#7a9a8a` | `= ink` |
| `--scrim` | `rgba(0,0,0,.62)` | Modal mask |
| `--skeleton-base` / `--skeleton-shine` | `#292c27` / `rgba(237,238,232,.07)` | Skeleton |

Do not use pure `#000` text, or `#fff` text on dark surfaces except `--on-ink` on light primary.

### Contrast (WCAG relative luminance)

Body text threshold 4.5:1; non-text UI 3:1.

**Light**

| Pair | Ratio | Gate | Result |
|---|---:|---:|---|
| text / bg | 15.42 | 4.5 | PASS |
| text / surface | 17.12 | 4.5 | PASS |
| muted / bg | 4.67 | 4.5 | PASS |
| muted / surface | 5.19 | 4.5 | PASS |
| muted / hover row | 4.59 | 4.5 | PASS |
| muted / selected | 4.60 | 4.5 | PASS |
| text / selected | 15.17 | 4.5 | PASS |
| ink / surface | 7.44 | 4.5 | PASS |
| ink / bg | 6.70 | 4.5 | PASS |
| on-ink / ink | 7.44 | 4.5 | PASS |
| on-ink / ink-hover | 9.53 | 4.5 | PASS |
| on-ink / ink-press | 11.47 | 4.5 | PASS |
| up / surface | 5.34 | 4.5 | PASS |
| up / bg | 4.81 | 4.5 | PASS |
| up / hover | 4.73 | 4.5 | PASS |
| up / up-bg | 4.67 | 4.5 | PASS |
| down / surface | 5.44 | 4.5 | PASS |
| down / bg | 4.90 | 4.5 | PASS |
| down / hover | 4.81 | 4.5 | PASS |
| down / down-bg | 4.69 | 4.5 | PASS |
| delay-text / delay-bg | 4.87 | 4.5 | PASS |
| border-strong / bg | 3.25 | 3.0 | PASS |
| border-strong / surface | 3.60 | 3.0 | PASS |
| focus-ring / bg | 6.70 | 3.0 | PASS |

**Dark**

| Pair | Ratio | Gate | Result |
|---|---:|---:|---|
| text / bg | 15.87 | 4.5 | PASS |
| text / surface | 14.39 | 4.5 | PASS |
| muted / bg | 6.98 | 4.5 | PASS |
| muted / surface | 6.33 | 4.5 | PASS |
| muted / hover row | 5.44 | 4.5 | PASS |
| muted / selected | 5.30 | 4.5 | PASS |
| text / selected | 12.06 | 4.5 | PASS |
| ink / surface | 5.45 | 4.5 | PASS |
| ink / bg | 6.01 | 4.5 | PASS |
| on-ink / ink | 6.01 | 4.5 | PASS |
| on-ink / ink-hover | 7.69 | 4.5 | PASS |
| on-ink / ink-press | 9.16 | 4.5 | PASS |
| up / surface | 5.38 | 4.5 | PASS |
| up / bg | 5.93 | 4.5 | PASS |
| up / hover | 4.62 | 4.5 | PASS |
| up / up-bg | 4.81 | 4.5 | PASS |
| down / surface | 5.66 | 4.5 | PASS |
| down / bg | 6.24 | 4.5 | PASS |
| down / hover | 4.87 | 4.5 | PASS |
| down / down-bg | 5.08 | 4.5 | PASS |
| delay-text / delay-bg | 6.45 | 4.5 | PASS |
| border-strong / bg | 3.95 | 3.0 | PASS |
| border-strong / surface | 3.58 | 3.0 | PASS |
| focus-ring / bg | 6.01 | 3.0 | PASS |

`--border` is decorative (light 1.31 / dark 1.24) and must not stroke inputs.

---

## Icons

Hand-drawn SVG only. No emoji. No third-party packs (Lucide, Feather, Heroicons, Material).

| Rule | Value |
|---|---|
| ViewBox | `0 0 24 24` (empty-state illustrations `0 0 64 64`) |
| Stroke | 1.5 in the 24 grid (illustrations 2). `round` caps/joins. `fill: none`. `stroke: currentColor` |
| Screen stroke | Always 1.5px: `.icon-16 { --icon-sw: 2.25 }` · `.icon-20 { --icon-sw: 1.8 }` · `.icon-24 { --icon-sw: 1.5 }` |
| Sizes | 16 table / chip · 20 default (nav, button, toast) · 24 emphasis · 64 illustration |
| Colour | `currentColor`. Status: `.icon-up` / `.icon-down`. Info/success `--ink`. Warning `--delay-text`. Error `--down` |
| React | `<Icon name="add" size={20} />` from `icons-paths.json`. Keep `IconOverview`…`IconAccount` named exports |
| A11y | Decorative: `aria-hidden` + `focusable="false"`. Icon-only button: `aria-label` |

New icons: add a 24-grid path to `public/icons/icons-paths.json` (and the matching SVG under `public/icons/`), then consume through `Icon`. Do not inline a one-off SVG in a page.

---

## Motion

| Token | Value |
|---|---|
| `--dur-instant` | 80ms |
| `--dur-fast` | 120ms |
| `--dur-base` | 180ms |
| `--dur-slow` | 240ms |
| `--dur-page` | 260ms (hard cap 280) |
| `--dur-number` | 320ms (count tween only) |
| `--ease-standard` | `cubic-bezier(.2,0,0,1)` |
| `--ease-exit` | `cubic-bezier(.4,0,1,1)` |
| `--ease-emphasized` | `cubic-bezier(.16,1,.3,1)` |
| `--ease-in-out` | `cubic-bezier(.65,0,.35,1)` |
| `--ease-pop` | `cubic-bezier(.34,1.35,.64,1)` (≤8% overshoot) |

Animate `transform` / `opacity` only (plus colour on hover, and SVG `stroke-dashoffset` for a check). No `transition: all`. No width / height / top / left / margin animation.

`prefers-reduced-motion: reduce` and `<html class="is-reduced">` (Account → 減少動態, `localStorage jl-reduced`) zero `--mv-*` / `--press-scale` / `--hover-lift`, collapse durations to 80ms opacity, and stop tape / skeleton / spinner loops. New animation classes must be listed in both reduce blocks and covered by `src/app/motion-reduced.test.ts`.

---

## Layout alignment

**Desktop 1440:** sidebar 220. Content starts at x=244. `.page` width 1172. Card / `h1` left edge x=244. Card inner text x=265 (`244 + 1px border + --card-pad 20`). Card right x=1416. Numeric column right x=1395.

**Mobile 375:** page pad 16, content 343 (x 16–359), bottom bar 56 + safe-area. No horizontal scroll at 360 / 375 / 414.

**First-use** uses the same left edge (`.page-form-wide` is 880px, `margin-inline: 0`). It is a two-card chooser, not a marketing hero — it must not sit at x=390.

**Holdings K-line** is desktop-only (hidden ≤960px). Mobile opens `/instrument/[code]`. `.sticky-kline` is `position: static` ≤960px so a tall chart cannot stick over the page.

**Ticker:** desktop pins the first quote. ≤800px the lead is hidden and every symbol lives in the scrolling track so a price cannot clip mid-number; the pin keeps FX only. Viewport min-width 96px so 601–630px cannot collapse the tape.

Hit target ≥44×44 (`--hit-min`). Focus: `2px solid var(--focus-ring)` offset 2.

---

## Product copy

Traditional Chinese (Hong Kong). Strings stay grouped per component (`const COPY = { … }`) so later en/ja extraction is mechanical. No i18n framework.

Product UI must not show emails, phone numbers, or personal names. Demo seed uses Member A / Member B. Broker disclaimer stays: 「記帳唔係下單。唔會連接任何券商。」
