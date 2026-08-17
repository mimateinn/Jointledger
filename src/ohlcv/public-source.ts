import {
  BINANCE_PUBLIC_BASE,
  YAHOO_CHART_BASE,
  binanceSpotSymbol,
  getPublicJson,
  yahooChartSymbol,
} from "@/quotes/public-source";
import { isDeniedSymbol } from "@/quotes/symbol-map";
import { getTwelveDataApiKey } from "@/quotes/twelve-data";
import type { CanonInstrument } from "@/quotes/types";
import { TIME_SERIES_OUTPUT_SIZE } from "./constants";
import type { OhlcvBar, TimeSeriesOutcome } from "./types";

function utcDateFromMs(ms: number): string | null {
  if (!Number.isFinite(ms)) {
    return null;
  }
  const at = new Date(ms);
  if (Number.isNaN(at.getTime())) {
    return null;
  }
  return at.toISOString().slice(0, 10);
}

function parseBarNumber(value: unknown): number | null {
  if (value == null || value === "") {
    return null;
  }
  const n = typeof value === "number" ? value : Number(String(value).trim().replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

export function mapBinanceKlines(body: unknown): TimeSeriesOutcome {
  if (!Array.isArray(body) || body.length === 0) {
    return { kind: "empty" };
  }
  const bars: OhlcvBar[] = [];
  for (const row of body) {
    if (!Array.isArray(row) || row.length < 6) {
      continue;
    }
    const time = utcDateFromMs(Number(row[0]));
    const open = parseBarNumber(row[1]);
    const high = parseBarNumber(row[2]);
    const low = parseBarNumber(row[3]);
    const close = parseBarNumber(row[4]);
    if (!time || open == null || high == null || low == null || close == null) {
      continue;
    }
    bars.push({
      time,
      open,
      high,
      low,
      close,
      volume: parseBarNumber(row[5]) ?? 0,
    });
  }
  if (bars.length === 0) {
    return { kind: "empty" };
  }
  bars.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return { kind: "ok", bars };
}

export function mapYahooChartBars(body: unknown): TimeSeriesOutcome {
  if (!body || typeof body !== "object") {
    return { kind: "empty" };
  }
  const chart = (body as { chart?: { result?: unknown; error?: unknown } }).chart;
  if (!chart || chart.error) {
    return { kind: "empty" };
  }
  const result = Array.isArray(chart.result) ? chart.result[0] : null;
  if (!result || typeof result !== "object") {
    return { kind: "empty" };
  }
  const timestamps = (result as { timestamp?: unknown }).timestamp;
  const quote = (result as { indicators?: { quote?: unknown } }).indicators?.quote;
  const series = Array.isArray(quote) ? quote[0] : null;
  if (!Array.isArray(timestamps) || !series || typeof series !== "object") {
    return { kind: "empty" };
  }
  const open = (series as { open?: unknown }).open;
  const high = (series as { high?: unknown }).high;
  const low = (series as { low?: unknown }).low;
  const close = (series as { close?: unknown }).close;
  const volume = (series as { volume?: unknown }).volume;
  if (!Array.isArray(close)) {
    return { kind: "empty" };
  }
  const bars: OhlcvBar[] = [];
  for (let i = 0; i < timestamps.length; i += 1) {
    const ts = Number(timestamps[i]);
    const time = utcDateFromMs(ts > 1e12 ? ts : ts * 1000);
    const o = Array.isArray(open) ? parseBarNumber(open[i]) : null;
    const h = Array.isArray(high) ? parseBarNumber(high[i]) : null;
    const l = Array.isArray(low) ? parseBarNumber(low[i]) : null;
    const c = parseBarNumber(close[i]);
    if (!time || o == null || h == null || l == null || c == null) {
      continue;
    }
    bars.push({
      time,
      open: o,
      high: h,
      low: l,
      close: c,
      volume: Array.isArray(volume) ? (parseBarNumber(volume[i]) ?? 0) : 0,
    });
  }
  if (bars.length === 0) {
    return { kind: "empty" };
  }
  bars.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return { kind: "ok", bars };
}

function classifySeriesHttp(http: number, body: unknown): TimeSeriesOutcome | null {
  if (http === 429) {
    return { kind: "rate_limited" };
  }
  if (http === 404) {
    return { kind: "not_found" };
  }
  if (http === 408 || http === 504 || http >= 500 || http === 0) {
    return { kind: "upstream" };
  }
  if (body == null && http >= 400) {
    return { kind: "upstream" };
  }
  return null;
}

async function fetchBinanceKlines(instrument: CanonInstrument): Promise<TimeSeriesOutcome> {
  const symbol = binanceSpotSymbol(instrument);
  if (!symbol) {
    return { kind: "empty" };
  }
  const url = `${BINANCE_PUBLIC_BASE}/klines?symbol=${encodeURIComponent(symbol)}&interval=1d&limit=${TIME_SERIES_OUTPUT_SIZE}`;
  const { http, body } = await getPublicJson(url);
  return classifySeriesHttp(http, body) ?? mapBinanceKlines(body);
}

async function fetchYahooBars(instrument: CanonInstrument): Promise<TimeSeriesOutcome> {
  const symbol = yahooChartSymbol(instrument);
  if (!symbol) {
    return { kind: "empty" };
  }
  const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=2y`;
  const { http, body } = await getPublicJson(url);
  return classifySeriesHttp(http, body) ?? mapYahooChartBars(body);
}

export async function fetchPublicTimeSeries(instrument: CanonInstrument): Promise<TimeSeriesOutcome> {
  if (isDeniedSymbol(instrument.display) || isDeniedSymbol(instrument.tdSymbol)) {
    return { kind: "denied" };
  }
  if (getTwelveDataApiKey()) {
    return { kind: "empty" };
  }
  if (instrument.assetClass === "crypto") {
    return fetchBinanceKlines(instrument);
  }
  return fetchYahooBars(instrument);
}
