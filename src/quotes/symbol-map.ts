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

export type WatchMarket = "US" | "HK" | "JP" | "KR" | "CN" | "EU" | "UK" | "COM" | "CRYPTO" | "FX";

export type WatchResolve = {
  display: string;
  displayName: string | null;
  market: WatchMarket;
  marketLabel: string;
  assetClass: AssetClass;
  quoteable: boolean;
};

export const WATCH_MARKET_LABEL: Record<WatchMarket, string> = {
  US: "美股",
  HK: "港股",
  JP: "日本",
  KR: "韓國",
  CN: "中",
  EU: "歐",
  UK: "英",
  COM: "商品",
  CRYPTO: "加密",
  FX: "外匯",
};

const SUFFIX_MARKET: Record<string, WatchMarket> = {
  HK: "HK",
  T: "JP",
  KS: "KR",
  KQ: "KR",
  SS: "CN",
  SZ: "CN",
  L: "UK",
  PA: "EU",
  DE: "EU",
  AS: "EU",
  MI: "EU",
  MC: "EU",
};

const WATCH_ALIASES: Record<string, { display: string; displayName: string; market: WatchMarket; assetClass: AssetClass }> =
  {
    XAU: { display: "XAU/USD", displayName: "黃金", market: "COM", assetClass: "commodity" },
    GOLD: { display: "XAU/USD", displayName: "黃金", market: "COM", assetClass: "commodity" },
    黃金: { display: "XAU/USD", displayName: "黃金", market: "COM", assetClass: "commodity" },
    XAG: { display: "XAG/USD", displayName: "白銀", market: "COM", assetClass: "commodity" },
    SILVER: { display: "XAG/USD", displayName: "白銀", market: "COM", assetClass: "commodity" },
    白銀: { display: "XAG/USD", displayName: "白銀", market: "COM", assetClass: "commodity" },
    XCU: { display: "XCU/USD", displayName: "銅", market: "COM", assetClass: "commodity" },
    HG: { display: "XCU/USD", displayName: "銅", market: "COM", assetClass: "commodity" },
    COPPER: { display: "XCU/USD", displayName: "銅", market: "COM", assetClass: "commodity" },
    銅: { display: "XCU/USD", displayName: "銅", market: "COM", assetClass: "commodity" },
    BTC: { display: "BTC/USD", displayName: "比特幣", market: "CRYPTO", assetClass: "crypto" },
    ETH: { display: "ETH/USD", displayName: "以太幣", market: "CRYPTO", assetClass: "crypto" },
    "0700.HK": { display: "0700.HK", displayName: "騰訊", market: "HK", assetClass: "equity" },
    "7203.T": { display: "7203.T", displayName: "豐田", market: "JP", assetClass: "equity" },
    "005930.KS": { display: "005930.KS", displayName: "三星", market: "KR", assetClass: "equity" },
    "600519.SS": { display: "600519.SS", displayName: "茅台", market: "CN", assetClass: "equity" },
  };

function marketOfCanon(row: CanonInstrument): WatchMarket {
  if (row.assetClass === "commodity") {
    return "COM";
  }
  if (row.assetClass === "crypto") {
    return "CRYPTO";
  }
  if (row.assetClass === "fx") {
    return "FX";
  }
  const raw = row.market.toUpperCase();
  if (raw in WATCH_MARKET_LABEL) {
    return raw as WatchMarket;
  }
  return "US";
}

function asWatch(row: {
  display: string;
  displayName: string | null;
  market: WatchMarket;
  assetClass: AssetClass;
}): WatchResolve {
  return {
    ...row,
    marketLabel: WATCH_MARKET_LABEL[row.market],
    quoteable: Boolean(resolveInstrument(row.display)),
  };
}

/**
 * Watchlist resolve: deny-list first, then M2 canon, then aliases / suffix / FX pair.
 * Unknown → null (cannot add). Yahoo suffixes are display-only; never sent to Twelve Data.
 */
export function resolveWatchSymbol(raw: string): WatchResolve | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  if (isDeniedSymbol(trimmed)) {
    return null;
  }
  const key = normalizeDisplay(trimmed);
  const alias = WATCH_ALIASES[key] ?? WATCH_ALIASES[trimmed];
  if (alias) {
    return asWatch(alias);
  }
  const canon = resolveInstrument(key);
  if (canon) {
    return asWatch({
      display: canon.display,
      displayName: canon.displayName,
      market: marketOfCanon(canon),
      assetClass: canon.assetClass,
    });
  }
  const suffix = key.match(/^([A-Z0-9]+)[./]([A-Z]{1,2})$/);
  if (suffix && SUFFIX_MARKET[suffix[2]]) {
    const market = SUFFIX_MARKET[suffix[2]];
    return asWatch({
      display: `${suffix[1]}.${suffix[2]}`,
      displayName: null,
      market,
      assetClass: "equity",
    });
  }
  if (/^[A-Z]{3}\/[A-Z]{3}$/.test(key)) {
    return asWatch({
      display: key,
      displayName: null,
      market: "FX",
      assetClass: "fx",
    });
  }
  return null;
}

export function searchWatchSymbols(query: string, limit = 8): WatchResolve[] {
  const trimmed = query.trim();
  if (!trimmed) {
    return [];
  }
  if (isDeniedSymbol(trimmed)) {
    return [];
  }
  const key = normalizeDisplay(trimmed);
  const hits: WatchResolve[] = [];
  const seen = new Set<string>();
  const push = (row: WatchResolve | null) => {
    if (!row || seen.has(row.display)) {
      return;
    }
    seen.add(row.display);
    hits.push(row);
  };
  push(resolveWatchSymbol(trimmed));
  for (const row of [...TAPE_CANON, ...HOLDING_CANON]) {
    if (hits.length >= limit) {
      break;
    }
    if (isDeniedSymbol(row.display)) {
      continue;
    }
    const name = row.displayName ?? "";
    if (row.display.startsWith(key) || name.includes(trimmed)) {
      push(resolveWatchSymbol(row.display));
    }
  }
  for (const alias of Object.values(WATCH_ALIASES)) {
    if (hits.length >= limit) {
      break;
    }
    if (alias.display.startsWith(key) || alias.displayName.includes(trimmed) || normalizeDisplay(alias.displayName) === key) {
      push(resolveWatchSymbol(alias.display));
    }
  }
  return hits.slice(0, limit);
}

export function isNorthAmericaWatch(row: WatchResolve): boolean {
  return row.market === "US";
}
