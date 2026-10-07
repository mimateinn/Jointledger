import { describe, expect, it } from "vitest";
import { addMember } from "@/ledger/add-member";
import { createAdjustment } from "@/ledger/create-adjustment";
import { createBook } from "@/ledger/create-book";
import { createJointAccount } from "@/ledger/create-joint-account";
import { createMemoryStore } from "@/ledger/memory-store";
import { setAllocationSchedule } from "@/ledger/set-allocation-schedule";
import { buildExportPayload, transinfoCells } from "./export-payload";

describe("export adjustment / dividend amount", () => {
  it("writes joint dividend proceeds to buyTotal, not qty × price", async () => {
    const store = createMemoryStore();
    const { book, member: hey } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.6" },
        { memberId: sze.member.id, percent: "0.4" },
      ],
    });
    await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      occurredOn: "2024-07-01",
      note: "股息 MSFT",
      symbol: "MSFT",
      amountUsd: "100",
    });

    const payload = buildExportPayload({
      members: await store.listMembers(book.id),
      accounts: await store.listLedgerAccounts(book.id),
      cashFlows: await store.listCashFlows(book.id),
      trades: await store.listTrades(book.id),
      allocations: await store.listTradeAllocations(book.id),
    });
    const row = payload.transinfo.find((item) => item.kind === "adjustment");
    expect(row).toBeTruthy();
    expect(row?.quantity === "0" || row?.quantity.startsWith("0")).toBe(true);
    expect(row?.buyPrice).toBe("0");
    expect(row?.buyTotal).toBe("100");
    expect(transinfoCells(row!)).toContain("100");
  });

  it("writes a signed cost adjustment, not an unsigned zero", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2025-04-01",
      note: "rounding",
      amountUsd: "2.50",
    });
    await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      occurredOn: "2025-04-02",
      note: "fee",
      amountUsd: "-5",
    });
    const payload = buildExportPayload({
      members: await store.listMembers(book.id),
      accounts: await store.listLedgerAccounts(book.id),
      cashFlows: await store.listCashFlows(book.id),
      trades: await store.listTrades(book.id),
      allocations: await store.listTradeAllocations(book.id),
    });
    const rows = payload.transinfo.filter((item) => item.kind === "adjustment");
    expect(rows.map((row) => row.buyTotal)).toEqual(["2.5", "-5"]);
  });
});
