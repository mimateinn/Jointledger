import { describe, expect, it } from "vitest";
import { createAdjustment } from "./create-adjustment";
import { createBook } from "./create-book";
import { createCashFlow } from "./create-cash-flow";
import { createSplit } from "./create-split";
import { createTrade } from "./create-trade";
import { deleteEntry } from "./delete-entry";
import { createMemoryStore } from "./memory-store";
import { openLotsFromTrades, summarizeLedger } from "./summary";

async function snap(store: ReturnType<typeof createMemoryStore>, bookId: string) {
  const cashFlows = await store.listCashFlows(bookId);
  const trades = await store.listTrades(bookId);
  const allocations = await store.listTradeAllocations(bookId);
  const lots = openLotsFromTrades(trades, allocations);
  return { cashFlows, trades, allocations, lots, ledger: summarizeLedger(cashFlows, allocations, lots) };
}

describe("deleteEntry", () => {
  it("removes one cash flow and leaves the rest", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Member A",
    });
    const first = await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "200",
      fxRate: "1",
      occurredOn: "2024-01-02",
    });

    await deleteEntry(store, { bookId: book.id, kind: "cash", id: first.id });
    const after = await snap(store, book.id);
    expect(after.cashFlows).toHaveLength(1);
    expect(after.cashFlows[0]?.amountHkd).toBe("200.00000000");
    expect(after.ledger.cashUsd.toFixed(2)).toBe("200.00");
  });

  it("removes one trade plus its allocations without touching other rows", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Member A",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    const buy = await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "AAPL",
      quantity: "2",
      price: "100",
      occurredOn: "2024-02-01",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "1",
      price: "50",
      occurredOn: "2024-02-02",
    });

    await deleteEntry(store, { bookId: book.id, kind: "trade", id: buy.trade.id });
    const after = await snap(store, book.id);
    expect(after.trades.map((row) => row.symbol)).toEqual(["NVDA"]);
    expect(after.lots).toHaveLength(1);
    expect(after.ledger.cashUsd.toFixed(2)).toBe("950.00");
  });

  it("can remove a split or adjustment row", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Member A",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "AAPL",
      quantity: "10",
      price: "10",
      occurredOn: "2024-02-01",
    });
    const split = await createSplit(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "AAPL",
      newShares: "2",
      oldShares: "1",
      occurredOn: "2024-03-01",
    });
    const adj = await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2024-04-01",
      note: "股息 AAPL",
      amountUsd: "3",
    });

    await deleteEntry(store, { bookId: book.id, kind: "trade", id: split.trade.id });
    await deleteEntry(store, { bookId: book.id, kind: "trade", id: adj.trade.id });
    const after = await snap(store, book.id);
    expect(after.trades.every((row) => row.side === "buy")).toBe(true);
    expect(after.lots[0]?.quantity).toBe("10.00000000");
  });

  it("rejects an id that is not in the book", async () => {
    const store = createMemoryStore();
    const { book } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Member A",
    });
    await expect(deleteEntry(store, { bookId: book.id, kind: "cash", id: "missing" })).rejects.toThrow(
      "搵唔到呢筆記錄",
    );
  });
});
