# 聯倉

多人股票記帳。純粹記帳，唔會連接券商、不下單。認領用一次性成員密鑰，唔係通用證。

M1 做到：自建登入、開空表、入金、加倉，以及總覽上的現金不變式。

M2 做到：登入後頂欄行情跑馬燈、持倉按 Twelve Data 現價標記、NAV = 現金 + 已標記市值。

M3 做到：由持倉或 11 格跑馬燈打開標的頁，用 TradingView Lightweight Charts 畫日線。預設只開 SMA20 + 成交量；其餘指標喺瀏覽器用已下載嘅 OHLCV 計。

M4 做到：第一次用可以上傳而家用緊嘅 兩頁 xlsx（xlsx / csv），預覽之後經現有 domain 寫入。唔會連接 Google 試算表。

M5 做到：收益率用期間淨值 $ + Modified Dietz %（短過一年唔年化）；持倉頁「關注」手動名單；Finnhub 新聞只經自己嘅 API；成員認領綁現有 Member；帳戶頁「再匯入」追加／取代現有 Book。

M7 做到：無 `FINNHUB_API_KEY` 時伺服器改拉 Google News 公開 RSS；有 key 仍只打 Finnhub 新聞，失敗唔改行 RSS。

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
| `pnpm test` | 現金不變式、NAV 標記、Dietz、關注解析、Finnhub 唔打 quote、有 key 失敗唔 fallback RSS、無 key 只打 RSS、認領唔開新表、再匯入現有 Book、SMA／RSI／MACD、空 key 唔造假 K、軸唔共用、匯入行經 createCashFlow／createTrade |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | 套用 Drizzle migrations |
| `pnpm build` | 生產建置（含 Serwist app-shell precache） |

## M1 示範（必做路徑）

1. 空系統會見到註冊：顯示名（例如 `Hey`）+ 密碼（至少 8 個字），電郵可留空。文案係「密碼只保護呢本記帳。唔會連接任何券商或股票戶口。」
2. 登入後「你要點開始？」：先做呢步「開張新記帳表」，或「開始匯入」上傳而家用緊嘅試算表。
3. 去「記一筆」→ 入金：港元 `1000`、匯率 `1`（即當美金入帳）、日期用香港日曆。
4. 同一頁「加倉」：邊個倉、代碼例如 `NVDA`、數量 `10`、價格 `50`。文案係「記帳唔係下單。」成本 500，手續費 0。
5. 返「總覽」：
   - 可用現金 **500**，註明「現金，未計持倉」
   - 無市場價：現價 `—`，NAV = 500 + 已標記市值；呢筆未標記就標「部分市值」（唔會用買入價估 NAV，唔會變成 1000 或 1500）
   - 有市場價：NAV = 500 + 數量 × last（例如 last 60 → NAV 1100）

之後可用顯示名或電郵 + 密碼再登入。帳戶頁可加成員；加嘅時候會顯示一次性邀請密鑰（只一次）。對方用顯示名或電郵 + 密鑰 + 自己設嘅密碼認領，綁去現有成員，唔會開新表。顯示名／電郵唔夠認領。

## 現金不變式

```
cash_usd = Σ CashFlow.amount_usd − Σ TradeAllocation.cost_usd ＋ Σ TradeAllocation.proceeds_usd
NAV = cash_usd + 已標記市值
已標記市值 = Σ (qty × last)   // 無 last 嘅持股唔計
```

持股仍然扣減現金（錢已出去）。唔可以用「只加總出入金」當現金。行情寫入唔會碰 CashFlow / Trade。

`src/ledger/cash-invariant.test.ts` 同 `src/ledger/nav-marks.test.ts` 覆蓋呢幾步；若無標記時用成本把 NAV 做成 1000，或有標記 60 時唔係 1100，測試會失敗。

## 架構

