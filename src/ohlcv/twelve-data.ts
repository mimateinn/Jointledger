import { classifyHttpStatus } from "@/quotes/apply-status";
import { getTwelveDataApiKey } from "@/quotes/twelve-data";
import { isDeniedSymbol, toTwelveDataQuery } from "@/quotes/symbol-map";
import type { CanonInstrument } from "@/quotes/types";
import {
  TD_BASE,
  TIME_SERIES_INTERVAL,
  TIME_SERIES_OUTPUT_SIZE,
  TIME_SERIES_PATH,
  TIME_SERIES_TIMEOUT_MS,
} from "./constants";
import type { OhlcvBar, TimeSeriesOutcome } from "./types";

type TdError = {
  code?: number;
  status?: string;
  message?: string;
};

type TdBar = {
  datetime?: string;
  open?: string;
  high?: string;
  low?: string;
  close?: string;
  volume?: string;
};

type TdTimeSeries = TdError & {
  values?: TdBar[];
};

function looksLikePlanMessage(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  return /plan|upgrade|subscribe|premium|grow|pro/i.test(message);
}

function parseNumber(value: string | undefined): number | null {
  if (value == null) {
    return null;
  }
  const trimmed = value.trim().replace(/,/g, "");
  if (trimmed === "" || trimmed === "null") {
    return null;
  }
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

export function parseTimeSeriesBars(values: TdBar[] | undefined): OhlcvBar[] {
  if (!values || values.length === 0) {
    return [];
  }
  const bars: OhlcvBar[] = [];
  for (const row of values) {
    const time = row.datetime?.trim().slice(0, 10);
    const open = parseNumber(row.open);
    const high = parseNumber(row.high);
    const low = parseNumber(row.low);
    const close = parseNumber(row.close);
    if (!time || !/^\d{4}-\d{2}-\d{2}$/.test(time)) {
      continue;
    }
    if (open == null || high == null || low == null || close == null) {
      continue;
    }
    const volume = parseNumber(row.volume) ?? 0;
    bars.push({ time, open, high, low, close, volume });
  }
  bars.sort((a, b) => (a.time < b.time ? -1 : a.time > b.time ? 1 : 0));
  return bars;
}

export function classifyTimeSeriesBody(http: number, body: unknown): TimeSeriesOutcome {
  if (body == null) {
    return { kind: http >= 500 || http === 0 ? "upstream" : "empty" };
  }
  if (typeof body !== "object") {
    return { kind: "upstream" };
  }
  const row = body as TdTimeSeries;
  const fromHttp = classifyHttpStatus(http, row.code);
  if (fromHttp === "unauthorized") {
    return { kind: "unauthorized" };
  }
  if (fromHttp === "plan" || (row.status === "error" && looksLikePlanMessage(row.message))) {
    return { kind: "plan" };
  }
  if (fromHttp === "not_found") {
    return { kind: "not_found" };
  }
  if (fromHttp === "rate_limited") {
    return { kind: "rate_limited" };
  }
  if (fromHttp === "upstream") {
    return { kind: "upstream" };
  }
  if (row.status === "error") {
    if (looksLikePlanMessage(row.message)) {
      return { kind: "plan" };
    }
    if (row.code === 400 || row.code === 404) {
      return { kind: "not_found" };
    }
    return { kind: "upstream" };
  }
  const bars = parseTimeSeriesBars(row.values);
  if (bars.length === 0) {
    return { kind: "empty" };
  }
  return { kind: "ok", bars };
}

export function buildTimeSeriesUrl(symbol: string, exchange: string | null): URL {
  const url = new URL(TIME_SERIES_PATH, TD_BASE);
  url.searchParams.set("symbol", symbol);
  url.searchParams.set("interval", TIME_SERIES_INTERVAL);
  url.searchParams.set("outputsize", String(TIME_SERIES_OUTPUT_SIZE));
  if (exchange) {
    url.searchParams.set("exchange", exchange);
  }
  return url;
}

export async function fetchTwelveDataTimeSeries(
  instrument: CanonInstrument,
): Promise<TimeSeriesOutcome> {
  if (isDeniedSymbol(instrument.display) || isDeniedSymbol(instrument.tdSymbol)) {
    return { kind: "denied" };
  }
  const key = getTwelveDataApiKey();
  if (!key) {
    return { kind: "no_key" };
  }
  const query = toTwelveDataQuery(instrument);
  const url = buildTimeSeriesUrl(query.symbol, query.exchange);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIME_SERIES_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `apikey ${key}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return classifyTimeSeriesBody(res.status, body);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { kind: "upstream" };
    }
    return { kind: "upstream" };
  } finally {
    clearTimeout(timer);
  }
}
