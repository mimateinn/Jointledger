<img src="icon.png" width="96" alt="Jointledger">

# 聪倉

幾個人共一本股票帳。只記帳，不連券商，也不下單。

## 能做什麼

第一個人註冊，開出這本表。之後用一次性成員邀請密鑰認領，大家綁同一本。

可以入金、加倉、刪持倉或刪用戶。淨值是現金加已標記市值；沒有現價時，不會用成本去估。

頂欄有行情跑馬燈。持倉現價可選 Twelve Data。沒有 key 也能開，只是延遲或部份市值。從跑馬燈或持倉打開標的頁，看日線 K 線。

舊表可上傳兩頁 xlsx（或 csv），預覽後再寫入。不連 Google 試算表。

收益率看期間淨值金額，以及 Modified Dietz 百分比（不滿一年不年化）。持倉頁有關注名單。新聞有 Finnhub key 用官方來源，沒有就用公開 RSS。

市場涵蓋美、港、日、韓、中、歐、英股票，以及金銀銅、加密、外匯。免費層沒有的價格標為 —。

官方自動更新只認 `mimateinn/Jointledger`。

## 怎麼用

1. 在 Release 頁下載 **Source code (zip)**，解壓縮。
2. 只要 Node.js + pnpm。Windows 連按兩下 `start.bat`；Mac 或 Linux 執行 `./start.sh`。不用 Docker。
3. 等瀏覽器打開 http://localhost:3000。第一次 build 可能較久。預設用 SQLite。
4. 空系統先註冊。示範可用小明／demo@example.com，不要填真實資料。
5. 之後加人：在帳戶頁取得一次性邀請密鑰，對方用密鑰認領同一本表。

## 金鑰留在這台電腦

Twelve Data、Finnhub 的 key 可空。要填只放本機 `.env`。

---

# Jointledger

A shared stock book for several people. It only keeps the books. It does not connect to a broker, and it does not place orders.

## What it does

The first person registers and opens the book. Later people claim a seat with a one-time member invite key, and they all share the same book.

You can deposit cash, add a position, and delete a position or a user. NAV is cash plus marked market value. If a price is missing, cost is never used as a stand-in.

A ticker runs along the top. Position prices can use Twelve Data. The app still opens with no key; quotes may be delayed, or NAV may be marked partial. Open a symbol from the ticker or from positions to see a daily candlestick chart.

You can upload a two-sheet xlsx (or csv), preview it, then write it in. Google Sheets is not connected.

Returns show period NAV in dollars and a Modified Dietz percent (not annualized under one year). Positions have a watchlist. News uses Finnhub when a key is set, or public RSS when it is not.

Markets cover US, HK, JP, KR, CN, EU, and UK stocks, plus gold, silver, copper, crypto, and FX. Gaps on the free tier show as —.

Official auto-updates only accept `mimateinn/Jointledger`.

## How to use

1. Download **Source code (zip)** from the Release page and unzip it.
2. You need Node.js and pnpm. On Windows, double-click `start.bat`. On Mac or Linux, run `./start.sh`. Docker is not required.
3. Wait for http://localhost:3000. The first build can take a while. SQLite is the default.
4. On an empty system, register first. For a demo, use 小明 / demo@example.com. Do not use real personal data.
5. To add someone later, create a one-time invite key on the account page. They claim that seat and join the same book.

## Keys stay here

Twelve Data and Finnhub keys are optional. If you set them, they live only in a local `.env`.

## Updates

### v0.1.5

- Official overlay updates only from `mimateinn/Jointledger`.
- Public copy uses a two-sheet xlsx import. No real spreadsheet fingerprints.
- Import no longer writes a default allocation when the file has no schedule.
- Demo account copy uses 小明 / demo@example.com only.
