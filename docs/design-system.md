# Jointledger design system

Date 2026-10-07. Visual rules are remapped from the owner's two apps: **Litora** (desktop library + reader, `mimateinn/Litora` @ main, files from the 2026-10-07 export) and **Versora** (file translator, `mimateinn/Versora` @ main). Tokens live in CSS variables; pages must not invent a second scale.

Canonical Jointledger files:

| Layer | File |
|---|---|
| Colour, spacing, type, radius, layout, z-index, icon stroke | `src/app/tokens.css` |
| Shared components (page, card, button, input, table, toast, dialog, nav) | `src/app/components.css` |
| Motion tokens, keyframes, `prefers-reduced-motion` / `.is-reduced` | `src/app/motion.css` |
| App chrome leftovers (tape, kline, tables, 12px scrollbar) | `src/app/globals.css` |
| Icons | `src/components/icons.tsx` + `public/icons/icons-paths.json` |

Litora excerpts (`litora-tokens.css`, `icons.js`, `PATTERNS.md`, `DESIGN_PAGES.md`) keep verbatim values; `app/styles/app.css` and `docs/DESIGN_HANDOFF.md` are full. Cite Litora as `mimateinn/Litora:<path>`. Icon path geometry was not exported: Jointledger draws its own SVGs to the spec.

If a value is not in the tables below, do not use it.

---

## Mapping: rule → source file

