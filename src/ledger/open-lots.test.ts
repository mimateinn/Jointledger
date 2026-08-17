import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { lotRowKey } from "@/lib/lot-row-key";
import { addMember } from "./add-member";
import { createBook } from "./create-book";
import { createJointAccount } from "./create-joint-account";
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

  it("joint buy writes two lots that share tradeId; row key uses memberId", async () => {
    const store = createMemoryStore();
    const { book, member: hey } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    const joint = await createJointAccount(store, { bookId: book.id });
    const { trade } = await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
      legs: [
        { memberId: hey.id, quantity: "5", costUsd: "250" },
        { memberId: sze.member.id, quantity: "5", costUsd: "250" },
      ],
    });
    const lots = openLotsFromTrades(await store.listTrades(book.id), await store.listTradeAllocations(book.id));
    expect(lots).toHaveLength(2);
    expect(lots.every((lot) => lot.tradeId === trade.id)).toBe(true);
    expect(new Set(lots.map((lot) => lot.tradeId)).size).toBe(1);
    const keys = lots.map(lotRowKey);
    expect(keys).toEqual([`${trade.id}:${hey.id}`, `${trade.id}:${sze.member.id}`]);
    expect(new Set(keys).size).toBe(2);
  });

  it("overview and holdings do not key joint lots by tradeId alone", () => {
    const overview = readFileSync(join(process.cwd(), "src/app/(app)/overview/overview-client.tsx"), "utf8");
    const holdings = readFileSync(join(process.cwd(), "src/components/holdings-workspace.tsx"), "utf8");
    expect(overview).toContain("lotRowKey(lot)");
    expect(overview).not.toMatch(/key=\{lot\.tradeId\}/);
    expect(holdings).toContain("lotRowKey(lot)");
    expect(holdings).not.toMatch(/key=\{lot\.tradeId\}/);
  });
});
