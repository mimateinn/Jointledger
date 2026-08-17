import { eq, inArray } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import { instruments, quoteRefreshState, quotes } from "@/db/tables";
import { TAPE_CANON } from "./symbol-map";
import type { CanonInstrument, QuoteRow, QuoteSource, QuoteStatus } from "./types";

function asQuoteSource(value: string): QuoteSource {
  if (value === "binance" || value === "coingecko" || value === "yahoo" || value === "twelve_data") {
    return value;
  }
  return "twelve_data";
}

export type QuoteExecutor = Pick<Database, "insert" | "select" | "update">;

const STATE_ID = "pack";

export type RefreshState = {
  lastPackAt: Date | null;
  rateLimitedUntil: Date | null;
  creditUtcDate: string | null;
  creditsUsed: number;
};

export async function upsertInstruments(
  rows: CanonInstrument[],
  db: QuoteExecutor = getDb(),
): Promise<Map<string, string>> {
  const ids = new Map<string, string>();
  for (const row of rows) {
    const existing = await db
      .select()
      .from(instruments)
      .where(eq(instruments.displayCode, row.display))
      .limit(1);
    if (existing[0]) {
      await db
        .update(instruments)
        .set({
          displayName: row.displayName,
          assetClass: row.assetClass,
          market: row.market,
          tdSymbol: row.tdSymbol,
          tdExchange: row.tdExchange,
          isEtfProxy: row.isEtfProxy,
          tapeSlot: row.tapeSlot,
          planHint: row.planHint,
        })
        .where(eq(instruments.id, existing[0].id));
      ids.set(row.display, existing[0].id);
      continue;
    }
    const inserted = await db
      .insert(instruments)
      .values({
        displayCode: row.display,
        displayName: row.displayName,
        assetClass: row.assetClass,
        market: row.market,
        tdSymbol: row.tdSymbol,
        tdExchange: row.tdExchange,
        isEtfProxy: row.isEtfProxy,
        tapeSlot: row.tapeSlot,
        planHint: row.planHint,
      })
      .returning({ id: instruments.id });
    ids.set(row.display, inserted[0].id);
  }
  return ids;
}

export async function loadQuoteRows(
  displays: string[],
  db: QuoteExecutor = getDb(),
): Promise<Map<string, QuoteRow>> {
  const out = new Map<string, QuoteRow>();
  if (displays.length === 0) {
    return out;
  }
  const inst = await db.select().from(instruments).where(inArray(instruments.displayCode, displays));
  if (inst.length === 0) {
    return out;
  }
  const byId = new Map(inst.map((row) => [row.id, row]));
  const rows = await db
    .select()
    .from(quotes)
    .where(
      inArray(
        quotes.instrumentId,
        inst.map((row) => row.id),
      ),
    );
  for (const row of rows) {
    const meta = byId.get(row.instrumentId);
    if (!meta) {
      continue;
    }
    out.set(meta.displayCode, {
      display: meta.displayCode,
      last: row.last,
      percentChange: row.percentChange,
      previousClose: row.previousClose,
      quotedAt: row.quotedAt,
      fetchedAt: row.fetchedAt,
      delaySeconds: row.delaySeconds,
      status: row.status as QuoteStatus,
      source: asQuoteSource(row.source),
    });
  }
  return out;
}

export async function saveQuoteRow(
  instrumentId: string,
  row: {
    last: string | null;
    percentChange: string | null;
    previousClose: string | null;
    quotedAt: Date | null;
    fetchedAt: Date;
    status: QuoteStatus;
    source?: QuoteSource;
  },
  db: QuoteExecutor = getDb(),
): Promise<void> {
  const source = row.source ?? "twelve_data";
  await db
    .insert(quotes)
    .values({
      instrumentId,
      last: row.last,
      percentChange: row.percentChange,
      previousClose: row.previousClose,
      quotedAt: row.quotedAt,
      fetchedAt: row.fetchedAt,
      delaySeconds: 900,
      status: row.status,
      source,
    })
    .onConflictDoUpdate({
      target: quotes.instrumentId,
      set: {
        last: row.last,
        percentChange: row.percentChange,
        previousClose: row.previousClose,
        quotedAt: row.quotedAt,
        fetchedAt: row.fetchedAt,
        delaySeconds: 900,
        status: row.status,
        source,
      },
    });
}

export async function loadRefreshState(db: QuoteExecutor = getDb()): Promise<RefreshState> {
  const [row] = await db.select().from(quoteRefreshState).where(eq(quoteRefreshState.id, STATE_ID)).limit(1);
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

export async function saveRefreshState(
  state: RefreshState,
  db: QuoteExecutor = getDb(),
): Promise<void> {
  await db
    .insert(quoteRefreshState)
    .values({
      id: STATE_ID,
      lastPackAt: state.lastPackAt,
      rateLimitedUntil: state.rateLimitedUntil,
      creditUtcDate: state.creditUtcDate,
      creditsUsed: state.creditsUsed,
    })
    .onConflictDoUpdate({
      target: quoteRefreshState.id,
      set: {
        lastPackAt: state.lastPackAt,
        rateLimitedUntil: state.rateLimitedUntil,
        creditUtcDate: state.creditUtcDate,
        creditsUsed: state.creditsUsed,
      },
    });
}

export async function seedTapeInstruments(): Promise<void> {
  await upsertInstruments([...TAPE_CANON]);
}