- `src/ledger/`：同框架無關嘅寫入 API（`createBook`、`addMember`、`createCashFlow`、`createTrade`、`setAllocationSchedule`）。空表同 Sheet 匯入都要行呢批函數，唔會另開一條匯入專用寫入路徑。
- `src/import/`：只係呼叫者。Server 用 exceljs 解 xlsx／csv。未確認欄位對應就零寫入。每轉都寫 `ImportBatch`（邊個、檔名、時間、列數、success／warning／skipped）。同一檔預設唔會默認重複入數，要明示追加或取代。
- `src/quotes/symbol-map.ts`：唯一靜態 Twelve Data 對照（加 DB `instruments` / `quotes`）。Client 只收到 display、last、delay、is_etf_proxy。
- `src/db/drizzle-store.ts`：Postgres / Drizzle 實作 `LedgerStore`。金額欄位全部 `numeric`，運算用 `decimal.js`。
- `src/app/actions/`：server actions 呼叫 domain 函數，唔複製寫入邏輯。
- `GET /api/quotes`：已登入先讀得到；只回傳顯示用欄位，無 API key。
- `GET /api/ohlcv`：已登入先讀得到；只回傳 `{time,open,high,low,close,volume}`，無 API key、無指標線。
- `src/ohlcv/`：日線 cache 同 calendar-day single-flight。`src/indicators/`：純函數，無 fetch／env。
- 登入：電郵或顯示名 + 密碼；argon2id；HttpOnly / SameSite=Lax cookie（生產加 Secure）。只有系統零用戶先可以註冊。之後認領要一次性成員密鑰，綁現有 Member。
- `GET /api/news`：已登入先讀得到；只回新聞標題／出版社／連結／時間 + `via`（`finnhub` 或 `rss`），無 API key、無報價。`FINNHUB_API_KEY` 可空（改行公開 RSS）。
- `src/returns/`：期間 $ + Modified Dietz，只讀帳簿 + last-good。
- `src/watchlist/`：每個 Book 一份關注名單；寫入唔經 ledger write API。
- PWA：`@serwist/next` 只 precache app shell。寫入必須有網絡，無離線寫入隊列。

## 匯入試算表（M4）

唔會用 Google Sheet ID 做即時來源，亦唔會喺 runtime 打 Drive／Sheets API。把而家用緊嘅 兩頁 xlsx 兩頁匯出再上傳：

1. **xlsx（建議）**：Google 試算表 → 檔案 → 下載 → Microsoft Excel（.xlsx）。要保留兩個分頁名稱：`TransInfo`、`Account Detail`。
2. **兩個 csv**：每個分頁「下載 → 逗號分隔值」，兩個檔一齊上傳。檔名或欄位要認到係邊頁。

欄位對唔上（認唔到嘅標題、一欄對多個目標）會停，零寫入，等你確認對應。預覽會列出成員數、買賣數、出入金數、Own→帳，以及對唔上／待確認列。

**待確認**唔當鎖定真相，要揀「一併匯入」或「略過」：

- 2020–21 仍未平倉：按表維持開倉，之後喺 app 先平。
- 2024-01-15（分帳）追溯分帳套用舊倉。歷史買賣鎖買入當日生效嘅 AllocationSchedule；新單用而家嘅（分帳：50 / 50 再除以總和）。
- 只喺一邊出現嘅代碼（例如 呢個代碼只喺 Account Detail、呢個代碼只喺 TransInfo）。
- 同日同代碼聯名／獨倉對唔上：**唔會**默認 Hey 獨倉。

Account Detail 係現金真相（H／S／W 入金）。TransInfo 一列＝一對買賣，賣出日空白＝仍開倉。買入成本用 `buy_total`（包手續費）。`trades.symbol` 照表寫（可以係 `0700.HK`），M4 唔會估市場。行情仍行 M2 對照；唔識就 `—`。

匯入後總覽仍係鎖定 NAV：現金不變式 + 已標記市值。未標記持股係 `—`，NAV 標「部分市值」。入金 1000 再買成本 500，現金仍係 **500**，唔會變 1500。行情唔會寫 CashFlow／Trade。

## 收益率（M5）

主數字只有兩個：

- **期間 $** = 期末 NAV − 期初 NAV − 期間外部 CashFlow（入金 +、出金 −）。買賣唔算外部流（已喺現金不變式入面）。
- **%** = Modified Dietz。分母 = 期初 NAV + 按時間加權嘅外部 CashFlow。短過一年**唔年化**。M5 無 TWR。

NAV 仍係鎖定規則：現金不變式 + 已標記市值。未標記持股唔計入市值，亦**唔會用成本當期初／期末市價**。期初或期末缺標記：仍用已有標記計 $，**% 顯示 —**。平均資本 ≈ 0：只顯示 $，% 係 —。

曲線按 Hey / Sze / Wah 各一條。聯名倉用**該筆買入日生效**嘅 AllocationSchedule 拆入各人（Wah 永遠唔入聯名）。舊表淨盈虧只係可關對照，唔會寫入 CashFlow／Trade。

行情用 last-good，只讀帳簿。無新嘅帳簿寫入表。

### 示範 Dietz

