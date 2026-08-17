# 聯倉

多人股票記帳。純粹記帳，唔會連接券商、不下單、無邀請碼。

M1 做到：自建登入、開空表、入金、加倉，以及總覽上的現金不變式。

M2 做到：登入後頂欄行情跑馬燈、持倉按 Twelve Data 現價標記、NAV = 現金 + 已標記市值。

M3 做到：由持倉或 11 格跑馬燈打開標的頁，用 TradingView Lightweight Charts 畫日線。預設只開 SMA20 + 成交量；其餘指標喺瀏覽器用已下載嘅 OHLCV 計。

## 本機（Docker Postgres）

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

瀏覽器開 [http://localhost:3000](http://localhost:3000)。

`DATABASE_URL` 預設指向 `docker-compose.yml` 的 Postgres。生產可用 Neon，但本機唔需要 Neon 帳戶。

## 行情（M2，可選）

`TWELVE_DATA_API_KEY` 只放 server env，唔會送到瀏覽器。唔設 key 都可以開 app。

| 情況 | 跑馬燈 / 現價 | NAV |
| --- | --- | --- |
| 無 key、401、計劃唔夠、查唔到 | `—`（指數／黃金可加「延遲／升級」） | 該持股唔計入市值；有未標記就標「部分市值」 |
| 429 / 超時 / 5xx | 7 個曆日內嘅 last-good，否則 `—` | 同上 |
| 有 last | 顯示現價 +「延遲 15 分」 | `NAV = 現金 + qty × last` |

**唔會**用買入價當現價，亦唔會用成本估完整 NAV。入金 1000 再買成本 500：現金仍係 **500**。有標記先加市值；無標記嗰行係 `—`，NAV 標部分市值。唔會變 1000（成本市值）或 1500。

跑馬燈鎖定 11 格（唔包括 ETH、USD/JPY）：SPY / QQQ / DIA / XAU/USD / BTC/USD / EUR/USD / HSI / N225 / KS11 / USD/HKD / FTSE。Basic key 通常填到 SPY / QQQ / DIA / BTC/USD / EUR/USD。HSI、N225、KS11、XAU/USD、FTSE 可能要更高計劃，無價就 `—` +「延遲／升級」，唔會改用第二個來源。

美股三大係 **SPY / QQQ / DIA** ETF 代理（標「代理」）。唔會查 Twelve Data `SPX`，亦零 Massive `I:SPX` / `I:DJI` / `I:NDX` 呼叫。

行情只經自己嘅 Route Handler / server 讀 Postgres last-good。瀏覽器唔會打 twelvedata。開市最少 15 分鐘刷新一包（盤後／週末 60 分鐘），同一 `(td_symbol, exchange)` 喺 TTL 內單飛，唔會每頁、每人打上游。

## K 線（M3）

登入後可以咁開標的頁：

1. 撳頂欄跑馬燈其中一格（SPY / QQQ / DIA / XAU/USD / HSI …），或
2. 去「持倉」撳代碼（右邊會開同一張圖；代碼連結去完整標的頁）。

預設圖：主圖 SMA20 + 成交量副圖。上面五組掣（均線／通道／動量／量能／波動）可再開 SMA50/200、EMA、VWMA、布林、Donchian、Keltner、Ichimoku、PSAR、Supertrend、RSI、MACD、Stoch、StochRSI、CCI、%R、MFI、OBV、ATR、ADX。無 VWAP / MOM / ROC / CMF。全部喺前端用當日已取嘅日線計，唔會再打 Twelve Data 指標接口。

日線只經 `GET /api/ohlcv?symbol=`。Server 用同一把 `TWELVE_DATA_API_KEY` 打 Twelve Data 日線（`interval=1day`，`outputsize=300`），按 `(td_symbol, exchange, date)` 存 Postgres last-good。每個 symbol 每個 UTC 曆日最多一次上游；同 M2 共用 Basic 800/日額度。429／5xx／額度滿：有 last-good 就畫舊棒，否則空圖 + `—`。無 key、401、403、404、deny-list、未知代碼（例如未入表嘅 `0700.HK`）：空圖 + `—`，唔會用現價或成本砌假 K，亦唔會抄另一隻嘅軸。

SPY / QQQ / DIA 頁畫嘅係 ETF 代理，並標「代理」。唔會查 `SPX` / `I:SPX` / `DJI` / `NDX` / `NI225`。

無 key 一樣開到頁：現價同圖都係 `—`。

## 指令

| 指令 | 作用 |
| --- | --- |
| `pnpm dev` | 開發伺服器 |
| `pnpm test` | 現金不變式、NAV 標記、SMA／RSI／MACD、空 key 唔造假 K、軸唔共用 |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | 套用 Drizzle migrations |
| `pnpm build` | 生產建置（含 Serwist app-shell precache） |

## M1 示範（必做路徑）

1. 空系統會見到註冊：顯示名（例如 `Hey`）+ 密碼（至少 8 個字），電郵可留空。文案係「密碼只保護呢本記帳。唔會連接任何券商或股票戶口。」
2. 登入後「你要點開始？」：先做呢步「開張新記帳表」。匯入而家用緊嘅試算表係「稍後先做」。
3. 去「記一筆」→ 入金：港元 `1000`、匯率 `1`（即當美金入帳）、日期用香港日曆。
4. 同一頁「加倉」：邊個倉、代碼例如 `NVDA`、數量 `10`、價格 `50`。文案係「記帳唔係下單。」成本 500，手續費 0。
5. 返「總覽」：
   - 可用現金 **500**，註明「現金，未計持倉」
   - 無市場價：現價 `—`，NAV = 500 + 已標記市值；呢筆未標記就標「部分市值」（唔會用買入價估 NAV，唔會變成 1000 或 1500）
   - 有市場價：NAV = 500 + 數量 × last（例如 last 60 → NAV 1100）

之後可用顯示名或電郵 + 密碼再登入。帳戶頁可加成員顯示名（電郵可選）；對方自行設密碼嘅完整流程唔係 M1。

## 現金不變式

```
cash_usd = Σ CashFlow.amount_usd − Σ TradeAllocation.cost_usd ＋ Σ TradeAllocation.proceeds_usd
NAV = cash_usd + 已標記市值
已標記市值 = Σ (qty × last)   // 無 last 嘅持股唔計
```

持股仍然扣減現金（錢已出去）。唔可以用「只加總出入金」當現金。行情寫入唔會碰 CashFlow / Trade。

`src/ledger/cash-invariant.test.ts` 同 `src/ledger/nav-marks.test.ts` 覆蓋呢幾步；若無標記時用成本把 NAV 做成 1000，或有標記 60 時唔係 1100，測試會失敗。

## 架構

- `src/ledger/`：同框架無關嘅寫入 API（`createBook`、`addMember`、`createCashFlow`、`createTrade`）。空表同之後嘅 Sheet 匯入都要行呢批函數，唔會另開一條匯入專用寫入路徑。
- `src/quotes/symbol-map.ts`：唯一靜態 Twelve Data 對照（加 DB `instruments` / `quotes`）。Client 只收到 display、last、delay、is_etf_proxy。
- `src/db/drizzle-store.ts`：Postgres / Drizzle 實作 `LedgerStore`。金額欄位全部 `numeric`，運算用 `decimal.js`。
- `src/app/actions/`：server actions 呼叫 domain 函數，唔複製寫入邏輯。
- `GET /api/quotes`：已登入先讀得到；只回傳顯示用欄位，無 API key。
- `GET /api/ohlcv`：已登入先讀得到；只回傳 `{time,open,high,low,close,volume}`，無 API key、無指標線。
- `src/ohlcv/`：日線 cache 同 calendar-day single-flight。`src/indicators/`：純函數，無 fetch／env。
- 登入：電郵或顯示名 + 密碼；argon2id；HttpOnly / SameSite=Lax cookie（生產加 Secure）。只有系統零用戶先可以註冊。
- PWA：`@serwist/next` 只 precache app shell。寫入必須有網絡，無離線寫入隊列。

## 範圍外（M3 不做）

Sheet / xlsx 匯入、Modified Dietz、新聞、AI、完整關注名單流程、券商連接、Finnhub／Yahoo／未付費 Massive 行情、完整成員認領設密碼。
