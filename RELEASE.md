# 本機試用（GitHub Release）

聯倉係多人股票記帳。純粹記帳，**唔會連接券商、不下單**。

## 你要準備

1. **Docker Desktop**（要開住）。腳本只起現有 `docker-compose.yml` 嘅 Postgres，唔會另開第二套資料庫。
2. **Node.js** 同 **pnpm**（腳本用本機 `pnpm`；專案指定 `pnpm@10.33.3`）。

`TWELVE_DATA_API_KEY`、`FINNHUB_API_KEY` **可留空**。無 key 一樣開到 app。

## 點跑

喺專案根目錄：

| 系統 | 指令 |
| --- | --- |
| Windows | 雙擊或喺命令提示字元跑 `start.bat` |
| Mac／Linux | `./start.sh`（若未可執行：`chmod +x start.sh`） |

腳本會：

1. 檢查 Docker 行緊（未開就提示開 Docker Desktop，然後退出）
2. 無 `.env` 就 `cp .env.example .env`（key 可空）
3. `docker compose up -d` 起現有 Postgres
4. 有需要就 `pnpm install`
5. `pnpm db:migrate`
6. 未 build 就 `pnpm build`，再 `pnpm start`
7. 嘗試打開 http://localhost:3000（Windows `start`、macOS `open`、Linux `xdg-open`；開唔到唔當失敗）

瀏覽器開 [http://localhost:3000](http://localhost:3000)。

## 注意

- 唔會連接券商。
- 唔使 Neon 帳戶；本機用 Docker Postgres。
- 行情／新聞 key 可空；有 key 先打 Twelve Data／Finnhub，無 key 行公開延遲價同公開新聞 RSS。
