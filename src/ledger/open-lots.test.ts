import { describe, expect, it } from "vitest";
import { createBook } from "./create-book";
import { createTrade } from "./create-trade";
import { createMemoryStore } from "./memory-store";
import { openLotsFromTrades } from "./summary";

describe("open lots FIFO", () => {
  it("closes a buy when a matching sell is written", async () => {
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
      costUsd: "500",
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
    const lots = openLotsFromTrades(await store.listTrades(book.id), await store.listTradeAllocations(book.id));
    expect(lots).toHaveLength(0);
  });
});
