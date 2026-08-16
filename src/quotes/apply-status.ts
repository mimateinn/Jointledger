import type { DisplayedMark, QuoteStatus, UpstreamOutcome } from "./types";

const LAST_GOOD_CALENDAR_DAYS = 7;

export function calendarDaysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

export function lastGoodStillFresh(fetchedAt: Date, now: Date): boolean {
  return calendarDaysBetween(fetchedAt, now) <= LAST_GOOD_CALENDAR_DAYS;
}

export function canUseLastGood(outcome: UpstreamOutcome): boolean {
  return outcome.kind === "rate_limited" || outcome.kind === "upstream";
}

export function resolveDisplayedMark(
  outcome: UpstreamOutcome,
  lastGood: { last: string; percentChange: string | null; fetchedAt: Date } | null,
  now: Date,
): DisplayedMark {
  if (outcome.kind === "ok") {
    return {
      last: outcome.last,
      percentChange: outcome.percentChange,
      usedLastGood: false,
      status: "ok",
    };
  }

  const status = outcome.kind as QuoteStatus;
  if (
    canUseLastGood(outcome) &&
    lastGood &&
    lastGood.last &&
    lastGoodStillFresh(lastGood.fetchedAt, now)
  ) {
    return {
      last: lastGood.last,
      percentChange: lastGood.percentChange,
      usedLastGood: true,
      status,
    };
  }

  return {
    last: null,
    percentChange: null,
    usedLastGood: false,
    status,
  };
}

export function classifyHttpStatus(http: number, code: number | undefined): UpstreamOutcome["kind"] | null {
  const n = code ?? http;
  if (n === 401) {
    return "unauthorized";
  }
  if (n === 403) {
    return "plan";
  }
  if (n === 404) {
    return "not_found";
  }
  if (n === 429) {
    return "rate_limited";
  }
  if (n === 408 || n === 504 || n >= 500) {
    return "upstream";
  }
  return null;
}

export function isEmptyPrice(value: string | null | undefined): boolean {
  if (value == null) {
    return true;
  }
  const trimmed = value.trim();
  return trimmed === "" || trimmed === "null" || trimmed === "undefined";
}
