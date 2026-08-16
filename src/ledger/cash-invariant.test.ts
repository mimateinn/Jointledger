import { Decimal } from "decimal.js";
import { describe, expect, it } from "vitest";
import { addMember } from "./add-member";
import { createBook } from "./create-book";
import { createCashFlow } from "./create-cash-flow";
import { createTrade } from "./create-trade";
import { createMemoryStore } from "./memory-store";
import { openLotsFromTrades, summarizeLedger } from "./summary";

async function snapshot(store: ReturnType<typeof createMemoryStore>, bookId: string) {
  const cashFlows = await store.listCashFlows(bookId);
  const trades = await store.listTrades(bookId);
  const allocations = await store.listTradeAllocations(bookId);
  const lots = openLotsFromTrades(trades, allocations);
  return summarizeLedger(cashFlows, allocations, lots);
}

describe("cash invariant", () => {
  it("keeps NAV at 1000 after deposit 1000 and buy 10 @ 50", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });

    const empty = await snapshot(store, book.id);
    expect(empty.cashUsd.toString()).toBe("0");
    expect(empty.openValueUsd.toString()).toBe("0");
    expect(empty.navUsd.toString()).toBe("0");

    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });

    const afterDeposit = await snapshot(store, book.id);
    expect(afterDeposit.cashUsd.toFixed(2)).toBe("1000.00");
    expect(afterDeposit.openValueUsd.toFixed(2)).toBe("0.00");
    expect(afterDeposit.navUsd.toFixed(2)).toBe("1000.00");

    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });

    const afterBuy = await snapshot(store, book.id);
    expect(afterBuy.cashUsd.toFixed(2)).toBe("500.00");
    expect(afterBuy.openValueUsd.toFixed(2)).toBe("500.00");
    expect(afterBuy.navUsd.toFixed(2)).toBe("1000.00");
    expect(afterBuy.navUsd.toFixed(2)).not.toBe("1500.00");
  });

  it("fails the forbidden NAV = cash-flows-only + open cost reading", async () => {
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
    const wrongNav = cashFlows
      .reduce((sum, row) => sum.plus(row.amountUsd), new Decimal(0))
      .plus(lots.reduce((sum, lot) => sum.plus(lot.costUsd), new Decimal(0)));

    const right = summarizeLedger(cashFlows, allocations, lots);
    expect(wrongNav.toFixed(2)).toBe("1500.00");
    expect(right.navUsd.toFixed(2)).toBe("1000.00");
    expect(right.navUsd.eq(wrongNav)).toBe(false);
  });

  it("shares write APIs for a later-added member", async () => {
    const store = createMemoryStore();
    const { book } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const { member, account } = await addMember(store, {
      bookId: book.id,
      displayName: "Sze",
    });
    expect(member.displayName).toBe("Sze");
    expect(account.kind).toBe("personal");
  });
});
