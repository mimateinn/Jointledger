import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addMember } from "./add-member";
import { createAdjustment } from "./create-adjustment";
import { createBook } from "./create-book";
import { createJointAccount } from "./create-joint-account";
import { createMemoryStore } from "./memory-store";
import { setAllocationSchedule } from "./set-allocation-schedule";
import { tradeCashAmountUsd, tradeMemberAmounts } from "./trade-amount";

describe("tradeCashAmountUsd", () => {
  it("reads adjustment / dividend proceeds instead of qty × price", async () => {
    const store = createMemoryStore();
    const { book, member: hey } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    const joint = await createJointAccount(store, { bookId: book.id });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.6" },
        { memberId: sze.member.id, percent: "0.4" },
      ],
    });
    const { trade, allocations } = await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      occurredOn: "2024-07-01",
      note: "股息 MSFT",
      symbol: "MSFT",
      amountUsd: "100",
    });

    expect(trade.quantity).toBe("0.00000000");
    expect(trade.price).toBe("0.00000000");
    expect(tradeCashAmountUsd({ side: trade.side, quantity: trade.quantity, price: trade.price })).toBe(
      "0.00000000",
    );
    expect(
      tradeCashAmountUsd({
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        allocations,
      }),
    ).toBe("100.00000000");
    const shares = tradeMemberAmounts({
      side: trade.side,
      quantity: trade.quantity,
      price: trade.price,
      allocations,
    });
    expect(shares.find((row) => row.memberId === hey.id)?.amountUsd).toBe("60.00000000");
    expect(shares.find((row) => row.memberId === sze.member.id)?.amountUsd).toBe("40.00000000");
  });

  it("shows a personal rounding adjustment as +2.50, not 0", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Member A",
    });
    const { trade, allocations } = await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2025-04-01",
      note: "rounding",
      amountUsd: "2.50",
    });
    expect(
      tradeCashAmountUsd({
        side: trade.side,
        quantity: trade.quantity,
        price: trade.price,
        allocations,
      }),
    ).toBe("2.50000000");
  });

  it("keeps buy amounts as qty × price and signed cost adjustments negative", () => {
    expect(
      tradeCashAmountUsd({ side: "buy", quantity: "10", price: "50" }),
    ).toBe("500.00000000");
    expect(
      tradeCashAmountUsd({
        side: "adjustment",
        allocations: [{ memberId: "a", costUsd: "5", proceedsUsd: "0" }],
      }),
    ).toBe("-5.00000000");
  });
});

describe("ledger amount wiring", () => {
  it("ledger page and table use tradeCashAmountUsd, not qty × price", () => {
    const page = readFileSync(join(process.cwd(), "src/app/(app)/ledger/page.tsx"), "utf8");
    const client = readFileSync(join(process.cwd(), "src/app/(app)/ledger/ledger-client.tsx"), "utf8");
    expect(page).toContain("tradeCashAmountUsd");
    expect(page).toContain("tradeMemberAmounts");
    expect(client).toContain("ledgerRowAmountUsd");
    expect(client).toContain("formatLedgerTradeAmount");
    expect(client).not.toMatch(/Number\(row\.quantity\) \* Number\(row\.price\)/);
  });
});
