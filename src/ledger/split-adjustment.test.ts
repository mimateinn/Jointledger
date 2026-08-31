import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createAdjustment } from "./create-adjustment";
import { createBook } from "./create-book";
import { createCashFlow } from "./create-cash-flow";
import { createSplit } from "./create-split";
import { createTrade } from "./create-trade";
import { createMemoryStore } from "./memory-store";
import { openLotsFromTrades, summarizeLedger } from "./summary";

describe("stock split on open lots", () => {
  it("restates lot qty, keeps cost, and leaves the split visible", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
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
      occurredOn: "2024-06-10",
    });

    const trades = await store.listTrades(book.id);
    const allocations = await store.listTradeAllocations(book.id);
    const lots = openLotsFromTrades(trades, allocations);

    expect(lots).toHaveLength(1);
    expect(lots[0].quantity).toBe("20.00000000");
    expect(lots[0].costUsd).toBe("500.00000000");
    expect(lots[0].splitLabel).toBe("2:1");
    expect(trades.some((row) => row.side === "split" && row.note?.includes("2:1"))).toBe(true);
    const splitAlloc = allocations.find((row) => trades.find((trade) => trade.id === row.tradeId)?.side === "split");
    expect(splitAlloc?.costUsd).toBe("0.00000000");
    expect(splitAlloc?.proceedsUsd).toBe("0.00000000");
  });
});

describe("manual adjustment row", () => {
  it("writes one bookkeeping row that lists with its note", async () => {
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
    const { trade } = await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2024-03-15",
      note: "rounding",
      amountUsd: "1.25",
    });

    const trades = await store.listTrades(book.id);
    const allocations = await store.listTradeAllocations(book.id);
    const shown = trades.find((row) => row.id === trade.id);

    expect(shown).toMatchObject({
      side: "adjustment",
      note: "rounding",
    });
    expect(allocations.find((row) => row.tradeId === trade.id)?.proceedsUsd).toBe("1.25000000");
    expect(openLotsFromTrades(trades, allocations)).toHaveLength(0);

    const cashFlows = await store.listCashFlows(book.id);
    const snap = summarizeLedger(cashFlows, allocations, []);
    expect(snap.cashUsd.toFixed(2)).toBe("1001.25");
  });
});

describe("split and adjustment stay on the book path", () => {
  it("holdings show splitLabel and ledger shows adjustment side", () => {
    const holdings = readFileSync(join(process.cwd(), "src/components/holdings-workspace.tsx"), "utf8");
    const ledger = readFileSync(join(process.cwd(), "src/app/(app)/ledger/ledger-client.tsx"), "utf8");
    const labels = readFileSync(join(process.cwd(), "src/lib/format.ts"), "utf8");
    const entry = readFileSync(join(process.cwd(), "src/app/actions/entry.ts"), "utf8");
    expect(holdings).toContain("splitLabel");
    expect(holdings).toContain("拆股");
    expect(ledger).toContain("tradeSideLabel");
    expect(labels).toContain('side === "adjustment"');
    expect(entry).toContain("createAdjustment");
    expect(entry).toContain("createSplit");
    expect(entry).not.toMatch(/twelve|broker|helix/i);
  });
});
