# Sticky tops at 375

`.entry-sticky` is `position: sticky` and must sit in the viewport at **scrollY = 0**.
The entry page is taller than the phone viewport (page height 1351 > 812), so a broken ancestor (`overflow-x: hidden` / `clip`) parks the bar below the fold until you scroll to the bottom.
`.mobile-bar` is `position: fixed` and is not a sticky proof.
The submit bar sits at top 613 once you scroll to mid-page on 375×812.

Pass condition: at scroll 0, `.entry-sticky` top < viewport height, and every ancestor has computed `overflow-x` and `overflow-y` of `visible`.

Negative control: `node scripts/measure-sticky.mjs --inject-overflow-hidden` injects `.app-frame{overflow-x:hidden}` + `html,body{overflow-x:clip}` and must exit non-zero.

`pnpm test:sticky` measures only. It does not rewrite this file.

| Viewport | scroll | top | bottom | pageH | ancestor | result |
|---|---|---:|---:|---:|---|---|
| 375x812 | scroll-0 (0) | 685 | 756 | 1351 | visible | ok |
| 375x812 | scroll-mid | 613 | 684 | 1351 | visible | ok |
| 375x667 | scroll-0 (0) | 540 | 611 | 1351 | visible | ok |
| 375x667 | scroll-mid | 540 | 611 | 1351 | visible | ok |
