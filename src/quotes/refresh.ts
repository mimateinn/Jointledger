import { resolveDisplayedMark } from "./apply-status";
import { nextUtcMinute, packTtlMs, utcDateString } from "./market-hours";
import { withPackLock, type PackLockTx } from "./pack-lock";
import { buildUniverse, flightKey, isDeniedSymbol, resolveInstrument } from "./symbol-map";
import {
  loadQuoteRows,
  loadRefreshState,
  saveQuoteRow,
  saveRefreshState,
  upsertInstruments,
} from "./store";
import { fetchPublicQuotes, quotesVia } from "./public-source";
import { fetchTwelveDataBatch } from "./twelve-data";
import type { CanonInstrument, QuoteRow, QuoteStatus, UpstreamOutcome } from "./types";

const CREDIT_BUFFER = 40;
const inflight = new Map<string, Promise<void>>();
let packFlight: Promise<void> | null = null;

function dailyCreditCap(): number {
  const raw = process.env.TWELVE_DATA_DAILY_CREDIT_CAP?.trim();
  const n = raw ? Number(raw) : 800;
  return Number.isFinite(n) && n > 0 ? n : 800;
}

function outcomeToPersist(
  outcome: UpstreamOutcome,
  previous: QuoteRow | undefined,
  now: Date,
): {
  last: string | null;
  percentChange: string | null;
  previousClose: string | null;
  quotedAt: Date | null;
  status: QuoteStatus;
} {
  const displayed = resolveDisplayedMark(
    outcome,
    previous && previous.last
      ? { last: previous.last, percentChange: previous.percentChange, fetchedAt: previous.fetchedAt }
      : null,
    now,
  );
  if (outcome.kind === "ok") {
    return {
      last: outcome.last,
      percentChange: outcome.percentChange,
      previousClose: outcome.previousClose,
      quotedAt: outcome.quotedAt,
      status: "ok",
    };
  }
  return {
    last: displayed.last,
    percentChange: displayed.percentChange,
    previousClose: displayed.usedLastGood ? (previous?.previousClose ?? null) : null,
    quotedAt: displayed.usedLastGood ? (previous?.quotedAt ?? null) : null,
    status: displayed.status,
  };
}

function needsFetch(row: QuoteRow | undefined, now: Date, ttl: number, hasKey: boolean): boolean {
  if (!row) {
    return true;
  }
  if (hasKey && (row.status === "no_key" || row.status === "unauthorized")) {
    return true;
  }
  if (!hasKey && row.status === "no_key") {
    return true;
  }
  return now.getTime() - row.fetchedAt.getTime() >= ttl;
}

async function refreshUniverse(
  instruments: CanonInstrument[],
  now: Date,
  tx: PackLockTx,
): Promise<void> {
  const ids = await upsertInstruments(instruments, tx);
  const previous = await loadQuoteRows(
    instruments.map((row) => row.display),
    tx,
  );
  const state = await loadRefreshState(tx);
  const today = utcDateString(now);
  const creditsUsed = state.creditUtcDate === today ? state.creditsUsed : 0;
  const ttl = packTtlMs(now);
  const cap = dailyCreditCap();

  const via = quotesVia();
  if (via === "twelve_data" && state.rateLimitedUntil && state.rateLimitedUntil.getTime() > now.getTime()) {
    return;
  }

  const due: CanonInstrument[] = [];
  for (const row of instruments) {
    if (isDeniedSymbol(row.display) || isDeniedSymbol(row.tdSymbol)) {
      const id = ids.get(row.display);
      if (id) {
        await saveQuoteRow(
          id,
          {
            last: null,
            percentChange: null,
            previousClose: null,
            quotedAt: null,
            fetchedAt: now,
            status: "denied",
          },
          tx,
        );
      }
      continue;
    }
    if (needsFetch(previous.get(row.display), now, ttl, via === "twelve_data")) {
      due.push(row);
    }
  }

  if (due.length === 0) {
    await saveRefreshState(
      {
        lastPackAt: state.lastPackAt ?? now,
        rateLimitedUntil: state.rateLimitedUntil,
        creditUtcDate: today,
        creditsUsed,
      },
      tx,
    );
    return;
  }

  if (via === "twelve_data") {
    if (creditsUsed + due.length > cap - CREDIT_BUFFER) {
      return;
    }

    const { results, rateLimited, credits } = await fetchTwelveDataBatch(due);
    for (const row of due) {
      const id = ids.get(row.display);
      if (!id) {
        continue;
      }
      const outcome = results.get(row.display) ?? { kind: "empty" as const };
      const persist = outcomeToPersist(outcome, previous.get(row.display), now);
      await saveQuoteRow(id, { ...persist, fetchedAt: now, source: "twelve_data" }, tx);
    }

    await saveRefreshState(
      {
        lastPackAt: now,
        rateLimitedUntil: rateLimited ? nextUtcMinute(now) : state.rateLimitedUntil,
        creditUtcDate: today,
        creditsUsed: creditsUsed + credits,
      },
      tx,
    );
    return;
  }

  const publicHits = await fetchPublicQuotes(due);
  for (const row of due) {
    const id = ids.get(row.display);
    if (!id) {
      continue;
    }
    const hit = publicHits.get(row.display);
    const outcome = hit?.outcome ?? { kind: "empty" as const };
    const persist = outcomeToPersist(outcome, previous.get(row.display), now);
    await saveQuoteRow(
      id,
      {
        ...persist,
        fetchedAt: now,
        source: hit?.source ?? previous.get(row.display)?.source ?? "twelve_data",
      },
      tx,
    );
  }

  await saveRefreshState(
    {
      lastPackAt: now,
      rateLimitedUntil: state.rateLimitedUntil,
      creditUtcDate: today,
      creditsUsed,
    },
    tx,
  );
}

export async function ensureQuotes(openLotSymbols: readonly string[] = [], now = new Date()): Promise<void> {
  const universe = buildUniverse(openLotSymbols);
  const run = async () => {
    try {
      await withPackLock((tx) => refreshUniverse(universe, now, tx));
    } catch {
      // Render last-good / em-dash. Never fail the page.
    }
  };

  if (packFlight) {
    await packFlight;
    return;
  }
  packFlight = run().finally(() => {
    packFlight = null;
  });
  await packFlight;
}

export async function marksForDisplays(
  displays: readonly string[],
): Promise<Record<string, string | null>> {
  const wanted = [...new Set(displays.map((d) => d.trim().toUpperCase()).filter(Boolean))];
  const rows = await loadQuoteRows(wanted).catch(() => new Map<string, QuoteRow>());
  const marks: Record<string, string | null> = {};
  for (const display of wanted) {
    if (isDeniedSymbol(display) || !resolveInstrument(display)) {
      marks[display] = null;
      continue;
    }
    marks[display] = rows.get(display)?.last ?? null;
  }
  return marks;
}

export async function quoteRowsForDisplays(displays: readonly string[]): Promise<Map<string, QuoteRow>> {
  return loadQuoteRows([...new Set(displays)]).catch(() => new Map());
}

export function symbolFlightKey(instrument: CanonInstrument): string {
  return flightKey(instrument.tdSymbol, instrument.tdExchange);
}

export function takeInflight(key: string, task: Promise<void>): Promise<void> {
  const existing = inflight.get(key);
  if (existing) {
    return existing;
  }
  inflight.set(key, task.finally(() => inflight.delete(key)));
  return inflight.get(key)!;
}
