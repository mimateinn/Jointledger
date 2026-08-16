import { eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import { instruments, quoteRefreshState, quotes } from "@/db/schema";
import { TAPE_CANON } from "./symbol-map";
import type { CanonInstrument, QuoteRow, QuoteStatus } from "./types";

const STATE_ID = "pack";

export type RefreshState = {
  lastPackAt: Date | null;
  rateLimitedUntil: Date | null;
  creditUtcDate: string | null;
  creditsUsed: number;
};

export async function upsertInstruments(rows: CanonInstrument[]): Promise<Map<string, string>> {
  const db = getDb();
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

export async function loadQuoteRows(displays: string[]): Promise<Map<string, QuoteRow>> {
  const out = new Map<string, QuoteRow>();
  if (displays.length === 0) {
    return out;
  }
  const db = getDb();
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
      source: "twelve_data",
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
  },
): Promise<void> {
  const db = getDb();
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
      source: "twelve_data",
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
        source: "twelve_data",
      },
    });
}

export async function loadRefreshState(): Promise<RefreshState> {
  const db = getDb();
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

export async function saveRefreshState(state: RefreshState): Promise<void> {
  const db = getDb();
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