| Jointledger rule | Exact source path(s) | Jointledger value | Deviation / reason |
|---|---|---|---|
| Warm-paper / navy ramps | `mimateinn/Litora:public/litora/litora-tokens.css` (`--paper-*`, `--nv-*`, `--ink-900`) | Light `--bg` `#FAF8F5`, `--surface` `#FFFFFF`, `--text` `#0F0F0F`; dark `--bg` `#0E1320`, `--surface` `#161D2E`, `--text` `#F2F5FB` | None for page surfaces. |
| Single action colour = orange + near-black text | `mimateinn/Litora:public/litora/litora-tokens.css` (`--or-500`, `--accent-fg`); INDEX note “orange single action colour” | `--ink` `#E85D04`, `--on-ink` `#0F0F0F` | **Hover/press stay at or above `#E85D04` luminance** (`--ink-hover` `#F08A4B`, `--ink-press` `#E85D04`). Litora `--accent-hover: --or-600` `#C94F03` is 4.20:1 with required near-black text and fails AA. Press uses the `.985` + 1px drop instead of a darker fill. |
| Teal as link / success, not the primary fill | `mimateinn/Litora:public/litora/litora-tokens.css` (`--link`, `--tl-*`, `--st-ok`); `mimateinn/Versora:src/theme.py` (`#14b8a6`, `#0f766e`) | Light `--link` `#175F57`, `--st-ok` `#1F7D72`; dark `--link` `#8BBAFF`, `--st-ok` `#5CB287`. `--vs-teal` kept as the Versora cousin. | Versora paints selected pills and the 48px start button teal-on-white. Jointledger follows Litora's “orange is the only action colour” for buttons/nav; teal is reserved for links and non-P&L success. |
| Status (ok / err / warn) | `mimateinn/Litora:public/litora/litora-tokens.css` (status block) | `--st-ok/err/warn` and `*-bg` copied | None. |
| Finance up / down | Jointledger (this file) | Light `--up` `#166C40`, `--down` `#C0392B`; dark `--up` `#42A375`, `--down` `#E6746C` | **Deviation.** Litora `--st-ok` is teal “success”, not a signed P&L channel. Ledger gain/loss must stay instantly readable as up/down and independently contrast-checked. Do not reuse orange or link teal for P&L. |
| Delay chip | `mimateinn/Litora:public/litora/litora-tokens.css` (`--am-700/100`, dark `--p4i`) | Light `#8F6207` on `#FBF3DC`; dark `#D0A445` on amber wash | None. |
| Type scale 10–50, body 15 | `mimateinn/Litora:public/litora/litora-tokens.css` (`--size-*`, `--lead-*`) | Body 15 / 22; page title 26 / 32 (mobile 21); card title 17; meta 13; caption 11; display 32 | Caption 11 stays Litora `--size-2xs` for the 56px mobile bar label. |
| Font stack | Constraint + `mimateinn/Versora:src/theme.py` (system CJK list) and `mimateinn/Versora:README.md` (ordinary Latin is locally bundled Libron OFL in Versora; not copied here) | `--font-sans`: `-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", "Noto Sans TC", system-ui, sans-serif` | **Deviation.** Litora names Poppins / Inter / Newsreader / IBM Plex Mono; those families carry licences. Jointledger does **not** bundle or download them. Versora ships Libron, not Poppins; that OFL file is also not copied. |
| Spacing 4px base | `mimateinn/Litora:public/litora/litora-tokens.css` (`--sp-3xs`…`--sp-3xl`) | 2 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 44 / 64. `--sp-12` 48 remains for page bottom only. | 48px page bottom is Jointledger chrome (sidebar wordmark + main padding), not a Litora step. |
| Control heights 28 / 34 / 42; primary 36; Versora 40 / 48 | `mimateinn/Litora:public/litora/litora-tokens.css` (`--h-ctrl-*`); `mimateinn/Litora:docs/PATTERNS.md` (32 / 36); `mimateinn/Versora:src/theme.py` (40px rails, 48px start, 36px segments) | Desktop `--control-h` 34, `--control-primary` 36, nav/rails 40, `.btn-block.btn-primary` 48. Mobile controls 44. | **`--hit-min` 44** on touch (Litora mobile hard rule in `DESIGN_HANDOFF.md` §8 / `DESIGN_PAGES` phone ≥44). Desktop Litora `--hit-min` is 32; Jointledger keeps 44 so the existing mobile bar and coarse-pointer buttons do not shrink. |
| Radius 6 / 10 / 14 + 12 structural cap | `mimateinn/Litora:public/litora/litora-tokens.css` (`--r-*`, `[data-skin=portal] --r-max:12px`); `mimateinn/Litora:docs/PATTERNS.md` (10px action radius); `mimateinn/Versora:src/theme.py` (16px cards, 12px dropzone, 10px chips) | `--radius-xs` 6, `--radius-sm` / `--chip-radius` 10, `--card-radius` / `--radius-md` / `--radius-lg` **12**. Filter chips `--radius-pill`. Dropzone 12. | **Cards cap at 12**, not Versora's 16. Litora portal skin is the later, explicit structural cap. |
| Shadows, wide / faint / straight down | `mimateinn/Litora:public/litora/litora-tokens.css` (`--sh-*`) | `--shadow-1/2/3` copy `--sh-sm/md/lg` per theme | Cards stay `--shadow-0` (border only) so the 1440 alignment box does not grow a blur halo. |
| Focus = 2px page gap + 2px accent ring | `mimateinn/Litora:public/litora/litora-tokens.css` (`--ring`); `mimateinn/Litora:app/styles/app.css` (`:focus-visible`) | `box-shadow: var(--ring)` | None. |
| Icon spec 24 grid, 1.7 stroke, round caps | `mimateinn/Litora:public/litora/icons.js` (1.7); sizes `--icon-*` even. Versora `src/icons.py` is a separate handmade 16px / 24-viewBox set at **stroke-width 2**. | ViewBox `0 0 24 24`, `stroke-width` 1.7, round cap/join, `currentColor`, no emoji. Screen stroke always 1.7px: `.icon-16 { --icon-sw: 2.55 }` · `.icon-20 { --icon-sw: 2.04 }` · `.icon-24 { --icon-sw: 1.7 }` | **Shapes are Jointledger's.** Litora path geometry was omitted. Jointledger's 1.7 stroke is from Litora, not Versora. Versora icons stay English-named and emoji-free; their paths and stroke 2 are not copied. |
| Motion 80 / 140 / 220 / 340; ease-out; no `transition: all` | `mimateinn/Litora:public/litora/litora-tokens.css` (`--d-*`, `--e-out`); `mimateinn/Litora:docs/DESIGN_HANDOFF.md` Interactions (80–560ms, `.22,1,.36,1`) | `--dur-instant` 80, `--dur-fast` 140, `--dur-slow`/`--dur-page` 220 | Page enter stays 220 (`--d-norm`), not 360 `--d-enter`, so route changes stay under the previous 280 cap. |
| Press `.985` + 1px drop, 80 / 180ms, no spring on press | `mimateinn/Litora:docs/PATTERNS.md`; `mimateinn/Litora:app/styles/app.css` (`--control-press-scale`, `--control-press-duration`) | `--press-scale: .985`, `--press-drop: 1px` | None. |
| Theme change 280ms colour-only | `mimateinn/Litora:docs/PATTERNS.md`; `mimateinn/Litora:app/styles/app.css` (`--theme-transition-duration: 280ms`); `mimateinn/Versora:README.md` | `--dur-theme: 280ms` on `.theme-fade`. Reduced-motion / `.is-reduced` snaps to 0. | None. |
| 12px floating scrollbar, orange thumb on hover | Intent from `mimateinn/Litora:app/styles/app.css` and `mimateinn/Versora:README.md` (“Litora-style 12 px scrollbars”). Jointledger CSS in `src/app/globals.css` is rewritten, not copied. | `--sb-w` 12; inset capsule; `--ink` gradient while the pointer is on the thumb | Do not set `scrollbar-width` / `scrollbar-color` — Chromium then ignores the webkit thumb. |
| Toolbar + scroll pane; title + eyebrow; one primary | `mimateinn/Litora:docs/DESIGN_PAGES.md` | `.page-head` + `.page-eyebrow` + `.page-title`; actions on the right | Applied on every page and new-feature screen (overview, holdings, entry, returns, ledger, account, first-use, import, instrument, login, loading, 404, error). |
| 56px list rows | `mimateinn/Litora:docs/DESIGN_PAGES.md` | `--table-row-h: 56px` | None. |
| Filter pills stay round | `mimateinn/Litora:docs/PATTERNS.md`; portal skin `--r-chip` vs pill | `.chip-row .chip` / filter chips use `--radius-pill` | None. |
| Notices = thin inline-start rule, not a chip | `mimateinn/Litora:docs/PATTERNS.md` | `.notice` on first-run tips and the entry first-use hint | Not a nested rounded card. |
| Empty state keeps the page skeleton | `mimateinn/Litora:docs/PATTERNS.md`, `DESIGN_PAGES.md` | Toolbar / filters stay; empty replaces the main list only | None. |
| Settings appearance = dark / light / follow system | `mimateinn/Litora:docs/DESIGN_PAGES.md` | Account segmented control: 暖紙 / 夜頁 / 跟系統 | Dark label is **夜頁** (Litora navy), not the old “墨紙”. |
| Alignment grid 1440 / 375 | Jointledger (this file) + existing `test:scroll-width` / `test:sticky` | Desktop sidebar 220; content x=244; `.page` 1172; card text x=265; card right 1416. Mobile pad 16, content 343, bar 56. | **Deviation.** Litora shell is topbar 52 + nav 208 + dock 56 (`DESIGN_HANDOFF.md` Screens / Views). Changing the Jointledger sidebar to 208 would shift every measured column and break the already-recorded overflow/sticky proofs. New numbers in this pass: body 15, row 56, control 34/36, radius 10/12. Sidebar and page x stay. |
| Reduced motion | `mimateinn/Litora:app/styles/app.css`; `mimateinn/Versora:README.md`; Jointledger `motion-reduced.test.ts` | `prefers-reduced-motion` and Account → 減少動態 (`.is-reduced`) | None. |

