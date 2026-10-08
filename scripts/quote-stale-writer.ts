import { saveQuoteRow } from "../src/quotes/store";
import type { QuoteStatus } from "../src/quotes/types";

async function main() {
  const instrumentId = process.argv[2];
  const mode = process.argv[3];
  const base = Number(process.argv[4] ?? "");
  if (!instrumentId || (mode !== "fresh" && mode !== "stale") || !Number.isFinite(base)) {
    throw new Error("usage: tsx scripts/quote-stale-writer.ts <instrumentId> fresh|stale <baseMs>");
  }

  const status: QuoteStatus = "ok";
  for (let i = 0; i < 14; i += 1) {
    const fetchedAt = new Date(mode === "fresh" ? base + i * 1000 : base - (i + 1) * 1000);
    await saveQuoteRow(instrumentId, {
      last: `${mode}-${i}`,
      percentChange: null,
      previousClose: null,
      quotedAt: fetchedAt,
      fetchedAt,
      status,
      source: "yahoo",
    });
  }
}

void main();
