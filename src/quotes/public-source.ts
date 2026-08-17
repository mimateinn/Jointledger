import { classifyHttpStatus, isEmptyPrice } from "./apply-status";
import { isDeniedSymbol } from "./symbol-map";
import { getTwelveDataApiKey } from "./twelve-data";
import type { CanonInstrument, QuoteSource, UpstreamOutcome } from "./types";

export const BINANCE_PUBLIC_BASE = "https://data-api.binance.vision/api/v3";
export const COINGECKO_BASE = "https://api.coingecko.com/api/v3";
export const YAHOO_CHART_BASE = "https://query1.finance.yahoo.com/v8/finance/chart";
const TIMEOUT_MS = 8_000;

const COINGECKO_IDS: Record<string, string> = {
  "BTC/USD": "bitcoin",
  "ETH/USD": "ethereum",
};

const YAHOO_INDEX: Record<string, string> = {
  HSI: "^HSI",
  N225: "^N225",
  KS11: "^KS11",
  FTSE: "^FTSE",
};

const YAHOO_COMMODITY: Record<string, string> = {
  "XAU/USD": "XAUUSD=X",
  "XAG/USD": "XAGUSD=X",
  "XCU/USD": "HG=F",
};

export type PublicQuoteResult = {
  outcome: UpstreamOutcome;
  source: QuoteSource | null;
  delayed: boolean;
};

export function quotesVia(): "twelve_data" | "public" {
  return getTwelveDataApiKey() ? "twelve_data" : "public";
}

export function binanceSpotSymbol(instrument: CanonInstrument): string | null {
  if (instrument.assetClass !== "crypto") {
    return null;
  }
  const [base, quote] = instrument.display.split("/");
  if (!base || !quote) {
    return null;
  }
  if (quote === "USD" || quote === "USDT") {
    return `${base}USDT`;
  }
  return `${base}${quote}`;
}

export function coinGeckoId(instrument: CanonInstrument): string | null {
  if (instrument.assetClass !== "crypto") {
    return null;
  }
  return COINGECKO_IDS[instrument.display] ?? null;
}

export function yahooChartSymbol(instrument: CanonInstrument): string | null {
  if (instrument.assetClass === "crypto") {
    return null;
  }
  if (instrument.assetClass === "fx") {
    const [base, quote] = instrument.display.split("/");
    if (!base || !quote) {
      return null;
    }
    return `${base}${quote}=X`;
  }
  if (instrument.assetClass === "index") {
    return YAHOO_INDEX[instrument.display] ?? null;
  }
  if (instrument.assetClass === "commodity") {
    return YAHOO_COMMODITY[instrument.display] ?? null;
  }
  return instrument.display;
}

function parseNumeric(value: unknown): string | undefined {
  if (value == null) {
    return undefined;
  }
  const trimmed = String(value).trim().replace(/,/g, "").replace(/^\+/, "");
  if (isEmptyPrice(trimmed) || !/^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(trimmed)) {
    return undefined;
  }
  const n = Number(trimmed);
  if (!Number.isFinite(n)) {
    return undefined;
  }
  return trimmed;
}

function parseTime(value: unknown): Date | undefined {
  if (value == null || value === "") {
    return undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const ms = value > 1e12 ? value : value * 1000;
    const at = new Date(ms);
    return Number.isNaN(at.getTime()) ? undefined : at;
  }
  if (typeof value === "string") {
    const asNum = Number(value);
    if (Number.isFinite(asNum) && value.trim() !== "") {
      return parseTime(asNum);
    }
    const at = new Date(value);
    return Number.isNaN(at.getTime()) ? undefined : at;
  }
  return undefined;
}

function httpOutcome(http: number): UpstreamOutcome["kind"] | null {
  return classifyHttpStatus(http, undefined);
}

export async function getPublicJson(url: string): Promise<{ http: number; body: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "joint-ledger/0.1",
      },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return { http: res.status, body };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { http: 504, body: null };
    }
    return { http: 502, body: null };
  } finally {
    clearTimeout(timer);
  }
}

function outcomeFromHttp(http: number, body: unknown): UpstreamOutcome | null {
  if (body == null && (http >= 500 || http === 0 || http === 408 || http === 504)) {
    return { kind: "upstream" };
  }
  const fromHttp = httpOutcome(http);
  if (fromHttp === "rate_limited" || fromHttp === "upstream") {
    return { kind: fromHttp };
  }
  if (fromHttp === "not_found") {
    return { kind: "not_found" };
  }
  if (fromHttp === "unauthorized" || fromHttp === "plan") {
    return { kind: "upstream" };
  }
  return null;
}

export function mapBinance24hr(body: unknown): UpstreamOutcome {
  if (!body || typeof body !== "object") {
    return { kind: "empty" };
  }
  const row = body as {
    lastPrice?: unknown;
    priceChange?: unknown;
    priceChangePercent?: unknown;
    closeTime?: unknown;
  };
  const last = parseNumeric(row.lastPrice);
  const quotedAt = parseTime(row.closeTime);
  if (!last || !quotedAt) {
    return { kind: "empty" };
  }
  const change = parseNumeric(row.priceChange);
  const lastN = Number(last);
  const changeN = change != null ? Number(change) : NaN;
  const previousClose =
    Number.isFinite(lastN) && Number.isFinite(changeN) ? String(lastN - changeN) : null;
  return {
    kind: "ok",
    last,
    percentChange: parseNumeric(row.priceChangePercent) ?? null,
    previousClose,
    quotedAt,
  };
}

