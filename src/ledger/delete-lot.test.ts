import { describe, expect, it } from "vitest";
import { createBook } from "./create-book";
import { createCashFlow } from "./create-cash-flow";
import { createTrade } from "./create-trade";
import { deleteLot } from "./delete-lot";
import { createMemoryStore } from "./memory-store";
import { openLotsFromTrades, positionLotsFromTrades, summarizeLedger } from "./summary";

async function snapshot(store: ReturnType<typeof createMemoryStore>, bookId: string) {
  const cashFlows = await store.listCashFlows(bookId);
  const trades = await store.listTrades(bookId);
  const allocations = await store.listTradeAllocations(bookId);
  const lots = openLotsFromTrades(trades, allocations);
  return { cashFlows, trades, allocations, lots, snap: summarizeLedger(cashFlows, allocations, lots) };
}

describe("delete lot", () => {
  it("deleting a buy lot restores cash to the deposit", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-demo",
      creatorDisplayName: "小明",
      creatorEmail: "demo@example.com",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    const { trade } = await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });

    const afterBuy = await snapshot(store, book.id);
    expect(afterBuy.snap.cashUsd.toFixed(2)).toBe("500.00");
    expect(afterBuy.lots).toHaveLength(1);

    await deleteLot(store, { bookId: book.id, tradeId: trade.id, memberId: member.id });

    const afterDelete = await snapshot(store, book.id);
    expect(afterDelete.lots).toHaveLength(0);
    expect(afterDelete.trades).toHaveLength(0);
    expect(afterDelete.snap.cashUsd.toFixed(2)).toBe("1000.00");
    expect(afterDelete.snap.navUsd.toFixed(2)).toBe("1000.00");
  });

  it("deleting a closed lot removes buy and sell and keeps the invariant", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-demo",
      creatorDisplayName: "小明",
      creatorEmail: "demo@example.com",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    const { trade } = await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "60",
      occurredOn: "2024-02-01",
      side: "sell",
      proceedsUsd: "600",
    });

    const closed = positionLotsFromTrades(
      await store.listTrades(book.id),
      await store.listTradeAllocations(book.id),
    );
    expect(closed).toHaveLength(1);
    expect(closed[0].closed).toBe(true);

    await deleteLot(store, { bookId: book.id, tradeId: trade.id, memberId: member.id });
    const after = await snapshot(store, book.id);
    expect(after.trades).toHaveLength(0);
    expect(after.snap.cashUsd.toFixed(2)).toBe("1000.00");
  });
});
