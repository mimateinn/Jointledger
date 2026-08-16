import type { AssetClass, CanonInstrument } from "./types";

/**
 * Massive index symbols — comments only. Zero Massive calls in M2.
 * I:SPX  I:DJI  I:NDX
 */
export const MASSIVE_INDEX_COMMENTS = ["I:SPX", "I:DJI", "I:NDX"] as const;

/** Block before any Twelve Data call. Never query these as S&P / Dow / Nasdaq / Nikkei. */
export const TD_DENY_LIST = [
  "SPX",
  "I:SPX",
  "DJI",
  "I:DJI",
  "NDX",
  "I:NDX",
  "NI225",
  "KOSPI",
] as const;

const DENY = new Set<string>(TD_DENY_LIST);

const NASDAQ_EQUITIES = [
  "AAPL",
  "MSFT",
  "AMZN",
  "GOOG",
  "GOOGL",
  "META",
  "NVDA",
  "TSLA",
  "AMD",
  "INTC",
  "NFLX",
  "ADBE",
  "CSCO",
  "PEP",
  "COST",
  "AVGO",
  "QCOM",
  "AMGN",
  "INTU",
  "BKNG",
  "GILD",
  "ADP",
  "PANW",
  "CRWD",
  "MU",
  "AMAT",
  "LRCX",
  "KLAC",
  "SNPS",
  "CDNS",
  "MRVL",
  "NXPI",
  "ADSK",
  "PYPL",
  "CMCSA",
  "HON",
  "TXN",
  "SBUX",
  "MDLZ",
  "REGN",
  "VRTX",
  "ISRG",
] as const;

const NYSE_EQUITIES = [
  "JPM",
  "JNJ",
  "V",
  "UNH",
  "WMT",
  "PG",
  "MA",
  "HD",
  "XOM",
  "CVX",
  "BAC",
  "KO",
  "DIS",
  "MRK",
  "PFE",
  "BA",
  "CAT",
  "MCD",
  "IBM",
  "GE",
  "GS",
  "MS",
  "WFC",
  "AXP",
  "NKE",
  "CRM",
  "ORCL",
  "T",
  "VZ",
  "ABT",
  "LLY",
  "ABBV",
  "TMO",
  "ACN",
  "NEE",
  "PM",
  "RTX",
  "LOW",
  "UNP",
  "SCHW",
  "BLK",
***REMOVED***
  "BB",
] as const;

function instrument(row: {
  display: string;
  displayName?: string | null;
  assetClass: AssetClass;
  market: string;
  tdSymbol: string;
  tdExchange?: string | null;
  isEtfProxy?: boolean;
  tapeSlot?: number | null;
  planHint?: boolean;
}): CanonInstrument {
  return {
    display: row.display,
    displayName: row.displayName ?? null,
    assetClass: row.assetClass,
    market: row.market,
    tdSymbol: row.tdSymbol,
    tdExchange: row.tdExchange ?? null,
    isEtfProxy: row.isEtfProxy ?? false,
    tapeSlot: row.tapeSlot ?? null,
    planHint: row.planHint ?? false,
  };
}

/**
 * Frozen tape — Design 11 slots. No ETH. No USD/JPY.
 * US three are ETF proxies only — never SPX / DJI / NDX.
 */
