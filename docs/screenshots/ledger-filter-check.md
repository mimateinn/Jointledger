# Ledger filter browser check

Against the running production build (`Member A` / seeded book):

1. Open `/ledger?view=trades`, type `AAPL`, submit **篩選**. URL became `/ledger?view=trades&q=AAPL` and the search box kept `AAPL`.
2. Click **清除篩選**. URL dropped `q`; the remounted form showed an empty search box (the previous uncontrolled `defaultValue` bug).
3. Load `/ledger?q=NVDA&type=buy&view=trades` and reload. The box still showed `NVDA`.
4. Clear again, then browser **Back**. URL returned to the NVDA query and the box showed `NVDA` again (`useSearchParams` + form `key`).
