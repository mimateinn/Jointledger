import { describe, expect, it } from "vitest";
import {
  TAPE_CANON,
  TD_DENY_LIST,
  buildUniverse,
  isDeniedSymbol,
  resolveInstrument,
  resolveWatchSymbol,
  searchWatchSymbols,
  toTwelveDataQuery,
} from "./symbol-map";

describe("symbol map", () => {
  it("freezes Design tape 11 with SPY/QQQ/DIA proxies first", () => {
    expect(TAPE_CANON.map((row) => row.display)).toEqual([
      "SPY",
      "QQQ",
      "DIA",
      "XAU/USD",
      "BTC/USD",
      "EUR/USD",
      "HSI",
      "N225",
      "KS11",
      "USD/HKD",
      "FTSE",
    ]);
    expect(TAPE_CANON).toHaveLength(11);
    expect(TAPE_CANON.slice(0, 3).every((row) => row.isEtfProxy)).toBe(true);
    expect(TAPE_CANON.map((row) => row.tdSymbol)).not.toContain("ETH/USD");
    expect(TAPE_CANON.map((row) => row.tdSymbol)).not.toContain("USD/JPY");
    expect(TAPE_CANON.map((row) => row.tdSymbol)).not.toContain("SPX");
    expect(TAPE_CANON.map((row) => row.tdSymbol)).toContain("N225");
    expect(TAPE_CANON.map((row) => row.tdSymbol)).not.toContain("NI225");
    expect(TAPE_CANON.map((row) => row.tdSymbol)).toContain("KS11");
    expect(TAPE_CANON.map((row) => row.tdSymbol)).not.toContain("KOSPI");
  });

  it("never builds a Twelve Data query for the deny-list", () => {
    for (const symbol of TD_DENY_LIST) {
      expect(isDeniedSymbol(symbol)).toBe(true);
      expect(resolveInstrument(symbol)).toBeNull();
    }
    const universe = buildUniverse(["SPX", "I:SPX", "NI225", "NVDA", "0700.HK"]);
    expect(universe.map((row) => row.tdSymbol)).not.toEqual(expect.arrayContaining([...TD_DENY_LIST]));
    expect(universe.some((row) => row.display === "NVDA")).toBe(true);
    expect(universe.some((row) => row.display === "0700.HK")).toBe(false);
    for (const row of universe) {
      const query = toTwelveDataQuery(row);
      expect(query.symbol.includes(".")).toBe(false);
      expect(TD_DENY_LIST).not.toContain(query.symbol);
    }
  });

  it("resolves watch symbols via map + suffix; deny-list and unknown cannot add", () => {
    expect(resolveWatchSymbol("SPX")).toBeNull();
    expect(resolveWatchSymbol("ZZZZ")).toBeNull();
    expect(resolveWatchSymbol("TSLA")?.market).toBe("US");
    expect(resolveWatchSymbol("XAU")?.display).toBe("XAU/USD");
    expect(resolveWatchSymbol("0700.HK")?.market).toBe("HK");
    expect(resolveWatchSymbol("0700.HK")?.quoteable).toBe(false);
    expect(resolveWatchSymbol("7203.T")?.market).toBe("JP");
    expect(searchWatchSymbols("SPX")).toEqual([]);
    expect(searchWatchSymbols("XAU")[0]?.display).toBe("XAU/USD");
  });

  it("queries US tape three as bare symbol + exchange", () => {
    expect(toTwelveDataQuery(TAPE_CANON[0])).toEqual({ symbol: "SPY", exchange: "NYSE" });
    expect(toTwelveDataQuery(TAPE_CANON[1])).toEqual({ symbol: "QQQ", exchange: "NASDAQ" });
    expect(toTwelveDataQuery(TAPE_CANON[2])).toEqual({ symbol: "DIA", exchange: "NYSE" });
    expect(toTwelveDataQuery(TAPE_CANON.find((row) => row.display === "XAU/USD")!)).toEqual({
      symbol: "XAU/USD",
      exchange: null,
    });
  });
});
