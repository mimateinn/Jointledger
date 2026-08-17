import { afterEach, describe, expect, it } from "vitest";
import { TD_DENY_LIST } from "@/quotes/symbol-map";
import { loadOhlcv, resetOhlcvFlights, type OhlcvDeps } from "./service";
import type { OhlcvBar, SharedCreditState, TimeSeriesOutcome } from "./types";

const NVDA: OhlcvBar[] = [
  { time: "2026-08-01", open: 170, high: 176, low: 168, close: 175, volume: 10 },
  { time: "2026-08-04", open: 175, high: 180, low: 174, close: 178.42, volume: 12 },
];

const HSI: OhlcvBar[] = [
  { time: "2026-08-01", open: 16820, high: 17000, low: 16700, close: 16900, volume: 1 },
  { time: "2026-08-04", open: 16900, high: 17500, low: 16850, close: 17428, volume: 1 },
];

function credits(partial?: Partial<SharedCreditState>): SharedCreditState {
  return {
    lastPackAt: null,
    rateLimitedUntil: null,
    creditUtcDate: "2026-08-16",
    creditsUsed: 0,
    ...partial,
  };
}

afterEach(() => {
  resetOhlcvFlights();
});

describe("loadOhlcv", () => {
  it("returns an empty chart when there is no key and never invents candles from a last quote", async () => {
    let fetched = false;
    const view = await loadOhlcv("NVDA", {
      getKey: () => null,
      fetchSeries: async () => {
        fetched = true;
        return { kind: "ok", bars: NVDA };
      },
      loadBars: async () => NVDA,
    });
    expect(fetched).toBe(false);
    expect(view.bars).toEqual([]);
    expect(view.status).toBe("no_key");
  });

  it("blocks the deny-list before any /time_series call", async () => {
    let fetched = 0;
    for (const symbol of TD_DENY_LIST) {
      const view = await loadOhlcv(symbol, {
        getKey: () => "k",
        fetchSeries: async () => {
          fetched += 1;
          return { kind: "ok", bars: NVDA };
        },
      });
      expect(view.bars).toEqual([]);
      expect(view.status).toBe("denied");
    }
    expect(fetched).toBe(0);
  });

  it("does not guess an unknown trades.symbol such as 0700.HK", async () => {
    let fetched = false;
    const view = await loadOhlcv("0700.HK", {
      getKey: () => "k",
      fetchSeries: async () => {
        fetched = true;
        return { kind: "ok", bars: NVDA };
      },
    });
    expect(fetched).toBe(false);
    expect(view.bars).toEqual([]);
    expect(view.status).toBe("empty");
  });

  it("does not copy another symbol's candles on a failed fetch", async () => {
    const view = await loadOhlcv("HSI", {
      now: new Date("2026-08-16T12:00:00Z"),
      getKey: () => "k",
      fetchSeries: async () => ({ kind: "empty" }),
      loadBars: async () => [],
      saveState: async () => undefined,
      loadCredits: async () => credits(),
      addCredits: async () => undefined,
    });
    expect(view.display).toBe("HSI");
    expect(view.bars).toEqual([]);
    expect(view.bars).not.toEqual(NVDA);
  });

  it("serves last-good bars on 429 / 5xx and does not invent OHLC", async () => {
    const limited = await loadOhlcv("HSI", {
      now: new Date("2026-08-16T12:00:00Z"),
      getKey: () => "k",
      fetchSeries: async () => ({ kind: "rate_limited" }),
      loadBars: async () => HSI,
      saveState: async () => undefined,
      loadCredits: async () => credits(),
      addCredits: async () => undefined,
    });
    expect(limited.bars).toEqual(HSI);
    expect(limited.status).toBe("rate_limited");

    const upstream = await loadOhlcv("HSI", {
      now: new Date("2026-08-16T12:00:00Z"),
      getKey: () => "k",
      fetchSeries: async () => ({ kind: "upstream" }),
      loadBars: async () => [],
      saveState: async () => undefined,
      loadCredits: async () => credits(),
      addCredits: async () => undefined,
    });
    expect(upstream.bars).toEqual([]);
    expect(upstream.status).toBe("upstream");
  });

  it("does not hit upstream again on the same UTC calendar day", async () => {
    let fetched = 0;
    const fetchSeries = async (): Promise<TimeSeriesOutcome> => {
      fetched += 1;
      return { kind: "ok", bars: NVDA };
    };
    const first = await loadOhlcv("NVDA", {
      now: new Date("2026-08-16T12:00:00Z"),
      getKey: () => "k",
      fetchSeries,
      loadBars: async () => [],
      saveBars: async () => undefined,
      loadState: async () => null,
      saveState: async () => undefined,
      loadCredits: async () => credits(),
      addCredits: async () => undefined,
    });
    expect(first.bars).toEqual(NVDA);
    expect(fetched).toBe(1);

    resetOhlcvFlights();
    const second = await loadOhlcv("NVDA", {
      now: new Date("2026-08-16T18:00:00Z"),
      getKey: () => "k",
      fetchSeries,
      loadBars: async () => NVDA,
      loadState: async () => ({ lastFetchUtcDate: "2026-08-16", lastStatus: "ok", lastAttemptAt: new Date() }),
      loadCredits: async () => credits({ creditsUsed: 1 }),
    });
    expect(second.bars).toEqual(NVDA);
    expect(fetched).toBe(1);
  });

  it("single-flights concurrent reads of the same symbol", async () => {
    let fetched = 0;
    const shared: OhlcvDeps = {
      now: new Date("2026-08-16T12:00:00Z"),
      getKey: () => "k",
      fetchSeries: async () => {
        fetched += 1;
        await new Promise((resolve) => setTimeout(resolve, 20));
        return { kind: "ok", bars: NVDA };
      },
      loadBars: async () => [],
      saveBars: async () => undefined,
      loadState: async () => null,
      saveState: async () => undefined,
      loadCredits: async () => credits(),
      addCredits: async () => undefined,
    };
    const [a, b] = await Promise.all([loadOhlcv("NVDA", shared), loadOhlcv("NVDA", shared)]);
    expect(fetched).toBe(1);
    expect(a.bars).toEqual(NVDA);
    expect(b.bars).toEqual(NVDA);
  });

  it("stops upstream when the shared daily credit cap is exhausted", async () => {
    let fetched = false;
    const view = await loadOhlcv("NVDA", {
      now: new Date("2026-08-16T12:00:00Z"),
      getKey: () => "k",
      fetchSeries: async () => {
        fetched = true;
        return { kind: "ok", bars: NVDA };
      },
      loadBars: async () => NVDA,
      loadState: async () => null,
      loadCredits: async () => credits({ creditsUsed: 790 }),
    });
    expect(fetched).toBe(false);
    expect(view.bars).toEqual(NVDA);
    expect(view.status).toBe("rate_limited");
  });
});
