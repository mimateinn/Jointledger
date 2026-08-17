import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveDisplayedMark } from "./apply-status";
import {
  BINANCE_PUBLIC_BASE,
  COINGECKO_BASE,
  YAHOO_CHART_BASE,
  binanceSpotSymbol,
  coinGeckoId,
  fetchPublicQuote,
  mapBinance24hr,
  mapCoinGeckoMarkets,
  mapYahooChartMeta,
  quotesVia,
  yahooChartSymbol,
} from "./public-source";
import { resolveInstrument } from "./symbol-map";
import { fetchTwelveDataQuote } from "./twelve-data";

const originalKey = process.env.TWELVE_DATA_API_KEY;

afterEach(() => {
  process.env.TWELVE_DATA_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

function instrument(display: string) {
  const row = resolveInstrument(display);
  if (!row) {
    throw new Error(`${display} should resolve`);
  }
  return row;
}

describe("public quote mapping", () => {
  it("maps Binance 24hr; missing close or time is empty, never a fake price", () => {
    expect(mapBinance24hr(null).kind).toBe("empty");
    expect(mapBinance24hr({ lastPrice: "65000.10" }).kind).toBe("empty");
    expect(mapBinance24hr({ closeTime: 1_692_239_999_999 }).kind).toBe("empty");
    expect(mapBinance24hr({ lastPrice: "N/A", closeTime: 1_692_239_999_999 }).kind).toBe("empty");
    expect(
      mapBinance24hr({
        lastPrice: "65000.10",
        priceChange: "100.10",
        priceChangePercent: "0.15",
        volume: "12.5",
        closeTime: 1_692_239_999_999,
      }),
    ).toMatchObject({
      kind: "ok",
      last: "65000.10",
      percentChange: "0.15",
    });
  });

  it("maps CoinGecko markets; missing current_price or last_updated is empty", () => {
    expect(mapCoinGeckoMarkets([], "bitcoin").kind).toBe("empty");
    expect(
      mapCoinGeckoMarkets(
        [{ id: "bitcoin", current_price: 64000, price_change_24h: -100, price_change_percentage_24h: -0.15 }],
        "bitcoin",
      ).kind,
    ).toBe("empty");
    expect(
      mapCoinGeckoMarkets(
        [
          {
            id: "bitcoin",
            current_price: 64000,
            price_change_24h: -100,
            price_change_percentage_24h: -0.15,
            last_updated: "2026-08-17T08:00:00.000Z",
          },
        ],
        "bitcoin",
      ),
    ).toMatchObject({
      kind: "ok",
      last: "64000",
      percentChange: "-0.15",
    });
  });

  it("maps Yahoo meta.regularMarketPrice and marks delayed + source=yahoo", async () => {
    process.env.TWELVE_DATA_API_KEY = "";
    expect(
      mapYahooChartMeta({
        chart: { result: [{ meta: { regularMarketPrice: 178.42 } }] },
      }).kind,
    ).toBe("empty");
    expect(
      mapYahooChartMeta({
        chart: {
          result: [
            {
              meta: {
                regularMarketPrice: 178.42,
                regularMarketTime: 1_692_230_400,
                previousClose: 175,
                regularMarketChangePercent: 1.95,
              },
            },
          ],
        },
      }),
    ).toMatchObject({
      kind: "ok",
      last: "178.42",
      percentChange: "1.95",
      previousClose: "175",
    });

    const fetchMock = vi.fn(async () => {
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 178.42,
                  regularMarketTime: 1_692_230_400,
                  previousClose: 175,
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const hit = await fetchPublicQuote(instrument("NVDA"));
    expect(hit.outcome.kind).toBe("ok");
    expect(hit.source).toBe("yahoo");
    expect(hit.delayed).toBe(true);
    expect(String(fetchMock.mock.calls[0]?.[0])).toContain(`${YAHOO_CHART_BASE}/NVDA`);
  });

  it("resolves public symbols from the existing canon map only", () => {
    expect(binanceSpotSymbol(instrument("BTC/USD"))).toBe("BTCUSDT");
    expect(coinGeckoId(instrument("BTC/USD"))).toBe("bitcoin");
    expect(yahooChartSymbol(instrument("BTC/USD"))).toBeNull();
    expect(yahooChartSymbol(instrument("NVDA"))).toBe("NVDA");
    expect(yahooChartSymbol(instrument("EUR/USD"))).toBe("EURUSD=X");
    expect(yahooChartSymbol(instrument("HSI"))).toBe("^HSI");
    expect(yahooChartSymbol(instrument("XAU/USD"))).toBe("XAUUSD=X");
  });
});

describe("quote source exclusivity", () => {
  it("有 key：quotesVia=twelve_data；公開接駁唔打 Binance／Yahoo／CoinGecko", async () => {
    process.env.TWELVE_DATA_API_KEY = "test-key";
    expect(quotesVia()).toBe("twelve_data");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (/binance|coingecko|yahoo/i.test(url)) {
        throw new Error("must not call public sources when Twelve Data key is set");
      }
      return new Response(JSON.stringify({ close: "178.42", percent_change: "1.2", timestamp: 1_692_230_400 }), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const pub = await fetchPublicQuote(instrument("NVDA"));
    expect(pub.outcome.kind).toBe("empty");
    const td = await fetchTwelveDataQuote(instrument("NVDA"));
    expect(td.kind).toBe("ok");

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.includes("twelvedata.com"))).toBe(true);
    expect(urls.every((url) => !url.includes("data-api.binance.vision"))).toBe(true);
    expect(urls.every((url) => !url.includes("query1.finance.yahoo.com"))).toBe(true);
    expect(urls.every((url) => !url.includes("api.coingecko.com"))).toBe(true);
  });

  it("無 key（trim 後空）：加密行 Binance，唔打 Twelve Data", async () => {
    process.env.TWELVE_DATA_API_KEY = "   ";
    expect(quotesVia()).toBe("public");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("twelvedata.com")) {
        throw new Error("must not call Twelve Data when key is empty");
      }
      expect(url).toContain(`${BINANCE_PUBLIC_BASE}/ticker/24hr`);
      return new Response(
        JSON.stringify({
          lastPrice: "65000.10",
          priceChange: "100.10",
          priceChangePercent: "0.15",
          volume: "12.5",
          closeTime: 1_692_239_999_999,
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const td = await fetchTwelveDataQuote(instrument("BTC/USD"));
    expect(td.kind).toBe("no_key");
    const pub = await fetchPublicQuote(instrument("BTC/USD"));
    expect(pub.outcome).toMatchObject({ kind: "ok", last: "65000.10" });
    expect(pub.source).toBe("binance");
    expect(pub.delayed).toBe(false);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.includes("data-api.binance.vision"))).toBe(true);
    expect(urls.every((url) => !url.includes("twelvedata.com"))).toBe(true);
  });

  it("無 key：Binance 失敗後行 CoinGecko", async () => {
    process.env.TWELVE_DATA_API_KEY = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("twelvedata.com")) {
        throw new Error("must not call Twelve Data when key is empty");
      }
      if (url.includes("data-api.binance.vision")) {
        return new Response(null, { status: 500 });
      }
      expect(url).toContain(`${COINGECKO_BASE}/coins/markets`);
      expect(url).toContain("ids=bitcoin");
      return new Response(
        JSON.stringify([
          {
            id: "bitcoin",
            current_price: 64000,
            price_change_24h: -100,
            price_change_percentage_24h: -0.15,
            last_updated: "2026-08-17T08:00:00.000Z",
          },
        ]),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const pub = await fetchPublicQuote(instrument("BTC/USD"));
    expect(pub.outcome).toMatchObject({ kind: "ok", last: "64000" });
    expect(pub.source).toBe("coingecko");
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.some((url) => url.includes("data-api.binance.vision"))).toBe(true);
    expect(urls.some((url) => url.includes("api.coingecko.com"))).toBe(true);
    expect(urls.every((url) => !url.includes("twelvedata.com"))).toBe(true);
  });

  it("無 key：股票行 Yahoo unofficial chart，標 delayed", async () => {
    process.env.TWELVE_DATA_API_KEY = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("twelvedata.com") || url.includes("binance") || url.includes("coingecko")) {
        throw new Error("stocks must not hit Twelve Data or crypto publics");
      }
      expect(url).toContain(`${YAHOO_CHART_BASE}/AAPL`);
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                meta: {
                  regularMarketPrice: 190.5,
                  regularMarketTime: 1_692_230_400,
                  previousClose: 188,
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const pub = await fetchPublicQuote(instrument("AAPL"));
    expect(pub.outcome).toMatchObject({ kind: "ok", last: "190.5" });
    expect(pub.source).toBe("yahoo");
    expect(pub.delayed).toBe(true);
  });

  it("deny-list 唔打公開源", async () => {
    process.env.TWELVE_DATA_API_KEY = "";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const hit = await fetchPublicQuote({
      display: "SPX",
      displayName: null,
      assetClass: "index",
      market: "US",
      tdSymbol: "SPX",
      tdExchange: null,
      isEtfProxy: false,
      tapeSlot: null,
      planHint: true,
    });
    expect(hit.outcome.kind).toBe("denied");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("上游失敗回 upstream／empty，last-good 用現有規則，唔造假價", async () => {
    process.env.TWELVE_DATA_API_KEY = "";
    const fetchMock = vi.fn(async () => new Response(null, { status: 502 }));
    vi.stubGlobal("fetch", fetchMock);
    const hit = await fetchPublicQuote(instrument("AAPL"));
    expect(hit.outcome.kind).toBe("upstream");
    expect(hit.outcome.kind === "ok" ? hit.outcome.last : null).toBeNull();

    const now = new Date("2026-08-16T00:00:00Z");
    const lastGood = { last: "60", percentChange: "1.2", fetchedAt: new Date("2026-08-14T00:00:00Z") };
    const reused = resolveDisplayedMark(hit.outcome, lastGood, now);
    expect(reused.last).toBe("60");
    expect(reused.usedLastGood).toBe(true);

    const empty = resolveDisplayedMark({ kind: "empty" }, lastGood, now);
    expect(empty.last).toBeNull();
    expect(empty.usedLastGood).toBe(false);
  });

  it("唔接騰訊／新浪／Stooq／要 free key 嘅報價源", async () => {
    const { readFileSync } = await import("node:fs");
    const text = readFileSync(new URL("./public-source.ts", import.meta.url), "utf8");
    expect(text).not.toMatch(/qt\.gtimg|sina|stooq|alphavantage|finnhub\.io\/api\/v1\/quote/i);
  });
});
