import { Decimal } from "decimal.js";
import { money } from "@/ledger/money";

/** Stored allocation legs are unit fractions (0–1). Display as percent. */
export function formatSchedulePercent(percent: string): string {
  return `${money(percent).mul(100).toFixed(1)}%`;
}

/** Joint share fraction (0–1) → display percent. Empty/null → —. */
export function formatSharePercent(fraction: string | null | undefined): string {
  if (fraction == null || fraction.trim() === "") {
    return "—";
  }
  return formatSchedulePercent(fraction);
}

export function formatMoney(value: string | Decimal, scale = 2): string {
  const fixed = money(value).toFixed(scale);
  const negative = fixed.startsWith("-");
  const unsigned = negative ? fixed.slice(1) : fixed;
  const [int, frac] = unsigned.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac !== undefined ? `${grouped}.${frac}` : grouped;
  return negative ? `-${body}` : body;
}

/** Quantity: 10 not 10.0000. Keeps significant decimals only. */
export function formatQty(value: string | Decimal): string {
  const trimmed = money(value).toFixed(4).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
  const negative = trimmed.startsWith("-");
  const unsigned = negative ? trimmed.slice(1) : trimmed;
  const [int, frac] = unsigned.split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = frac !== undefined ? `${grouped}.${frac}` : grouped;
  return negative ? `-${body}` : body;
}

/** Site-wide USD figures: currency + thousands + decimals. */
export function formatUsd(value: string | Decimal, scale = 2): string {
  const n = money(value);
  if (n.lt(0)) {
    return `-US$ ${formatMoney(n.abs(), scale)}`;
  }
  return `US$ ${formatMoney(n, scale)}`;
}

export function formatHkd(value: string | Decimal, scale = 2): string {
  const n = money(value);
  if (n.lt(0)) {
    return `-HK$ ${formatMoney(n.abs(), scale)}`;
  }
  return `HK$ ${formatMoney(n, scale)}`;
}

export function formatSignedUsd(value: string | Decimal, scale = 2): string {
  const n = money(value);
  const body = formatMoney(n.abs(), scale);
  if (n.gt(0)) {
    return `+US$ ${body}`;
  }
  if (n.lt(0)) {
    return `-US$ ${body}`;
  }
  return `US$ ${body}`;
}

function hktDateKey(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Hong_Kong",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Calendar dates: 今天／昨天 when recent (HKT). */
export function formatRelativeDate(iso: string, now = new Date()): string {
  const day = iso.slice(0, 10);
  const today = hktDateKey(now);
  if (day === today) {
    return "今天";
  }
  const todayNoon = new Date(`${today}T12:00:00+08:00`);
  const yesterday = hktDateKey(new Date(todayNoon.getTime() - 86_400_000));
  if (day === yesterday) {
    return "昨天";
  }
  return day;
}

export const NO_MARKET_PRICE = "暫時用買入價，未有市場價";

/** 今日: % when there is a last price (0.00% if the move is zero); else buy-price sentence. */
export function todayChangeLabel(last: string | null | undefined, percentChange: string | null | undefined): string {
  if (!last) {
    return NO_MARKET_PRICE;
  }
  if (!percentChange || percentChange === "—") {
    return "0.00%";
  }
  return percentChange;
}

/** Clock next to NAV from the quote's fetched_at, e.g. 截至 21:04 */
export function formatAsOfClock(fetchedAt: Date): string {
  const clock = new Intl.DateTimeFormat("zh-Hant", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(fetchedAt);
  return `截至 ${clock}`;
}

export const STALE_QUOTE_AS_OF = "上次報價";

export function formatQuoteAsOf(fetchedAt: Date | null | undefined, stale = false): string {
  if (!fetchedAt) {
    return "";
  }
  const clock = formatAsOfClock(fetchedAt);
  return stale ? `${clock} · ${STALE_QUOTE_AS_OF}` : clock;
}

export function tradeSideLabel(side: string): string {
  if (side === "buy") {
    return "買入";
  }
  if (side === "sell") {
    return "賣出";
  }
  if (side === "split") {
    return "拆股";
  }
  if (side === "adjustment") {
    return "調整";
  }
  return side;
}

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Display and stored calendar dates stay YYYY-MM-DD. */
export const ISO_DATE_INPUT = "\\d{4}-\\d{2}-\\d{2}";
export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
export const ISO_DATE_INVALID = "日期要係有效嘅 YYYY-MM-DD";

function calendarParts(value: string): { year: number; month: number; day: number } | null {
  if (!ISO_DATE_PATTERN.test(value)) {
    return null;
  }
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  const utc = new Date(Date.UTC(year, month - 1, day));
  if (utc.getUTCFullYear() !== year || utc.getUTCMonth() !== month - 1 || utc.getUTCDate() !== day) {
    return null;
  }
  return { year, month, day };
}

/** YYYY-MM-DD and a real calendar day (rejects 2026-13-45, 2025-02-29). */
export function isIsoDate(value: string): boolean {
  return calendarParts(value) !== null;
}

export function requireIsoDate(value: string): string {
  if (!calendarParts(value.trim())) {
    throw new Error(ISO_DATE_INVALID);
  }
  return value.trim();
}
