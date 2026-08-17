import { Decimal } from "decimal.js";
import { money } from "@/ledger/money";

/** Stored allocation legs are unit fractions (0–1). Display as percent. */
export function formatSchedulePercent(percent: string): string {
  return `${money(percent).mul(100).toFixed(1)}%`;
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

/** Clock next to NAV, e.g. 截至 21:04 */
export function formatAsOfClock(now = new Date()): string {
  const clock = new Intl.DateTimeFormat("zh-Hant", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(now);
  return `截至 ${clock}`;
}

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
