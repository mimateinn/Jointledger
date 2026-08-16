import { TAPE_CANON, isDeniedSymbol, resolveInstrument } from "./symbol-map";
import { ensureQuotes, marksForDisplays, quoteRowsForDisplays } from "./refresh";
import { DELAY_15, toQuoteView } from "./view";
import type { QuoteView } from "./types";

export function emptyTapeViews(): {
  items: QuoteView[];
  fx: QuoteView | null;
  delayLabel: string;
} {
  const items = TAPE_CANON.map((instrument) =>
    toQuoteView(instrument, { last: null, percentChange: null, status: "no_key" }),
  );
  return {
    items,
    fx: items.find((item) => item.display === "USD/HKD") ?? null,
    delayLabel: DELAY_15,
  };
}

export async function refreshAndLoadTape(openLotSymbols: readonly string[] = []): Promise<{
  items: QuoteView[];
  fx: QuoteView | null;
  delayLabel: string;
}> {
  try {
    await ensureQuotes(openLotSymbols);
  } catch {
    return emptyTapeViews();
  }
  const rows = await quoteRowsForDisplays(TAPE_CANON.map((row) => row.display));
  const items = TAPE_CANON.map((instrument) => {
    const row = rows.get(instrument.display);
    return toQuoteView(instrument, {
      last: row?.last ?? null,
      percentChange: row?.percentChange ?? null,
      fetchedAt: row?.quotedAt ?? row?.fetchedAt ?? null,
      status: row?.status,
    });
  });
  const fx = items.find((item) => item.display === "USD/HKD") ?? null;
  const anyPrice = items.some((item) => item.last);
  return {
    items,
    fx,
    delayLabel: anyPrice ? DELAY_15 : items.some((item) => item.planLimited) ? items[0].delayLabel : DELAY_15,
  };
}

export async function loadMarksForLots(symbols: readonly string[]): Promise<{
  marks: Record<string, string | null>;
  views: Record<string, QuoteView>;
}> {
  await ensureQuotes(symbols);
  const unique = [...new Set(symbols.map((s) => s.trim().toUpperCase()).filter(Boolean))];
  const marks = await marksForDisplays(unique);
  const rows = await quoteRowsForDisplays(unique);
  const views: Record<string, QuoteView> = {};
  for (const display of unique) {
    const instrument = resolveInstrument(display);
    const row = rows.get(display);
    if (instrument) {
      views[display] = toQuoteView(instrument, {
        last: row?.last ?? null,
        percentChange: row?.percentChange ?? null,
        fetchedAt: row?.quotedAt ?? row?.fetchedAt ?? null,
        status: row?.status,
      });
    } else {
      views[display] = {
        display,
        name: null,
        last: null,
        percentChange: null,
        delayLabel: isDeniedSymbol(display) ? DELAY_15 : DELAY_15,
        lastUpdateLabel: null,
        isEtfProxy: false,
        planLimited: false,
      };
    }
  }
  return { marks, views };
}

export async function loadInstrumentView(code: string): Promise<QuoteView> {
  const display = code.trim().toUpperCase();
  await ensureQuotes([]);
  const instrument = resolveInstrument(display);
  const rows = await quoteRowsForDisplays([display]);
  const row = rows.get(display);
  if (!instrument) {
    return {
      display,
      name: null,
      last: null,
      percentChange: null,
      delayLabel: DELAY_15,
      lastUpdateLabel: null,
      isEtfProxy: false,
      planLimited: false,
    };
  }
  return toQuoteView(instrument, {
    last: row?.last ?? null,
    percentChange: row?.percentChange ?? null,
    fetchedAt: row?.quotedAt ?? row?.fetchedAt ?? null,
    status: row?.status,
  });
}