---

## Spacing (4px base)

| Token | Value | Use |
|---|---|---|
| `--sp-1` / `--sp-2xs` | 4px | Icon–text gap |
| `--sp-2` / `--sp-xs` | 8px | Control groups, label → input |
| `--sp-3` / `--sp-sm` | 12px | Table cell vertical, mobile `--gap` |
| `--sp-4` / `--sp-md` | 16px | Desktop `--gap`, mobile page / card pad |
| `--sp-5` / `--sp-ml` | 20px | Desktop `--card-pad` only |
| `--sp-6` / `--sp-lg` | 24px | Desktop `--page-pad`, dialog pad |
| `--sp-8` / `--sp-xl` | 32px | Empty-state pad |
| `--sp-11` / `--sp-2xl` | 44px | Litora 2xl; hit row |
| `--sp-12` | 48px | Page bottom, login wordmark gap |
| `--sp-16` / `--sp-3xl` | 64px | Rare large stack |

Allowed padding / margin / gap: those values or `0`. No 10 / 14 / 18px.

Vertical rhythm: page eyebrow → title → 8px → content; cards 16px apart; metric label → 4px → display → 4px → sub.

---

## Type

Font: `--font-sans` system stack only (see mapping). Weights 400 / 500 / 600. Figures use `.num` / `.tabular`.

