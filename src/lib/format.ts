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

export function todayIso(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