export function mapCoinGeckoMarkets(body: unknown, id: string): UpstreamOutcome {
  const row = Array.isArray(body)
    ? body.find((item) => item && typeof item === "object" && (item as { id?: unknown }).id === id)
    : body && typeof body === "object"
      ? body
      : null;
  if (!row || typeof row !== "object") {
    return { kind: "empty" };
  }
  const coin = row as {
    current_price?: unknown;
    price_change_24h?: unknown;
    price_change_percentage_24h?: unknown;
    last_updated?: unknown;
  };
  const last = parseNumeric(coin.current_price);
  const quotedAt = parseTime(coin.last_updated);
  if (!last || !quotedAt) {
    return { kind: "empty" };
  }
  const change = parseNumeric(coin.price_change_24h);
  const lastN = Number(last);
  const changeN = change != null ? Number(change) : NaN;
  const previousClose =
    Number.isFinite(lastN) && Number.isFinite(changeN) ? String(lastN - changeN) : null;
  return {
    kind: "ok",
    last,
    percentChange: parseNumeric(coin.price_change_percentage_24h) ?? null,
    previousClose,
    quotedAt,
  };
}

function yahooMeta(body: unknown): Record<string, unknown> | null {
  if (!body || typeof body !== "object") {
    return null;
  }
  const chart = (body as { chart?: { result?: unknown; error?: unknown } }).chart;
  if (!chart || chart.error) {
    return null;
  }
  const result = Array.isArray(chart.result) ? chart.result[0] : null;
  if (!result || typeof result !== "object") {
    return null;
  }
  const meta = (result as { meta?: unknown }).meta;
  return meta && typeof meta === "object" ? (meta as Record<string, unknown>) : null;
}

export function mapYahooChartMeta(body: unknown): UpstreamOutcome {
  const meta = yahooMeta(body);
  if (!meta) {
    return { kind: "empty" };
  }
  const last = parseNumeric(meta.regularMarketPrice);
  const quotedAt = parseTime(meta.regularMarketTime);
  if (!last || !quotedAt) {
    return { kind: "empty" };
  }
  return {
    kind: "ok",
    last,
    percentChange: parseNumeric(meta.regularMarketChangePercent) ?? null,
    previousClose: parseNumeric(meta.previousClose ?? meta.chartPreviousClose) ?? null,
    quotedAt,
  };
}

function classifyPublicBody(
  http: number,
  body: unknown,
  map: (body: unknown) => UpstreamOutcome,
): UpstreamOutcome {
  const fromHttp = outcomeFromHttp(http, body);
  if (fromHttp) {
    return fromHttp;
  }
  if (body == null) {
    return { kind: "empty" };
  }
  return map(body);
}

async function fetchBinanceQuote(instrument: CanonInstrument): Promise<UpstreamOutcome> {
  const symbol = binanceSpotSymbol(instrument);
  if (!symbol) {
    return { kind: "empty" };
  }
  const url = `${BINANCE_PUBLIC_BASE}/ticker/24hr?symbol=${encodeURIComponent(symbol)}`;
  const { http, body } = await getPublicJson(url);
  return classifyPublicBody(http, body, mapBinance24hr);
}

async function fetchCoinGeckoQuote(instrument: CanonInstrument): Promise<UpstreamOutcome> {
  const id = coinGeckoId(instrument);
  if (!id) {
    return { kind: "empty" };
  }
  const url = `${COINGECKO_BASE}/coins/markets?vs_currency=usd&ids=${encodeURIComponent(id)}`;
  const { http, body } = await getPublicJson(url);
  return classifyPublicBody(http, body, (payload) => mapCoinGeckoMarkets(payload, id));
}

async function fetchYahooQuote(instrument: CanonInstrument): Promise<UpstreamOutcome> {
  const symbol = yahooChartSymbol(instrument);
  if (!symbol) {
    return { kind: "empty" };
  }
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d`;
  const { http, body } = await getPublicJson(url);
  return classifyPublicBody(http, body, mapYahooChartMeta);
}

function preferLastGoodFailure(first: UpstreamOutcome, second: UpstreamOutcome): UpstreamOutcome {
  if (first.kind === "rate_limited" || first.kind === "upstream") {
    return first;
  }
  if (second.kind === "rate_limited" || second.kind === "upstream") {
    return second;
  }
  return second.kind === "empty" ? first : second;
}

export async function fetchPublicQuote(instrument: CanonInstrument): Promise<PublicQuoteResult> {
  if (isDeniedSymbol(instrument.display) || isDeniedSymbol(instrument.tdSymbol)) {
    return { outcome: { kind: "denied" }, source: null, delayed: false };
  }
  if (getTwelveDataApiKey()) {
    return { outcome: { kind: "empty" }, source: null, delayed: false };
  }
  if (instrument.assetClass === "crypto") {
    const binance = await fetchBinanceQuote(instrument);
    if (binance.kind === "ok") {
      return { outcome: binance, source: "binance", delayed: false };
    }
    const gecko = await fetchCoinGeckoQuote(instrument);
    if (gecko.kind === "ok") {
      return { outcome: gecko, source: "coingecko", delayed: false };
    }
    const failure = preferLastGoodFailure(binance, gecko);
    return {
      outcome: failure,
      source: failure === gecko ? "coingecko" : "binance",
      delayed: false,
    };
  }
  const yahoo = await fetchYahooQuote(instrument);
  if (yahoo.kind === "ok") {
    return { outcome: yahoo, source: "yahoo", delayed: true };
  }
  return { outcome: yahoo, source: "yahoo", delayed: true };
}

export async function fetchPublicQuotes(
  instruments: CanonInstrument[],
): Promise<Map<string, PublicQuoteResult>> {
  const results = new Map<string, PublicQuoteResult>();
  for (const row of instruments) {
    results.set(row.display, await fetchPublicQuote(row));
  }
  return results;
}
