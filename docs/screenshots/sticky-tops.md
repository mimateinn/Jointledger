# Sticky tops at 375

`.entry-sticky` is `position: sticky` and must sit in the viewport at **scrollY = 0**.
The entry page is taller than the phone viewport (page height ~1235 > 812), so a broken ancestor (`overflow-x: hidden` / `clip`) parks the bar below the fold (~883) until you scroll to the bottom.
`.mobile-bar` is `position: fixed` and is not a sticky proof.

Pass condition: at scroll 0, `.entry-sticky` top < viewport height, and every ancestor has computed `overflow-x` and `overflow-y` of `visible`.

Negative control: `node scripts/measure-sticky.mjs --inject-overflow-hidden` injects `.app-frame{overflow-x:hidden}` + `html,body{overflow-x:clip}` and must exit non-zero.

| Viewport | scroll | top | bottom | pageH | ancestor | result |
|---|---|---:|---:|---:|---|---|
| 375x812 | scroll-0 (0) | 689 | 756 | 1235 | visible | ok |
| 375x812 | scroll-mid (211) | 672 | 739 | 1235 | visible | ok |
| 375x667 | scroll-0 (0) | 544 | 611 | 1235 | visible | ok |
| 375x667 | scroll-mid (284) | 544 | 611 | 1235 | visible | ok |

`--inject-overflow-hidden` (must be non-zero):

```
entry@375x812 scroll=0 .entry-sticky top=883 pageH=1235 ancestor=div.app-frame overflow-x=hidden overflow-y=auto FAIL
entry@375x667 scroll=0 .entry-sticky top=883 pageH=1235 ancestor=div.app-frame overflow-x=hidden overflow-y=auto FAIL
measure-sticky: inject-overflow-hidden failures=2
```

Full logs: `sticky-pass-proof.txt`, `sticky-fail-proof.txt`.

