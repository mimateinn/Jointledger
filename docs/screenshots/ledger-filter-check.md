# Ledger filter browser check

Against the running production build (`Member A` / seeded book).

Filter navigation no longer uses `router.push` / `startTransition` / form remount. Apply, clear, and the 出入金／買賣 toggle write `history.pushState` and keep controlled inputs, so clicks cannot abort an RSC fetch.

`pnpm test:ledger-filter` (production build, seeded demo):

```
actions=41
dropped=0
ledger-filter-stress: ok
```

Manual / scripted checks that still hold:

1. Type `AAPL` → 篩選 → URL `?view=trades&q=AAPL`, box stays `AAPL`, focus stays on the search box.
2. **清除篩選** → `q` gone, box empty.
3. Reload a filtered URL → box keeps the query.
4. Clear, then browser **Back** → URL and box restore.
