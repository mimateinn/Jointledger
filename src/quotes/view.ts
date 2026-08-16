import { formatMoney } from "@/lib/format";
import { money } from "@/ledger/money";
import type { AssetClass, QuoteView } from "./types";
import type { CanonInstrument } from "./types";

export const DELAY_15 = "延遲 15 分";
export const DELAY_UPGRADE = "延遲／升級";
export const PARTIAL_NAV = "部分市值";

export function delayLabelFor(args: {
  last: string | null;
  planLimited: boolean;
  planHint?: boolean;
}): string {
  if (!args.last && (args.planLimited || args.planHint)) {
    return DELAY_UPGRADE;
  }
  return DELAY_15;
}

function numericString(value: string): string | null {
  const trimmed = value.trim().replace(/,/g, "").replace(/^\+/, "");
  if (!/^-?\d+(\.\d+)?$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

export function formatQuoteLast(last: string, assetClass: AssetClass): string {
  const parsed = numericString(last);
  if (!parsed) {
    return last;
  }
  const value = money(parsed);
  if (assetClass === "fx") {
    return formatMoney(value, 4);
  }
  if (assetClass === "crypto") {
    return formatMoney(value, value.gte(1000) ? 0 : 2);
  }
  return formatMoney(value, 2);
}

export function formatPercentChange(value: string | null): string | null {
  if (!value) {
    return null;
  }
  const parsed = numericString(value);
  if (!parsed) {
    return null;
  }
  const n = money(parsed);
  const abs = formatMoney(n.abs(), 2);
  if (n.gt(0)) {
    return `+${abs}%`;
  }
  if (n.lt(0)) {
    return `-${abs}%`;
  }
  return `${abs}%`;
}

export function formatLastUpdate(at: Date | null, now = new Date()): string | null {
  if (!at) {
    return null;
  }
  const delayMin = Math.max(0, Math.round((now.getTime() - at.getTime()) / 60_000));
  const clock = new Intl.DateTimeFormat("zh-Hant", {
    timeZone: "Asia/Hong_Kong",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(at);
  return `${clock} HKT · ${delayMin} 分前`;
}

export function toQuoteView(
  instrument: CanonInstrument,
  mark: { last: string | null; percentChange: string | null; fetchedAt?: Date | null; status?: string },
): QuoteView {
  const planLimited = mark.status === "plan" || (!mark.last && instrument.planHint);
  return {
    display: instrument.display,
    name: instrument.displayName,
    last: mark.last ? formatQuoteLast(mark.last, instrument.assetClass) : null,
    percentChange: mark.last ? formatPercentChange(mark.percentChange) : null,
    delayLabel: delayLabelFor({ last: mark.last, planLimited, planHint: instrument.planHint }),
    lastUpdateLabel: mark.last ? formatLastUpdate(mark.fetchedAt ?? null) : null,
    isEtfProxy: instrument.isEtfProxy,
    planLimited,
  };
}
