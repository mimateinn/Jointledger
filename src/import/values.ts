import { money } from "@/ledger/money";

const ISO = /^(\d{4})-(\d{1,2})-(\d{1,2})$/;
const SLASH = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/;

export function parseDate(raw: string): string | null {
  const value = raw.trim();
  if (!value) {
    return null;
  }
  const iso = ISO.exec(value);
  if (iso) {
    return ymd(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }
  const slash = SLASH.exec(value);
  if (slash) {
    const day = Number(slash[1]);
    const month = Number(slash[2]);
    let year = Number(slash[3]);
    if (year < 100) {
      year += year >= 70 ? 1900 : 2000;
    }
    // HK sheets are D/M/Y. If first part > 12 it must be day.
    if (day > 12 && month <= 12) {
      return ymd(year, month, day);
    }
    if (month > 12 && day <= 12) {
      return ymd(year, day, month);
    }
    return ymd(year, month, day);
  }
  return null;
}

function ymd(year: number, month: number, day: number): string | null {
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function parseMoney(raw: string): string | null {
  const value = raw.trim().replace(/[,$\s]/g, "").replace(/港元|美元|hkd|usd/gi, "");
  if (!value) {
    return null;
  }
  const signed = value.replace(/^\((.+)\)$/, "-$1");
  try {
    return money(signed).toString();
  } catch {
    return null;
  }
}

export function extractTickers(detail: string): string[] {
  const text = detail.trim();
  if (!text) {
    return [];
  }
  const found = new Set<string>();
  const re = /\b([A-Z]{1,5}(?:\.[A-Z]{1,3})?|\d{4}\.HK)\b/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text))) {
    found.add(match[1].toUpperCase());
  }
  if (/^[A-Z0-9.]{1,10}$/i.test(text)) {
    found.add(text.toUpperCase());
  }
  return [...found];
}

export function parseInOut(raw: string, amount: string | null): "deposit" | "withdrawal" {
  const token = raw.trim().toLowerCase();
  if (["out", "出", "withdrawal", "withdraw", "-", "debit"].includes(token)) {
    return "withdrawal";
  }
  if (["in", "入", "deposit", "+", "credit"].includes(token)) {
    return "deposit";
  }
  if (amount && amount.startsWith("-")) {
    return "withdrawal";
  }
  return "deposit";
}

export function absMoney(value: string): string {
  return money(value).abs().toString();
}
