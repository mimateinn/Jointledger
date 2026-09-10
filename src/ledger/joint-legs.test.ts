import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { addMember } from "./add-member";
import { createBook } from "./create-book";
import { createJointAccount } from "./create-joint-account";
import { createTrade } from "./create-trade";
import { jointTradeLegs } from "./joint-legs";
import { createMemoryStore } from "./memory-store";
import { setAllocationSchedule } from "./set-allocation-schedule";
import { jointShareFraction, openLotsFromTrades } from "./summary";

describe("jointTradeLegs", () => {
  it("splits quantity and cost by the schedule in force", () => {
    const legs = jointTradeLegs({
      scheduleLegs: [
        { memberId: "hey", percent: "0.4" },
        { memberId: "sze", percent: "0.6" },
      ],
      members: [{ id: "hey" }, { id: "sze" }],
      quantity: "10",
      total: "500",
    });
    expect(legs).toHaveLength(2);
    expect(legs[0]).toMatchObject({ memberId: "hey", quantity: "4.00000000", costUsd: "200.00000000" });
    expect(legs[1]).toMatchObject({ memberId: "sze", quantity: "6.00000000", costUsd: "300.00000000" });
  });

  it("falls back to equal members when there is no schedule", () => {
    const legs = jointTradeLegs({
      scheduleLegs: null,
      members: [{ id: "a" }, { id: "b" }],
      quantity: "10",
      total: "500",
    });
    expect(legs[0].quantity).toBe("5.00000000");
    expect(legs[1].quantity).toBe("5.00000000");
    expect(legs[0].costUsd).toBe("250.00000000");
    expect(legs[1].costUsd).toBe("250.00000000");
  });
});

describe("joint buy write path", () => {
  it("createTrade on a joint account writes schedule legs, not a single member", async () => {
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
        { memberId: hey.id, percent: "0.4" },
        { memberId: sze.member.id, percent: "0.6" },
      ],
    });

    const { trade, allocations } = await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });

    expect(allocations).toHaveLength(2);
    expect(allocations.map((row) => row.memberId).sort()).toEqual([hey.id, sze.member.id].sort());
    const heyAlloc = allocations.find((row) => row.memberId === hey.id);
    const szeAlloc = allocations.find((row) => row.memberId === sze.member.id);
    expect(heyAlloc?.quantity).toBe("4.00000000");
    expect(heyAlloc?.costUsd).toBe("200.00000000");
    expect(szeAlloc?.quantity).toBe("6.00000000");
    expect(szeAlloc?.costUsd).toBe("300.00000000");

    const lots = openLotsFromTrades(await store.listTrades(book.id), allocations);
    expect(lots).toHaveLength(2);
    expect(jointShareFraction(allocations, trade.id, hey.id)).not.toBeNull();
  });

  it("createBuyAction does not fall back to ctx.member.id for joint books", () => {
    const entry = readFileSync(join(process.cwd(), "src/app/actions/entry.ts"), "utf8");
    const buy = entry.slice(
      entry.indexOf("export async function createBuyAction"),
      entry.indexOf("export async function createBookkeepingAction"),
    );
    expect(buy).toContain('account.kind === "joint"');
    expect(buy).not.toMatch(/account\?\.memberId \?\? ctx\.member\.id/);
    expect(buy).toContain("createTrade");
  });
});
