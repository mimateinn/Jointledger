import { afterEach, describe, expect, it, vi } from "vitest";
import { resolveInstrument } from "@/quotes/symbol-map";
import { fetchTwelveDataTimeSeries } from "./twelve-data";
import { fetchPublicTimeSeries, mapBinanceKlines, mapYahooChartBars } from "./public-source";

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

describe("public ohlcv mapping", () => {
  it("maps Binance klines [t,o,h,l,c,v] into the existing bar shape", () => {
    expect(mapBinanceKlines(null).kind).toBe("empty");
    expect(mapBinanceKlines([[1_692_230_400_000, "100", "110", "90"]]).kind).toBe("empty");
    const day1 = Date.UTC(2026, 7, 1);
    const day4 = Date.UTC(2026, 7, 4);
    expect(
      mapBinanceKlines([
        [day4, "175", "180", "174", "178.42", "12"],
        [day1, "170", "176", "168", "175", "10"],
      ]),
    ).toEqual({
      kind: "ok",
      bars: [
        { time: "2026-08-01", open: 170, high: 176, low: 168, close: 175, volume: 10 },
        { time: "2026-08-04", open: 175, high: 180, low: 174, close: 178.42, volume: 12 },
      ],
    });
  });

  it("maps Yahoo indicators.quote; missing close or time is skipped, never invented", () => {
    expect(mapYahooChartBars({ chart: { result: [] } }).kind).toBe("empty");
    expect(
      mapYahooChartBars({
        chart: {
          result: [
            {
              timestamp: [Date.UTC(2026, 7, 1) / 1000, Date.UTC(2026, 7, 4) / 1000],
              indicators: {
                quote: [
                  {
                    open: [170, 175],
                    high: [176, 180],
                    low: [168, 174],
                    close: [175, null],
                    volume: [10, 12],
                  },
                ],
              },
            },
          ],
        },
      }),
    ).toEqual({
      kind: "ok",
      bars: [{ time: "2026-08-01", open: 170, high: 176, low: 168, close: 175, volume: 10 }],
    });
  });
});

describe("ohlcv public exclusivity", () => {
  it("有 key：公開日線接駁唔打 Binance／Yahoo", async () => {
    process.env.TWELVE_DATA_API_KEY = "test-key";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (/binance|yahoo|coingecko/i.test(url)) {
        throw new Error("must not call public ohlcv when Twelve Data key is set");
      }
      return new Response(
        JSON.stringify({
          status: "ok",
          values: [{ datetime: "2026-08-04", open: "175", high: "180", low: "174", close: "178.42", volume: "12" }],
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const pub = await fetchPublicTimeSeries(instrument("NVDA"));
    expect(pub.kind).toBe("empty");
    const td = await fetchTwelveDataTimeSeries(instrument("NVDA"));
    expect(td.kind).toBe("ok");
    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.includes("twelvedata.com"))).toBe(true);
  });

  it("無 key：加密日線行 Binance klines，唔打 Twelve Data", async () => {
    process.env.TWELVE_DATA_API_KEY = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("twelvedata.com")) {
        throw new Error("must not call Twelve Data when key is empty");
      }
      expect(url).toContain("data-api.binance.vision/api/v3/klines");
      expect(url).toContain("symbol=BTCUSDT");
      return new Response(JSON.stringify([[1_692_230_400_000, "175", "180", "174", "178.42", "12"]]), {
        status: 200,
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const td = await fetchTwelveDataTimeSeries(instrument("BTC/USD"));
    expect(td.kind).toBe("no_key");
    const pub = await fetchPublicTimeSeries(instrument("BTC/USD"));
    expect(pub.kind).toBe("ok");
    if (pub.kind === "ok") {
      expect(pub.bars[0]?.close).toBe(178.42);
    }
  });

  it("無 key：股票日線行 Yahoo chart，標的 URL 係 unofficial chart", async () => {
    process.env.TWELVE_DATA_API_KEY = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("twelvedata.com")) {
        throw new Error("must not call Twelve Data when key is empty");
      }
      expect(url).toContain("query1.finance.yahoo.com/v8/finance/chart/AAPL");
      return new Response(
        JSON.stringify({
          chart: {
            result: [
              {
                timestamp: [1_692_230_400],
                indicators: {
                  quote: [{ open: [175], high: [180], low: [174], close: [178.42], volume: [12] }],
                },
              },
            ],
          },
        }),
        { status: 200 },
      );
    });
    vi.stubGlobal("fetch", fetchMock);
    const pub = await fetchPublicTimeSeries(instrument("AAPL"));
    expect(pub.kind).toBe("ok");
  });
});
