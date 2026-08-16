import { and, asc, eq, sql } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { ohlcvBars, ohlcvFetchState, quoteRefreshState } from "@/db/schema";
import { utcDateString } from "@/quotes/market-hours";
import { CLIENT_BAR_LIMIT } from "./constants";
import type { OhlcvBar, OhlcvFetchState, OhlcvStatus, SharedCreditState } from "./types";

export type OhlcvExecutor = Pick<Database, "insert" | "select" | "update" | "execute">;

const CREDIT_STATE_ID = "pack";

export function exchangeKey(exchange: string | null): string {
  return exchange ?? "";
}

export async function loadCachedBars(
  tdSymbol: string,
  exchange: string | null,
  db: OhlcvExecutor = getDb(),
): Promise<OhlcvBar[]> {
  const rows = await db
    .select()
    .from(ohlcvBars)
    .where(and(eq(ohlcvBars.tdSymbol, tdSymbol), eq(ohlcvBars.tdExchange, exchangeKey(exchange))))
    .orderBy(asc(ohlcvBars.barDate));
  const bars = rows.map((row) => ({
    time: row.barDate,
    open: Number(row.open),
    high: Number(row.high),
    low: Number(row.low),
    close: Number(row.close),
    volume: Number(row.volume),
  }));
  return bars.length > CLIENT_BAR_LIMIT ? bars.slice(-CLIENT_BAR_LIMIT) : bars;
}

export async function saveCachedBars(
  tdSymbol: string,
  exchange: string | null,
  bars: OhlcvBar[],
  fetchedAt: Date,
  db: OhlcvExecutor = getDb(),
): Promise<void> {
  const ex = exchangeKey(exchange);
  for (const bar of bars) {
    await db
      .insert(ohlcvBars)
      .values({
        tdSymbol,
        tdExchange: ex,
        barDate: bar.time,
        open: String(bar.open),
        high: String(bar.high),
        low: String(bar.low),
        close: String(bar.close),
        volume: String(bar.volume),
        fetchedAt,
      })
      .onConflictDoUpdate({
        target: [ohlcvBars.tdSymbol, ohlcvBars.tdExchange, ohlcvBars.barDate],
        set: {
          open: String(bar.open),
          high: String(bar.high),
          low: String(bar.low),
          close: String(bar.close),
          volume: String(bar.volume),
          fetchedAt,
        },
      });
  }
}

export async function loadFetchState(
  tdSymbol: string,
  exchange: string | null,
  db: OhlcvExecutor = getDb(),
): Promise<OhlcvFetchState | null> {
  const [row] = await db
    .select()
    .from(ohlcvFetchState)
    .where(
      and(eq(ohlcvFetchState.tdSymbol, tdSymbol), eq(ohlcvFetchState.tdExchange, exchangeKey(exchange))),
    )
    .limit(1);
  if (!row) {
    return null;
  }
  return {
    lastFetchUtcDate: row.lastFetchUtcDate,
    lastStatus: row.lastStatus as OhlcvStatus,
    lastAttemptAt: row.lastAttemptAt,
  };
}

export async function saveFetchState(
  tdSymbol: string,
  exchange: string | null,
  state: OhlcvFetchState,
  db: OhlcvExecutor = getDb(),
): Promise<void> {
  const ex = exchangeKey(exchange);
  await db
    .insert(ohlcvFetchState)
    .values({
      tdSymbol,
      tdExchange: ex,
      lastFetchUtcDate: state.lastFetchUtcDate,
      lastStatus: state.lastStatus,
      lastAttemptAt: state.lastAttemptAt,
    })
    .onConflictDoUpdate({
      target: [ohlcvFetchState.tdSymbol, ohlcvFetchState.tdExchange],
      set: {
        lastFetchUtcDate: state.lastFetchUtcDate,
        lastStatus: state.lastStatus,
        lastAttemptAt: state.lastAttemptAt,
      },
    });
}

export async function loadSharedCredits(db: OhlcvExecutor = getDb()): Promise<SharedCreditState> {
  const [row] = await db
    .select()
    .from(quoteRefreshState)
    .where(eq(quoteRefreshState.id, CREDIT_STATE_ID))
    .limit(1);
  if (!row) {
    return { lastPackAt: null, rateLimitedUntil: null, creditUtcDate: null, creditsUsed: 0 };
  }
  return {
    lastPackAt: row.lastPackAt,
    rateLimitedUntil: row.rateLimitedUntil,
    creditUtcDate: row.creditUtcDate,
    creditsUsed: row.creditsUsed,
  };
}

export async function addSharedCredits(
  used: number,
  now: Date,
  rateLimited: boolean,
  db: OhlcvExecutor = getDb(),
): Promise<void> {
  const today = utcDateString(now);
  const rateLimitedUntil = rateLimited
    ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), now.getUTCHours(), now.getUTCMinutes() + 1))
    : null;
  await db.execute(sql`
    insert into quote_refresh_state (id, credit_utc_date, credits_used, rate_limited_until)
    values (${CREDIT_STATE_ID}, ${today}, ${used}, ${rateLimitedUntil})
    on conflict (id) do update set
      credit_utc_date = ${today},
      credits_used = case
        when quote_refresh_state.credit_utc_date = ${today}
        then quote_refresh_state.credits_used + ${used}
        else ${used}
      end,
      rate_limited_until = coalesce(${rateLimitedUntil}, quote_refresh_state.rate_limited_until)
  `);
}