1. 「記一筆」入金 `1000`（匯率 1）。
2. 同一頁加倉，例如 `NVDA` 數量 `10` 價格 `50`（成本 500）。
3. 再喺窗口中段入一筆金（例如再入 500）。
4. 去「收益率」揀近 1 月：
   - 有 last：期間 $ = 期末 NAV − 0 − 兩筆入金；% 係 Dietz，唔會把 30 日年化。
   - 無 last：期間 $ 仍用已標記部分計，% 係 —（唔會用 50 當現價）。

## 關注（M5）

喺「持倉」頁第二個分頁，**唔係**側欄項目（側欄仍係六項）。每個 Book 一份名單，上限 30。只可以手動加；持股唔會自動變成關注。兩邊可以同時存在。

搜尋市場：美／港／日／韓／中／歐／英股票、金／銀／銅、加密、外匯。經 M2 `src/quotes/symbol-map.ts` + deny-list 解析。唔識嘅代碼加唔到。永遠唔查 `SPX`。

寫入只係 WatchItem 加／刪／靜音。唔會改 CashFlow／Trade／NAV。

### 示範加關注同靜音新聞

1. 去「持倉」→「關注」。
2. 輸入 `XAU` 或 `0700.HK`，確認之後撳「+關注」。
3. 行內「靜音新聞」：靜音咗嘅名唔會再推公司新聞；市場欄仍在。
4. 「取消關注」只刪名單，唔動帳簿。

## 新聞（M5 + M7 後備）

`FINNHUB_API_KEY` 放 server env，唔會 `NEXT_PUBLIC_*`。瀏覽器只打自己嘅 `GET /api/news`。兩條路互斥：

- **有 key：** 只打 Finnhub 新聞。美股名用 `company-news`（免費層北美）；市場用 `/news?category=general|forex|crypto`。429／失敗＝空列表，**唔改行 RSS**。零 Finnhub quote。
- **無 key（trim 後空）：** 只打 Google News **公開 RSS**。個股 search＝ticker ＋ `when:7d`，locale 優先 `zh-HK`。大市用財經 topic／市場 search。只解析標題、出版社、連結、時間。唔爬 HTML，唔跟 Google 跳轉抓正文。唔加第二個新聞 API。

靜音咗嘅代碼唔拉、唔回個股新聞。

Server 用 Postgres `news_cache`，按 symbol／類別，TTL ≥ 15 分，單飛。RSS 失敗／被擋／空 feed：空列表，唔崩潰、唔換源、唔造假標題。

無 key 時列表標「公開新聞」同出版社，唔冒充 Finnhub。

**唔會**打 Finnhub quote；新聞價唔會改 quotes／ohlcv／NAV。Yahoo／Twelve Data 唔做新聞。

## 認領 + 再匯入（M5）

第一個用戶係唯一公開註冊。之後：現有成員加一個人時會鑄一把高熵、單次、限期邀請密鑰（只存 argon2id hash）。對方要用顯示名或電郵（認人）+ **呢把密鑰**（能力）+ 自己設嘅密碼，先可以綁去**嗰個 Member**。顯示名／電郵唔係能力。認領唔會開新 Book，亦唔會複製倉位。唔係產品級「通用證」。

**認領唔係匯入解鎖。** 有 membership 之後，唔會因為認領再開一本書或繞過成員。

帳戶頁「再匯入」只寫**現有 Book**。仍行 ImportBatch + 現有 `createCashFlow`／`createTrade`。一定要明示揀「追加」或「取代」。

無改密碼。

### 示範認領

1. 已登入嘅人去「帳戶」加成員，顯示名例如 `Sze`（電郵可選）。
2. 頁面會顯示邀請密鑰一次。抄低，離線交俾 Sze。再入帳戶頁就唔會再顯示。
3. 登出。登入頁揀「認領成員」，輸入 `Sze` + 邀請密鑰 + 至少 8 個字嘅新密碼。
4. 登入後見到同一本記帳表，倉位唔會被複製或重開。冇密鑰或密鑰錯／過期／用過都認領唔到。

### 示範再匯入

1. 已係呢本 Book 嘅成員，去「帳戶」→「再匯入試算表」。
2. 上傳 xlsx／csv，預覽之後**一定要揀追加或取代**。
3. 確認寫入仍行現有 domain 寫入；唔會另開一本空表。

## 範圍外（M5 之後）

券商連接、股息、拆股、匯出、改密碼、AI 摘要、Finnhub／Yahoo 行情、完整市場終端。
