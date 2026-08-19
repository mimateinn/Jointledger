import { describe, expect, it } from "vitest";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createTrade } from "@/ledger/create-trade";
import { createMemoryStore } from "@/ledger/memory-store";
import { money } from "@/ledger/money";
import { addMember } from "@/ledger/add-member";
import { createJointAccount } from "@/ledger/create-joint-account";
import { setAllocationSchedule } from "@/ledger/set-allocation-schedule";
import { averageCapital, flowWeight, modifiedDietz, periodPnlUsd } from "./dietz";
import { buildReturnsReport } from "./report";
import { snapshotAt, startAsOf } from "./snapshot";

describe("Modified Dietz", () => {
  it("period $ = end NAV − start NAV − external CF; buys/sells are not CF", () => {
    const pnl = periodPnlUsd("1600", "0", "1500");
    expect(pnl.toFixed(2)).toBe("100.00");
  });

  it("weights a mid-window deposit by remaining time; does not annualize a 30-day window", () => {
    expect(flowWeight("2024-01-01", "2024-01-31", "2024-01-01").toFixed(4)).toBe("1.0000");
    expect(flowWeight("2024-01-01", "2024-01-31", "2024-01-16").toFixed(4)).toBe("0.5000");
    expect(flowWeight("2024-01-01", "2024-01-31", "2024-01-31").toFixed(4)).toBe("0.0000");

    const capital = averageCapital(
      "0",
      [
        { occurredOn: "2024-01-01", amountUsd: "1000" },
        { occurredOn: "2024-01-16", amountUsd: "500" },
      ],
      "2024-01-01",
      "2024-01-31",
    );
    expect(capital.toFixed(2)).toBe("1250.00");

    const result = modifiedDietz({
      startNavUsd: "0",
      endNavUsd: "1600",
      flows: [
        { occurredOn: "2024-01-01", amountUsd: "1000" },
        { occurredOn: "2024-01-16", amountUsd: "500" },
      ],
      periodStart: "2024-01-01",
      periodEnd: "2024-01-31",
      missingMark: false,
    });
    expect(result.periodPnlUsd).toBe(money("100").toFixed(8));
    expect(result.dietzPercent).not.toBeNull();
    expect(money(result.dietzPercent!).toFixed(2)).toBe("8.00");
    expect(result.dietzPercent).not.toMatch(/365|年化/);
  });

  it("missing start/end mark → $ from available marks, % = —; never cost-as-price", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試",
      createdByUserId: "u1",
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
    const ledger = {
      cashFlows: await store.listCashFlows(book.id),
      trades: await store.listTrades(book.id),
      allocations: await store.listTradeAllocations(book.id),
    };
    const unmarked = snapshotAt(ledger, "2024-01-31", {}, member.id);
    expect(unmarked.partial).toBe(true);
    expect(unmarked.navUsd).toBe(money("500").toFixed(8));
    expect(unmarked.navUsd).not.toBe(money("1000").toFixed(8));

    const report = buildReturnsReport({
      ledger,
      marks: {},
      members: [member],
      periodKey: "custom",
      today: "2024-01-31",
      customStart: "2024-01-01",
      customEnd: "2024-01-31",
    });
    expect(report.book.periodPnlUsd).toBe(money("-500").toFixed(8));
    expect(report.book.dietzPercent).toBeNull();
    expect(report.book.percentBlocked).toBe("missing_mark");
    expect(report.members[0].dietzPercent).toBeNull();
  });

  it("deposit 1000, buy, mid-window deposit: $ and Dietz from last-good, not cost", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "測試",
      createdByUserId: "u1",
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
      occurredOn: "2024-01-16",
    });
    const ledger = {
      cashFlows: await store.listCashFlows(book.id),
      trades: await store.listTrades(book.id),
      allocations: await store.listTradeAllocations(book.id),
    };
    const report = buildReturnsReport({
      ledger,
      marks: { NVDA: "60" },
      members: [member],
      periodKey: "custom",
      today: "2024-01-31",
      customStart: "2024-01-01",
      customEnd: "2024-01-31",
    });
    expect(report.book.startNavUsd).toBe(money("0").toFixed(8));
    expect(report.book.endNavUsd).toBe(money("1600").toFixed(8));
    expect(report.book.externalCfUsd).toBe(money("1500").toFixed(8));
    expect(report.book.periodPnlUsd).toBe(money("100").toFixed(8));
    expect(money(report.book.dietzPercent!).toFixed(2)).toBe("8.00");
    expect(report.book.endNavUsd).not.toBe(money("1500").toFixed(8));
  });

  it("average capital ≈ 0 → $ only, % = —", () => {
    const result = modifiedDietz({
      startNavUsd: "0",
      endNavUsd: "0",
      flows: [],
      periodStart: "2024-01-01",
      periodEnd: "2024-01-31",
      missingMark: false,
    });
    expect(result.periodPnlUsd).toBe(money("0").toFixed(8));
    expect(result.dietzPercent).toBeNull();
    expect(result.percentBlocked).toBe("zero_capital");
  });

  it("splits joint lots by buy-date schedule; Wah stays off the joint line", async () => {
    const store = createMemoryStore();
    const { book, member: hey, account: heyAccount } = await createBook(store, {
      name: "測試",
      createdByUserId: "u1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    const wah = await addMember(store, { bookId: book.id, displayName: "Wah" });
    const joint = await createJointAccount(store, { bookId: book.id });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "50" },
        { memberId: sze.member.id, percent: "50" },
      ],
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: hey.id,
      ledgerAccountId: heyAccount.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: sze.member.id,
      ledgerAccountId: sze.account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createTrade(store, {
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
    const ledger = {
      cashFlows: await store.listCashFlows(book.id),
      trades: await store.listTrades(book.id),
      allocations: await store.listTradeAllocations(book.id),
    };
    const report = buildReturnsReport({
      ledger,
      marks: { NVDA: "60" },
      members: [hey, sze.member, wah.member],
      periodKey: "custom",
      today: "2024-01-31",
      customStart: "2024-01-01",
      customEnd: "2024-01-31",
    });
    expect(report.members).toHaveLength(3);
    const heyRow = report.members.find((row) => row.displayName === "Hey")!;
    const szeRow = report.members.find((row) => row.displayName === "Sze")!;
    const wahRow = report.members.find((row) => row.displayName === "Wah")!;
    expect(heyRow.periodPnlUsd).toBe(money("50").toFixed(8));
    expect(szeRow.periodPnlUsd).toBe(money("50").toFixed(8));
    expect(wahRow.periodPnlUsd).toBe(money("0").toFixed(8));
    expect(wahRow.endNavUsd).toBe(money("0").toFixed(8));
    expect(startAsOf("2024-01-01")).toBe("2023-12-31");
  });
});
