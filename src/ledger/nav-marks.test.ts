import { describe, expect, it } from "vitest";
import { createBook } from "./create-book";
import { createCashFlow } from "./create-cash-flow";
import { createTrade } from "./create-trade";
import { createMemoryStore } from "./memory-store";
import { lotMarketValue, openLotsFromTrades, summarizeLedger } from "./summary";

async function seeded() {
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
  const cashFlows = await store.listCashFlows(book.id);
  const allocations = await store.listTradeAllocations(book.id);
  const lots = openLotsFromTrades(await store.listTrades(book.id), allocations);
  return { cashFlows, allocations, lots };
}

describe("NAV marks", () => {
  it("marks 10 shares at 60 → NAV 1100 (cash 500 + MV 600)", async () => {
    const { cashFlows, allocations, lots } = await seeded();
    const snap = summarizeLedger(cashFlows, allocations, lots, { NVDA: "60" });
    expect(snap.cashUsd.toFixed(2)).toBe("500.00");
    expect(snap.openValueUsd.toFixed(2)).toBe("600.00");
    expect(snap.navUsd.toFixed(2)).toBe("1100.00");
    expect(snap.partial).toBe(false);
    expect(snap.navUsd.toFixed(2)).not.toBe("1500.00");
    expect(snap.navUsd.toFixed(2)).not.toBe("1000.00");
  });

  it("without a mark: row excluded, NAV is cash only and labeled partial", async () => {
    const { cashFlows, allocations, lots } = await seeded();
    const snap = summarizeLedger(cashFlows, allocations, lots);
    expect(snap.cashUsd.toFixed(2)).toBe("500.00");
    expect(snap.openValueUsd.toFixed(2)).toBe("0.00");
    expect(snap.navUsd.toFixed(2)).toBe("500.00");
    expect(snap.partial).toBe(true);
    expect(snap.unmarkedLotCount).toBe(1);
    expect(lotMarketValue(lots[0].quantity, null)).toBeNull();
    expect(snap.navUsd.toFixed(2)).not.toBe("1000.00");
    expect(snap.navUsd.toFixed(2)).not.toBe("1500.00");
  });

  it("does not fill cost when only some lots are marked", async () => {
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
    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "500",
      fxRate: "1",
      occurredOn: "2024-01-03",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "AAPL",
      quantity: "5",
      price: "20",
      occurredOn: "2024-01-04",
    });
    const cashFlows = await store.listCashFlows(book.id);
    const allocations = await store.listTradeAllocations(book.id);
    const lots = openLotsFromTrades(await store.listTrades(book.id), allocations);
    const snap = summarizeLedger(cashFlows, allocations, lots, { NVDA: "60" });
    expect(snap.cashUsd.toFixed(2)).toBe("900.00");
    expect(snap.openValueUsd.toFixed(2)).toBe("600.00");
    expect(snap.navUsd.toFixed(2)).toBe("1500.00");
    expect(snap.partial).toBe(true);
    expect(snap.markedLotCount).toBe(1);
    expect(snap.unmarkedLotCount).toBe(1);
  });
});