| Role | Class | Desktop | Mobile ≤800 | Use |
|---|---|---|---|---|
| Display | `.display` | 32 / 32 / 500 / −0.03em | 26 / 28 | NAV, cash, last price |
| Page title | `.page-title` | 26 / 32 / 600 / −0.015em | 21 / 26 | One `<h1>` per page |
| Eyebrow | `.page-eyebrow` | 11 / 16 / 500 / +0.14em | 11 / 16 | Uppercase label above the title |
| Title | `.title` | 18 / 24 / 600 | 18 / 24 | Dialog / first-use section |
| Card title | `.card-title` | 17 / 24 / 600 | 17 / 24 | Card `<h2>` |
| Body | default / `.body` | 15 / 22 / 400 | 15 / 22 (inputs 16) | Copy, table cells |
| Meta | `.meta` | 13 / 20 / 500 | 13 / 20 | Labels, timestamps |
| Compact display | `.display-compact` | 20 / 28 / 500 | 20 / 28 | Mobile paired metrics |
| Caption | `.caption` | 11 / 16 / 500 | 11 / 16 | Bottom bar, chart axis |

Currency: `<span class="unit">US$</span>` + display figure.

---

## Radius and shadow

| Token | Value | Use |
|---|---|---|
| `--radius-xs` | 6px | Skeleton, progress |
| `--radius-sm` / `--chip-radius` | 10px | Button, input, default chip |
| `--radius-md` / `--card-radius` | 12px | Card, table, chart, banner (structural cap) |
| `--radius-lg` | 12px | Dialog, toast, sheet |
| `--radius-pill` | 999px | Filter pills, avatar, status dot |

Cards use `--shadow-0` (border only). Popovers `--shadow-2`. Dialogs `--shadow-3`.

---

## Colour

One action colour: `--ink` (Litora orange). Green / red only for P&L. Success copy uses `--st-ok`, not a green wash on toasts (toast icons stay `--ink`). P&L always carries `+` / `-` (ASCII minus). Disabled: opacity .45 + `not-allowed`.

### Light `[data-theme="light"]` (Litora paper)

| Token | Hex | Notes |
|---|---|---|
| `--bg` | `#faf8f5` | `--paper-100` |
| `--surface` | `#ffffff` | Card, dialog, input |
| `--border` | `#d8d4cc` | Decorative only |
| `--border-strong` | `#8c8880` | `--gray-500`; input edge ≥3:1 |
| `--text` | `#0f0f0f` | `--ink-900` |
| `--muted` | `#6b6b6b` | `--ink-500` |
| `--ink` | `#e85d04` | `--or-500` primary |
| `--ink-hover` | `#f08a4b` | `--or-400` (lighter, AA with `--on-ink`) |
| `--ink-press` | `#e85d04` | Same fill; motion does the press |
| `--on-ink` | `#0f0f0f` | Near-black on orange |
| `--up` / `--down` | `#166c40` / `#c0392b` | Finance only |
| `--up-bg` / `--down-bg` | `#e8f2ed` / `#f9ebea` | Chip wash |
| `--delay-bg` / `--delay-text` | `#fbf3dc` / `#8f6207` | Litora amber |
| `--surface-hover` | `#f5f0e6` | `--paper-200` |
| `--surface-selected` | `#fdf2eb` | 8% `--or-500` on white (full `--or-100` fails muted 4.5) |
| `--focus-ring` | `#e85d04` | |
| `--link` | `#175f57` | `--tl-700` |
| `--scrim` | `rgba(15,15,15,.42)` | Litora `--scrim` |