export const TAPE_CANON: readonly CanonInstrument[] = [
  instrument({
    display: "SPY",
    displayName: "標普",
    assetClass: "etf",
    market: "US",
    tdSymbol: "SPY",
    tdExchange: "NYSE",
    isEtfProxy: true,
    tapeSlot: 1,
  }),
  instrument({
    display: "QQQ",
    displayName: "納指",
    assetClass: "etf",
    market: "US",
    tdSymbol: "QQQ",
    tdExchange: "NASDAQ",
    isEtfProxy: true,
    tapeSlot: 2,
  }),
  instrument({
    display: "DIA",
    displayName: "道指",
    assetClass: "etf",
    market: "US",
    tdSymbol: "DIA",
    tdExchange: "NYSE",
    isEtfProxy: true,
    tapeSlot: 3,
  }),
  instrument({
    display: "XAU/USD",
    displayName: null,
    assetClass: "commodity",
    market: "COM",
    tdSymbol: "XAU/USD",
    tapeSlot: 4,
    planHint: true,
  }),
  instrument({
    display: "BTC/USD",
    displayName: null,
    assetClass: "crypto",
    market: "CRYPTO",
    tdSymbol: "BTC/USD",
    tapeSlot: 5,
  }),
  instrument({
    display: "EUR/USD",
    displayName: null,
    assetClass: "fx",
    market: "FX",
    tdSymbol: "EUR/USD",
    tapeSlot: 6,
  }),
  instrument({
    display: "HSI",
    displayName: "恒指",
    assetClass: "index",
    market: "HK",
    tdSymbol: "HSI",
    tapeSlot: 7,
    planHint: true,
  }),
  instrument({
    display: "N225",
    displayName: "日經",
    assetClass: "index",
    market: "JP",
    tdSymbol: "N225",
    tapeSlot: 8,
    planHint: true,
  }),
  instrument({
    display: "KS11",
    displayName: "KOSPI",
    assetClass: "index",
    market: "KR",
    tdSymbol: "KS11",
    tapeSlot: 9,
    planHint: true,
  }),
  instrument({
    display: "USD/HKD",
    displayName: null,
    assetClass: "fx",
    market: "FX",
    tdSymbol: "USD/HKD",
    tapeSlot: 10,
  }),
  instrument({
    display: "FTSE",
    displayName: "富時",
    assetClass: "index",
    market: "UK",
    tdSymbol: "FTSE",
    tapeSlot: 11,
    planHint: true,
  }),
];

const HOLDING_CANON: CanonInstrument[] = [
  ...NASDAQ_EQUITIES.map((display) =>
    instrument({
      display,
      assetClass: "equity",
      market: "US",
      tdSymbol: display,
      tdExchange: "NASDAQ",
    }),
  ),
  ...NYSE_EQUITIES.map((display) =>
    instrument({
      display,
      assetClass: "equity",
      market: "US",
      tdSymbol: display,
      tdExchange: "NYSE",
    }),
  ),
];

const CANON_BY_DISPLAY = new Map<string, CanonInstrument>();

for (const row of [...TAPE_CANON, ...HOLDING_CANON]) {
  CANON_BY_DISPLAY.set(normalizeDisplay(row.display), row);
}

export function normalizeDisplay(symbol: string): string {
  return symbol.trim().toUpperCase();
}

export function isDeniedSymbol(symbol: string): boolean {
  const key = normalizeDisplay(symbol);
  return DENY.has(key) || DENY.has(symbol.trim());
}

export function resolveInstrument(display: string): CanonInstrument | null {
  if (isDeniedSymbol(display)) {
    return null;
  }
  return CANON_BY_DISPLAY.get(normalizeDisplay(display)) ?? null;
}

/** Bare Twelve Data symbol + optional exchange. Never Yahoo suffixes or SPX. */
export function toTwelveDataQuery(instrument: CanonInstrument): {
  symbol: string;
  exchange: string | null;
} {
  if (isDeniedSymbol(instrument.tdSymbol) || isDeniedSymbol(instrument.display)) {
    throw new Error("deny-list symbol must not be queried");
  }
  if (instrument.tdSymbol.includes(".") || instrument.display.includes(".")) {
    throw new Error("Yahoo-style suffixes are not sent to Twelve Data");
  }
  return { symbol: instrument.tdSymbol, exchange: instrument.tdExchange };
}

export function buildUniverse(openLotSymbols: readonly string[]): CanonInstrument[] {
  const out: CanonInstrument[] = [];
  const seen = new Set<string>();
  for (const row of TAPE_CANON) {
    const key = `${row.tdSymbol}\0${row.tdExchange ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(row);
  }
  for (const raw of openLotSymbols) {
    if (isDeniedSymbol(raw)) {
      continue;
    }
    const resolved = resolveInstrument(raw);
    if (!resolved) {
      continue;
    }
    const key = `${resolved.tdSymbol}\0${resolved.tdExchange ?? ""}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(resolved);
  }
  return out;
}

export function flightKey(tdSymbol: string, exchange: string | null): string {
  return `${tdSymbol}\0${exchange ?? ""}`;
}
