import { classifyHttpStatus, isEmptyPrice } from "./apply-status";
import { isDeniedSymbol, toTwelveDataQuery } from "./symbol-map";
import type { CanonInstrument, UpstreamOutcome } from "./types";

const TD_BASE = "https://api.twelvedata.com";
const TIMEOUT_MS = 8_000;

export function getTwelveDataApiKey(): string | null {
  const key = process.env.TWELVE_DATA_API_KEY?.trim();
  return key ? key : null;
}

type TdError = {
  code?: number;
  status?: string;
  message?: string;
};

type TdQuote = TdError & {
  symbol?: string;
  close?: string;
  previous_close?: string;
  percent_change?: string;
  datetime?: string;
  timestamp?: number;
};

function looksLikePlanMessage(message: string | undefined): boolean {
  if (!message) {
    return false;
  }
  return /plan|upgrade|subscribe|premium|grow|pro/i.test(message);
}

export function classifyTwelveDataBody(http: number, body: unknown): UpstreamOutcome {
  if (body == null) {
    return { kind: http >= 500 || http === 0 ? "upstream" : "empty" };
  }
  if (typeof body !== "object") {
    return { kind: "upstream" };
  }
  const row = body as TdQuote;
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
  if (isEmptyPrice(row.close)) {
    return { kind: "empty" };
  }
  const last = row.close!.trim().replace(/,/g, "").replace(/^\+/, "");
  if (!/^-?\d+(\.\d+)?$/.test(last)) {
    return { kind: "empty" };
  }
  const quotedAt =
    typeof row.timestamp === "number"
      ? new Date(row.timestamp * 1000)
      : row.datetime
        ? new Date(row.datetime)
        : null;
  return {
    kind: "ok",
    last,
    percentChange: row.percent_change?.trim().replace(/^\+/, "") || null,
    previousClose: row.previous_close?.trim() || null,
    quotedAt: quotedAt && !Number.isNaN(quotedAt.getTime()) ? quotedAt : null,
  };
}

async function tdQuoteRequest(
  symbol: string,
  exchange: string | null,
): Promise<{ http: number; body: unknown }> {
  const key = getTwelveDataApiKey();
  if (!key) {
    return { http: 401, body: { code: 401, status: "error", message: "no key" } };
  }
  const url = new URL("/quote", TD_BASE);
  url.searchParams.set("symbol", symbol);
  if (exchange) {
    url.searchParams.set("exchange", exchange);
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "GET",
      headers: { Authorization: `apikey ${key}` },
      cache: "no-store",
      signal: controller.signal,
    });
    const body = await res.json().catch(() => null);
    return { http: res.status, body };
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      return { http: 504, body: { code: 504, status: "error", message: "timeout" } };
    }
    return { http: 502, body: { code: 502, status: "error", message: "upstream" } };
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchTwelveDataQuote(instrument: CanonInstrument): Promise<UpstreamOutcome> {
  if (isDeniedSymbol(instrument.display) || isDeniedSymbol(instrument.tdSymbol)) {
    return { kind: "denied" };
  }
  if (!getTwelveDataApiKey()) {
    return { kind: "no_key" };
  }
  const query = toTwelveDataQuery(instrument);
  const { http, body } = await tdQuoteRequest(query.symbol, query.exchange);
  return classifyTwelveDataBody(http, body);
}

type BatchGroup = { exchange: string | null; instruments: CanonInstrument[] };

export function groupForBatch(instruments: CanonInstrument[]): BatchGroup[] {
  const groups = new Map<string, BatchGroup>();
  for (const row of instruments) {
    if (isDeniedSymbol(row.display) || isDeniedSymbol(row.tdSymbol)) {
      continue;
    }
    const key = row.tdExchange ?? "";
    const group = groups.get(key) ?? { exchange: row.tdExchange, instruments: [] };
    group.instruments.push(row);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export async function fetchTwelveDataBatch(
  instruments: CanonInstrument[],
): Promise<{ results: Map<string, UpstreamOutcome>; rateLimited: boolean; credits: number }> {
  const results = new Map<string, UpstreamOutcome>();
  if (!getTwelveDataApiKey()) {
    for (const row of instruments) {
      results.set(row.display, { kind: "no_key" });
    }
    return { results, rateLimited: false, credits: 0 };
  }

  let rateLimited = false;
  let credits = 0;
  for (const group of groupForBatch(instruments)) {
    if (rateLimited) {
      for (const row of group.instruments) {
        if (!results.has(row.display)) {
          results.set(row.display, { kind: "rate_limited" });
        }
      }
      continue;
    }
    const symbols = group.instruments.map((row) => toTwelveDataQuery(row).symbol).join(",");
    credits += group.instruments.length;
    const { http, body } = await tdQuoteRequest(symbols, group.exchange);
    if (http === 429 || (body && typeof body === "object" && (body as TdError).code === 429)) {
      rateLimited = true;
      for (const row of group.instruments) {
        results.set(row.display, { kind: "rate_limited" });
      }
      continue;
    }
    if (group.instruments.length === 1) {
      results.set(group.instruments[0].display, classifyTwelveDataBody(http, body));
      continue;
    }
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      const outcome = classifyTwelveDataBody(http, body);
      for (const row of group.instruments) {
        results.set(row.display, outcome);
      }
      continue;
    }
    const map = body as Record<string, unknown>;
    for (const row of group.instruments) {
      const piece = map[row.tdSymbol] ?? map[row.display];
      results.set(row.display, piece ? classifyTwelveDataBody(http, piece) : { kind: "empty" });
    }
  }
  for (const row of instruments) {
    if (isDeniedSymbol(row.display) || isDeniedSymbol(row.tdSymbol)) {
      results.set(row.display, { kind: "denied" });
    } else if (!results.has(row.display)) {
      results.set(row.display, { kind: "empty" });
    }
  }
  return { results, rateLimited, credits };
}