### Dark `[data-theme="dark"]` (Litora navy)

| Token | Hex | Notes |
|---|---|---|
| `--bg` | `#0e1320` | `--nv-900` |
| `--surface` | `#161d2e` | `--nv-800` |
| `--border` | `#2a3550` | `--line-solid` |
| `--border-strong` | `#8f9db8` | `--fg-muted`; control edge ≥3:1 (Litora `--line-strong` `#3B4A6D` is decorative only) |
| `--text` | `#f2f5fb` | |
| `--muted` | `#8f9db8` | |
| `--ink` | `#e85d04` | Same action orange |
| `--ink-hover` | `#f08a4b` | `--or-400` |
| `--ink-press` | `#e85d04` | |
| `--on-ink` | `#0f0f0f` | |
| `--up` / `--down` | `#42a375` / `#e6746c` | Finance only |
| `--up-bg` / `--down-bg` | `#1f2922` / `#2c2521` | |
| `--delay-bg` / `--delay-text` | amber 16% / `#d0a445` | |
| `--surface-hover` | `#1f2940` | `--nv-700` |
| `--surface-selected` | `rgba(232,93,4,.16)` | Litora `--accent-soft` |
| `--focus-ring` | `#f08a4b` | |
| `--link` | `#8bbaff` | Litora dark `--link` |
| `--scrim` | `rgba(15,15,15,.42)` | |

Do not use pure `#000` text. White on orange is ~3.5:1 — never use white on `--ink`.

### Contrast (WCAG relative luminance)

Body text 4.5:1; non-text UI 3:1.

**Light**

| Pair | Ratio | Gate | Result |
|---|---:|---:|---|
| text / bg | 18.08 | 4.5 | PASS |
| text / surface | 19.17 | 4.5 | PASS |
| muted / bg | 5.03 | 4.5 | PASS |
| muted / surface | 5.33 | 4.5 | PASS |
| muted / hover row | 4.69 | 4.5 | PASS |
| muted / selected | 4.84 | 4.5 | PASS |
| text / selected | 17.41 | 4.5 | PASS |
| on-ink / ink | 5.48 | 4.5 | PASS |
| on-ink / ink-hover | 7.71 | 4.5 | PASS |
| on-ink / ink-press | 5.48 | 4.5 | PASS |
| up / surface | 6.46 | 4.5 | PASS |
| up / bg | 6.09 | 4.5 | PASS |
| up / hover | 5.68 | 4.5 | PASS |
| up / up-bg | 5.64 | 4.5 | PASS |
| down / surface | 5.44 | 4.5 | PASS |
| down / bg | 5.13 | 4.5 | PASS |
| down / hover | 4.79 | 4.5 | PASS |
| down / down-bg | 4.69 | 4.5 | PASS |
| delay-text / delay-bg | 4.84 | 4.5 | PASS |
| border-strong / bg | 3.33 | 3.0 | PASS |
| border-strong / surface | 3.53 | 3.0 | PASS |
| focus-ring / bg | 3.30 | 3.0 | PASS |

**Dark**

| Pair | Ratio | Gate | Result |
|---|---:|---:|---|
| text / bg | 16.98 | 4.5 | PASS |
| text / surface | 15.39 | 4.5 | PASS |
| muted / bg | 6.78 | 4.5 | PASS |
| muted / surface | 6.15 | 4.5 | PASS |
| muted / hover row | 5.30 | 4.5 | PASS |
| muted / selected | 5.16 | 4.5 | PASS |
| text / selected | 12.93 | 4.5 | PASS |
| on-ink / ink | 5.48 | 4.5 | PASS |
| on-ink / ink-hover | 7.71 | 4.5 | PASS |
| on-ink / ink-press | 5.48 | 4.5 | PASS |
| up / surface | 5.38 | 4.5 | PASS |
| up / bg | 5.94 | 4.5 | PASS |
| up / hover | 4.64 | 4.5 | PASS |
| up / up-bg | 4.81 | 4.5 | PASS |
| down / surface | 5.67 | 4.5 | PASS |
| down / bg | 6.25 | 4.5 | PASS |
| down / hover | 4.88 | 4.5 | PASS |
| down / down-bg | 5.08 | 4.5 | PASS |
| delay-text / delay-bg | 6.54 | 4.5 | PASS |
| border-strong / bg | 6.78 | 3.0 | PASS |
| border-strong / surface | 6.15 | 3.0 | PASS |
| focus-ring / bg | 7.45 | 3.0 | PASS |

