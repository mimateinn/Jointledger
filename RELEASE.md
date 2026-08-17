# 本機試用（GitHub Release）

聯倉係多人股票記帳。純粹記帳，**唔會連接券商、不下單**。

## 你要準備

1. **Node.js** 同 **pnpm**（腳本用本機 `pnpm`；專案指定 `pnpm@10.33.3`）。
2. **Postgres 喺 localhost:5432**，或者 **Docker Desktop**。5432 已通就 skip compose，唔使 Docker。未通先先要開 Docker Desktop，腳本先 `docker compose up -d --wait` 起現有 `docker-compose.yml` 嘅 Postgres。唔會另開第二套資料庫。

`TWELVE_DATA_API_KEY`、`FINNHUB_API_KEY` **可留空**。無 key 一樣開到 app。

## 點跑

喺專案根目錄：

| 系統 | 指令 |
| --- | --- |
| Windows | 雙擊或喺命令提示字元跑 `start.bat` |
| Mac／Linux | `./start.sh`（若未可執行：`chmod +x start.sh`） |

腳本會：

1. 無 `.env` 就 `cp .env.example .env`（key 可空）
2. 探測 localhost:5432：已通就 skip compose；未通先先檢查 Docker，未開就提示開 Docker Desktop 然後退出，開咗先 `docker compose up -d --wait`
3. 有需要就 `pnpm install`
4. `pnpm db:migrate`
5. 未 build 就 `pnpm build`，再 `pnpm start`
6. 等 localhost:3000 listen 之後先開瀏覽器（Windows `start`、macOS `open`、Linux `xdg-open`；開唔到唔當失敗）

瀏覽器開 [http://localhost:3000](http://localhost:3000)。

## 注意

- 唔會連接券商。
- 唔使 Neon 帳戶。5432 已通就用現有 Postgres；否則用 Docker Postgres。
- 行情／新聞 key 可空；有 key 先打 Twelve Data／Finnhub，無 key 行公開延遲價同公開新聞 RSS。
