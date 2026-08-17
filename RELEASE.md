# 本機試用（GitHub Release）

聯倉係多人股票記帳。純粹記帳，**唔會連接券商、不下單**。

## 你要準備

1. **Node.js** 同 **pnpm**（腳本用本機 `pnpm`；專案指定 `pnpm@10.33.3`）。
2. **唔使 Docker Desktop**，亦唔使裝 Postgres。本機預設單一檔 SQLite（`data/joint-ledger.sqlite`）。可選 Postgres：把 `DATABASE_URL` 改成 `postgres://` 或 `postgresql://` 開頭，再用現有 `docker-compose.yml`。

`TWELVE_DATA_API_KEY`、`FINNHUB_API_KEY` **可留空**。無 key 一樣開到 app。

## 點跑

喺專案根目錄：

| 系統 | 指令 |
| --- | --- |
| Windows | 雙擊或喺命令提示字元跑 `start.bat` |
| Mac／Linux | `./start.sh`（若未可執行：`chmod +x start.sh`） |

腳本會：

1. 檢查 node／pnpm（無就繁中提示然後退出）
2. 有需要就 `pnpm install`
3. 確保 `data/` 同 `.env`（無 `.env` 就抄 `.env.example`）。**唔開 Docker、唔探 5432**
4. `pnpm db:migrate`
5. `pnpm build && pnpm start`（`JL_DEV=1` 先改行 `pnpm dev`）
6. 等 localhost:3000 listen 之後先開瀏覽器（Windows `start`、macOS `open`、Linux `xdg-open`；開唔到唔當失敗）

瀏覽器開 [http://localhost:3000](http://localhost:3000)。

## GitHub Release v0.1.0 說明

1. 喺 Release 頁撳 **Source code (zip)**，下載返嚟
2. 解開個壓縮檔
3. **唔使開 Docker Desktop**。要有 Node.js 同 pnpm。本機預設 SQLite；可選先裝 Postgres 再改 `DATABASE_URL`
4. Windows：撳 `start.bat`。Mac／Linux：撳 `start.sh`
5. 等一陣，瀏覽器會開 http://localhost:3000
6. 第一次見到「建立帳戶」。示範可以填：顯示名「小明」、電郵 demo@example.com、密碼自己諗（至少 8 個字）
7. 之後再開會係登入。同一個瀏覽器大約 30 日唔使再登。換部電腦要再登。

行情同新聞嘅 key 可以唔填。

## 注意

- 唔會連接券商。
- 唔使 Neon 帳戶。本機預設 SQLite；`DATABASE_URL` 以 `postgres://`／`postgresql://` 開頭先用 Postgres。
- 行情／新聞 key 可空；有 key 先打 Twelve Data／Finnhub，無 key 行公開延遲價同公開新聞 RSS。