`--border` is decorative and must not stroke inputs.

---

## Icons

Hand-drawn SVG only. No emoji. No third-party packs. No Litora/Apple/SF Symbols paths.

| Rule | Value |
|---|---|
| ViewBox | `0 0 24 24` (empty-state illustrations `0 0 64 64`) |
| Stroke | 1.7 in the 24 grid (illustrations 2). `round` caps/joins. `fill: none`. `stroke: currentColor` |
| Screen stroke | Always 1.7px (see mapping) |
| Sizes | 16 table / chip · 20 default · 24 emphasis · 64 illustration (even sizes from Litora `--icon-*`) |
| Colour | `currentColor`. Status: `.icon-up` / `.icon-down`. Info `--ink`. Warning `--delay-text`. Error `--down`. Success `--st-ok` |
| React | `<Icon name="add" size={20} />` from `icons-paths.json` |
| A11y | Decorative: `aria-hidden` + `focusable="false"`. Icon-only button: `aria-label` |

New icons: add a 24-grid path to `public/icons/icons-paths.json`, then consume through `Icon`.

---

## Motion

| Token | Value |
|---|---|
| `--dur-instant` | 80ms |
| `--dur-fast` | 140ms |
| `--dur-base` | 180ms (press release) |
| `--dur-slow` / `--dur-page` | 220ms |
| `--dur-theme` | 280ms (colour only) |
| `--dur-number` | 320ms |
| `--ease-standard` | `cubic-bezier(.22,1,.36,1)` |
| `--ease-emphasized` | `cubic-bezier(.32,.72,0,1)` |
| `--ease-in-out` | `cubic-bezier(.4,0,.2,1)` |
| `--ease-pop` | `cubic-bezier(.34,1.4,.5,1)` — entrance / check only |
| `--press-scale` / `--press-drop` | `.985` / `1px` |

Animate `transform` / `opacity` only (plus colour on hover, and SVG `stroke-dashoffset` for a check). No `transition: all`.

`prefers-reduced-motion: reduce` and `<html class="is-reduced">` zero `--mv-*` / `--press-scale` / `--press-drop` / `--hover-lift` / `--dur-theme`, collapse durations to 80ms opacity, and stop tape / skeleton / spinner loops. Covered by `src/app/motion-reduced.test.ts`.

---

## Layout alignment

**Desktop 1440:** sidebar 220. Content starts at x=244. `.page` width 1172. Card / `h1` left edge x=244. Card inner text x=265 (`244 + 1px border + --card-pad 20`). Card right x=1416. Numeric column right x=1395.

**Mobile 375:** page pad 16, content 343 (x 16–359), bottom bar 56 + safe-area. No horizontal scroll at 360 / 375 / 414.

**First-use** uses the same left edge (`.page-form-wide` is 880px, `margin-inline: 0`).

**Holdings K-line** is desktop-only (hidden ≤960px). `.sticky-kline` is `position: static` ≤960px.

**Ticker:** ≤800px the lead is hidden; viewport min-width 96px.

Hit target ≥44×44 (`--hit-min`). Focus: Litora ring (2px page gap + 2px accent).

---

## Product copy

Traditional Chinese (Hong Kong). Strings stay grouped per component (`const COPY = { … }`). No i18n framework.

Product UI must not show emails, phone numbers, or personal names. Demo seed uses Member A / Member B. Broker disclaimer stays: 「記帳唔係下單。唔會連接任何券商。」
