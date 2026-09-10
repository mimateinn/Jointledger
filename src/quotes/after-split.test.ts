import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createSplit } from "@/ledger/create-split";
import { createTrade } from "@/ledger/create-trade";
import { createMemoryStore } from "@/ledger/memory-store";
import { openLotsFromTrades, summarizeLedger } from "@/ledger/summary";
import { clearedLastGoodFields } from "./store";

describe("after split last-good", () => {
  it("cleared last-good never writes cost into quotes.last", () => {
    const fields = clearedLastGoodFields(new Date("2026-08-16T00:00:00Z"));
    expect(fields.last).toBeNull();
    expect(fields.percentChange).toBeNull();
    expect(fields.previousClose).toBeNull();
    expect(fields.status).toBe("empty");
    expect(JSON.stringify(fields)).not.toMatch(/cost/i);
  });

  it("NAV without last excludes the restated lot (partial)", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });
    await createSplit(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      newShares: "2",
      oldShares: "1",
      occurredOn: "2024-01-03",
    });
    const cashFlows = await store.listCashFlows(book.id);
    const allocations = await store.listTradeAllocations(book.id);
    const lots = openLotsFromTrades(await store.listTrades(book.id), allocations);
    expect(Number(lots[0].quantity)).toBe(20);
    const snap = summarizeLedger(cashFlows, allocations, lots);
    expect(snap.partial).toBe(true);
    expect(snap.openValueUsd.toFixed(2)).toBe("0.00");
    expect(snap.navUsd.toFixed(2)).toBe("500.00");
    expect(snap.navUsd.toFixed(2)).not.toBe(lots[0].costUsd);
  });

  it("clear → forceDisplays refresh is wired; quote fail must not break bookkeeping", () => {
    const store = readFileSync(join(process.cwd(), "src/quotes/store.ts"), "utf8");
    expect(store).toContain("clearLastGoodForDisplays");
    expect(store).toContain("clearedLastGoodFields");
    expect(store).not.toMatch(/quotes\.last.*cost|costUsd.*quotes\.last/);

    const refresh = readFileSync(join(process.cwd(), "src/quotes/refresh.ts"), "utf8");
    expect(refresh).toContain("forceDisplays");
    expect(refresh).toContain("refreshLastGoodAfterSplit");
    expect(refresh).toContain("clearLastGoodForDisplays");

    const service = readFileSync(join(process.cwd(), "src/quotes/service.ts"), "utf8");
    expect(service).toContain("refreshMarksAfterSplit");
    expect(service).toContain("refreshLastGoodAfterSplit");

    const entry = readFileSync(join(process.cwd(), "src/app/actions/entry.ts"), "utf8");
    const bookkeeping = entry.slice(entry.indexOf("export async function createBookkeepingAction"));
    expect(bookkeeping.indexOf("createSplit")).toBeLessThan(bookkeeping.indexOf("refreshMarksAfterSplit"));
    expect(bookkeeping).toMatch(/try\s*\{\s*await refreshMarksAfterSplit/);
  });
});
