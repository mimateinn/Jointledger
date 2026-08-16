# 聯倉

多人股票記帳。純粹記帳，不連接券商、不下單、無 KYC、無開戶、無邀請碼。

M1 做到：自建登入、開空表、入金、加倉，以及總覽上的現金／NAV 不變式。

## 本機（Docker Postgres）

```bash
cp .env.example .env
docker compose up -d
pnpm install
pnpm db:migrate
pnpm dev
```

瀏覽器開 [http://localhost:3000](http://localhost:3000)。

`DATABASE_URL` 預設指向 `docker-compose.yml` 的 Postgres。生產可用 Neon，但 M1 唔需要 Neon 帳戶。

## 指令

| 指令 | 作用 |
| --- | --- |
| `pnpm dev` | 開發伺服器 |
| `pnpm test` | 現金不變式單元測試 |
| `pnpm lint` | ESLint |
| `pnpm db:migrate` | 套用 Drizzle migrations |
| `pnpm build` | 生產建置（含 Serwist app-shell precache） |

## M1 示範（必做路徑）

1. 空系統會見到註冊：顯示名（例如 `Hey`）+ 密碼（至少 8 個字），電郵可留空。文案係「密碼只保護呢本記帳。唔會連接任何券商或股票戶口。」
2. 登入後「你要點開始？」：卡片 A「匯入現有 兩頁 xlsx」係停用。開卡片 B「開張新記帳表」，填名稱後按「開新表」。
3. 去「記一筆」→ 入金：港元 `1000`、匯率 `1`（即 1000 USD）、日期任意。寫入時會存 `amount_usd`。
4. 同一頁「加倉」：任意帳簿、代碼例如 `NVDA`、數量 `10`、價格 `50`。文案係「記帳唔係下單。」成本 500，手續費 0。
5. 返「總覽」：
   - 可用現金 **500**，註明「現金，未計持倉」
   - NAV **1000**（唔會變成 1500）
   - 未平倉以成本計值，標「未有現價」

之後可用顯示名或電郵 + 密碼再登入。帳戶頁可加成員顯示名（電郵可選）；對方自行設密碼嘅完整流程唔係 M1。

## 現金不變式

```
cash_usd = Σ CashFlow.amount_usd − Σ TradeAllocation.cost_usd ＋ Σ TradeAllocation.proceeds_usd
NAV = cash_usd + 未平倉價值
```

未平倉仍然扣減現金（錢已出去）。唔可以用「只加總出入金」當現金。M1 無行情，未平倉暫時用成本，所以入金 1000 再買 500 之後 NAV 仍係 1000。

`src/ledger/cash-invariant.test.ts` 覆蓋呢三步；若 NAV 變成 1500 測試會失敗。

## 架構

- `src/ledger/`：同框架無關嘅寫入 API（`createBook`、`addMember`、`createCashFlow`、`createTrade`）。空表同之後嘅 Sheet 匯入都要行呢批函數，唔會另開一條匯入專用寫入路徑。
- `src/db/drizzle-store.ts`：Postgres / Drizzle 實作 `LedgerStore`。金額欄位全部 `numeric`，運算用 `decimal.js`。
- `src/app/actions/`：server actions 呼叫 domain 函數，唔複製寫入邏輯。
- 登入：電郵或顯示名 + 密碼；argon2id；HttpOnly / SameSite=Lax cookie（生產加 Secure）。只有系統零用戶先可以註冊。
- PWA：`@serwist/next` 只 precache app shell。寫入必須有網絡，無離線寫入隊列。

## 範圍外（M1 不做）

Sheet / xlsx 匯入、行情、走勢圖、Modified Dietz、新聞、AI、券商連接、完整成員認領設密碼。
