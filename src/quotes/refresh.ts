import { resolveDisplayedMark } from "./apply-status";
import { nextUtcMinute, packTtlMs, utcDateString } from "./market-hours";
import { withPackLock, type PackLockTx } from "./pack-lock";
import { buildUniverse, flightKey, isDeniedSymbol, resolveInstrument } from "./symbol-map";
import {
  claimQuoteRefreshLease,
  clearLastGoodForDisplays,
  loadQuoteRows,
  loadRefreshState,
  releaseQuoteRefreshLease,
  saveQuoteRow,
  saveRefreshState,
  upsertInstruments,
} from "./store";
import { fetchPublicQuotes, quotesVia, type PublicQuoteResult } from "./public-source";
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

type PreparedRefresh = {
  ids: Map<string, string>;
  previous: Map<string, QuoteRow>;
  due: CanonInstrument[];
  via: "twelve_data" | "public";
  today: string;
  creditsUsed: number;
  state: Awaited<ReturnType<typeof loadRefreshState>>;
};

async function prepareRefresh(
  instruments: CanonInstrument[],
  now: Date,
  tx: PackLockTx,
  forceDisplays: readonly string[] = [],
): Promise<PreparedRefresh | null> {
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
    return null;
  }

  const forced = new Set(forceDisplays.map((d) => d.trim().toUpperCase()).filter(Boolean));
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
    if (forced.has(row.display) || needsFetch(previous.get(row.display), now, ttl, via === "twelve_data")) {
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
    return null;
  }

  if (via === "twelve_data" && creditsUsed + due.length > cap - CREDIT_BUFFER) {
    return null;
  }

  if (!(await claimQuoteRefreshLease(now, tx))) {
    return null;
  }

  return { ids, previous, due, via, today, creditsUsed, state };
}

async function persistRefresh(
  prepared: PreparedRefresh,
  fetched: {
    results: Map<string, UpstreamOutcome>;
    rateLimited: boolean;
    credits: number;
    publicHits?: Map<string, PublicQuoteResult>;
  },
  now: Date,
  tx: PackLockTx,
): Promise<void> {
  for (const row of prepared.due) {
    const id = prepared.ids.get(row.display);
    if (!id) {
      continue;
    }
    if (prepared.via === "twelve_data") {
      const outcome = fetched.results.get(row.display) ?? { kind: "empty" as const };
      const persist = outcomeToPersist(outcome, prepared.previous.get(row.display), now);
      await saveQuoteRow(id, { ...persist, fetchedAt: now, source: "twelve_data" }, tx);
      continue;
    }
    const hit = fetched.publicHits?.get(row.display);
    const outcome = hit?.outcome ?? { kind: "empty" as const };
    const persist = outcomeToPersist(outcome, prepared.previous.get(row.display), now);
    await saveQuoteRow(
      id,
      {
        ...persist,
        fetchedAt: now,
        source: hit?.source ?? prepared.previous.get(row.display)?.source ?? "twelve_data",
      },
      tx,
    );
  }

  await saveRefreshState(
    {
      lastPackAt: now,
      rateLimitedUntil: fetched.rateLimited ? nextUtcMinute(now) : prepared.state.rateLimitedUntil,
      creditUtcDate: prepared.today,
      creditsUsed: prepared.creditsUsed + fetched.credits,
    },
    tx,
  );
  await releaseQuoteRefreshLease(tx);
}

export async function ensureQuotes(
  openLotSymbols: readonly string[] = [],
  now = new Date(),
  options?: { forceDisplays?: readonly string[] },
): Promise<void> {
  const universe = buildUniverse(openLotSymbols);
  const run = async () => {
    let claimed = false;
    try {
      const prepared = await withPackLock((tx) =>
        prepareRefresh(universe, now, tx, options?.forceDisplays),
      );
      if (!prepared) {
        return;
      }
      claimed = true;
      if (prepared.via === "twelve_data") {
        const { results, rateLimited, credits } = await fetchTwelveDataBatch(prepared.due);
        await withPackLock((tx) =>
          persistRefresh(prepared, { results, rateLimited, credits }, now, tx),
        );
        claimed = false;
        return;
      }
      const publicHits = await fetchPublicQuotes(prepared.due);
      await withPackLock((tx) =>
        persistRefresh(
          prepared,
          { results: new Map(), rateLimited: false, credits: 0, publicHits },
          now,
          tx,
        ),
      );
      claimed = false;
    } catch {
      if (claimed) {
        await withPackLock((tx) => releaseQuoteRefreshLease(tx)).catch(() => undefined);
      }
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

export async function refreshLastGoodAfterSplit(
  displays: readonly string[],
  now = new Date(),
): Promise<void> {
  const wanted = [...new Set(displays.map((d) => d.trim().toUpperCase()).filter(Boolean))];
  await clearLastGoodForDisplays(wanted);
  await ensureQuotes(wanted, now, { forceDisplays: wanted });
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
