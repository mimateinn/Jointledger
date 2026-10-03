# Sticky tops at 375

`.entry-sticky` is `position: sticky` and must sit in the viewport at **scrollY = 0**.
The entry page is taller than the phone viewport (page height ~1235 > 812), so a broken ancestor (`overflow-x: hidden` / `clip`) parks the bar below the fold (~883) until you scroll to the bottom.
`.mobile-bar` is `position: fixed` and is not a sticky proof.

Pass condition: at scroll 0, `.entry-sticky` top < viewport height, and every ancestor has computed `overflow-x` and `overflow-y` of `visible`.

Negative control: `node scripts/measure-sticky.mjs --inject-overflow-hidden` injects `.app-frame{overflow-x:hidden}` + `html,body{overflow-x:clip}` and must exit non-zero.

Numbers are filled by `pnpm test:sticky` (see table after the next run).
