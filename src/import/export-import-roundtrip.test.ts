import { describe, expect, it, vi } from "vitest";
import { addMember } from "@/ledger/add-member";
import { createAdjustment } from "@/ledger/create-adjustment";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createJointAccount } from "@/ledger/create-joint-account";
import { createMemoryStore } from "@/ledger/memory-store";
import { createSplit } from "@/ledger/create-split";
import { createTrade } from "@/ledger/create-trade";
import { money } from "@/ledger/money";
import { setAllocationSchedule, scheduleInForce } from "@/ledger/set-allocation-schedule";
import type { LedgerStore } from "@/ledger/store";
import { filterByMember, openLotsFromTrades, summarizeLedger } from "@/ledger/summary";
import { todayIso } from "@/lib/format";
import { applyImport } from "./apply";
import {
  ACCOUNT_EXPORT_HEADERS,
  EXPORT_FILENAME,
  LEGACY_V012_TRANSINFO_HEADERS,
  exportBookXlsx,
  writeBookXlsx,
} from "./book-export";
import { mapUpload } from "./columns";
import { dupAllocX3Sheets } from "./fixtures/dup-alloc-x3";
import { legacyV012ExportSheets } from "./fixtures/legacy-v0-1-12";
import { legacyV012FOnlyExportSheets } from "./fixtures/legacy-v0-1-12-f-only";
import { legacyV012WahExportSheets } from "./fixtures/legacy-v0-1-12-wah";
import { buildPlan } from "./plan";

vi.mock("server-only", () => ({}));

const { parseUpload, pickOptionalSheets, pickSheets } = await import("./parse");

function importAll(plan: ReturnType<typeof buildPlan>) {
  const pending: Record<string, "import" | "skip"> = {};
  for (const issue of plan.issues.filter((item) => item.pending)) {
    pending[issue.id] = "import";
  }
  return { pending };
}

function moneyKey(value: string): string {
  return money(value).toFixed(8);
}

async function snapshotBook(store: LedgerStore, bookId: string) {
  const [members, accounts, cashFlows, trades, allocations, schedules] = await Promise.all([
    store.listMembers(bookId),
    store.listLedgerAccounts(bookId),
    store.listCashFlows(bookId),
    store.listTrades(bookId),
    store.listTradeAllocations(bookId),
    store.listAllocationSchedules(bookId),
  ]);
  const memberName = (id: string) => members.find((row) => row.id === id)?.displayName ?? id;
  const accountOf = (id: string) => accounts.find((row) => row.id === id);
  return {
    members: members
      .map((row) => ({ displayName: row.displayName, email: row.email }))
      .sort((a, b) => a.displayName.localeCompare(b.displayName)),
    accounts: accounts
      .map((row) => ({
        kind: row.kind,
        name: row.name,
        memberName: row.memberId ? memberName(row.memberId) : null,
      }))
      .sort((a, b) => `${a.kind}:${a.name}`.localeCompare(`${b.kind}:${b.name}`)),
    cashFlows: cashFlows
      .map((row) => ({
        kind: row.kind,
        memberName: memberName(row.memberId),
        amountHkd: moneyKey(row.amountHkd),
        fxRate: moneyKey(row.fxRate),
        amountUsd: moneyKey(row.amountUsd),
        occurredOn: row.occurredOn,
      }))
      .sort((a, b) => `${a.occurredOn}:${a.memberName}:${a.kind}`.localeCompare(`${b.occurredOn}:${b.memberName}:${b.kind}`)),
    trades: trades
      .map((row) => {
        const account = accountOf(row.ledgerAccountId);
        return {
          side: row.side,
          symbol: row.symbol,
          quantity: moneyKey(row.quantity),
          price: moneyKey(row.price),
          feeUsd: moneyKey(row.feeUsd),
          occurredOn: row.occurredOn,
          note: row.note,
          accountKind: account?.kind ?? null,
          accountMember: account?.memberId ? memberName(account.memberId) : null,
        };
      })
      .sort((a, b) =>
        `${a.occurredOn}:${a.side}:${a.symbol}:${a.quantity}:${a.accountKind}:${a.note ?? ""}`.localeCompare(
          `${b.occurredOn}:${b.side}:${b.symbol}:${b.quantity}:${b.accountKind}:${b.note ?? ""}`,
        ),
      ),
    allocations: trades
      .flatMap((trade) => {
        const account = accountOf(trade.ledgerAccountId);
        return allocations
          .filter((row) => row.tradeId === trade.id)
          .map((row) => ({
            side: trade.side,
            symbol: trade.symbol,
            occurredOn: trade.occurredOn,
            note: trade.note,
            accountKind: account?.kind ?? null,
            memberName: memberName(row.memberId),
            quantity: moneyKey(row.quantity),
            costUsd: moneyKey(row.costUsd),
            proceedsUsd: moneyKey(row.proceedsUsd),
          }));
      })
      .sort((a, b) =>
        `${a.occurredOn}:${a.side}:${a.symbol}:${a.quantity}:${a.memberName}`.localeCompare(
          `${b.occurredOn}:${b.side}:${b.symbol}:${b.quantity}:${b.memberName}`,
        ),
      ),
    schedules: schedules
      .map((schedule) => ({
        effectiveOn: schedule.effectiveOn,
        legs: schedule.legs
          .map((leg) => ({
            memberName: memberName(leg.memberId),
            percent: moneyKey(leg.percent),
          }))
          .sort((a, b) => a.memberName.localeCompare(b.memberName)),
      }))
      .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn)),
  };
}

async function seedFullLedger() {
  const store = createMemoryStore();
  const { book, member: hey, account: heyAccount } = await createBook(store, {
    name: "聯倉",
    createdByUserId: "user-1",
    creatorDisplayName: "Hey",
  });
  const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
  const wah = await addMember(store, { bookId: book.id, displayName: "Wah" });
  const kit = await addMember(store, { bookId: book.id, displayName: "Kit" });
  const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
  await setAllocationSchedule(store, {
    bookId: book.id,
    effectiveOn: "2024-01-01",
    legs: [
      { memberId: hey.id, percent: "0.5" },
      { memberId: sze.member.id, percent: "0.5" },
    ],
  });
  await setAllocationSchedule(store, {
    bookId: book.id,
    effectiveOn: "2024-06-01",
    legs: [
      { memberId: hey.id, percent: "0.6" },
      { memberId: sze.member.id, percent: "0.4" },
    ],
  });
  await createCashFlow(store, {
    bookId: book.id,
    memberId: hey.id,
    ledgerAccountId: heyAccount.id,
    amountHkd: "10000",
    fxRate: "1",
    occurredOn: "2024-01-01",
  });
  await createCashFlow(store, {
    bookId: book.id,
    memberId: kit.member.id,
    ledgerAccountId: kit.account.id,
    amountHkd: "5000",
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
    occurredOn: "2024-02-01",
    note: "joint lot",
  });
  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: joint.id,
    memberId: hey.id,
    symbol: "NVDA",
    quantity: "4",
    price: "60",
    occurredOn: "2024-03-01",
    side: "sell",
    note: "trim",
  });
  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: kit.account.id,
    memberId: kit.member.id,
    symbol: "AAPL",
    quantity: "8",
    price: "20",
    occurredOn: "2024-02-15",
    note: "kit limit",
  });
  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: heyAccount.id,
    memberId: hey.id,
    symbol: "MSFT",
    quantity: "5",
    price: "100",
    occurredOn: "2024-02-20",
    note: "solo buy",
  });
  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: wah.account.id,
    memberId: wah.member.id,
    symbol: "GLD",
    quantity: "2",
    price: "10",
    occurredOn: "2024-05-01",
    note: "wah sleeve",
  });
  await createSplit(store, {
    bookId: book.id,
    ledgerAccountId: joint.id,
    memberId: hey.id,
    symbol: "NVDA",
    newShares: "2",
    oldShares: "1",
    occurredOn: "2024-04-01",
  });
  await createTrade(store, {
    bookId: book.id,
    ledgerAccountId: joint.id,
    memberId: hey.id,
    symbol: "TSLA",
    quantity: "10",
    price: "40",
    occurredOn: "2024-07-15",
    note: "after ratio change",
  });
  await createAdjustment(store, {
    bookId: book.id,
    ledgerAccountId: heyAccount.id,
    memberId: hey.id,
    occurredOn: "2024-07-01",
    note: "股息 MSFT",
    symbol: "MSFT",
    amountUsd: "12.5",
  });
  await createAdjustment(store, {
    bookId: book.id,
    ledgerAccountId: heyAccount.id,
    memberId: hey.id,
    occurredOn: "2024-08-01",
    note: "rounding",
    amountUsd: "2.5",
  });
  return { store, bookId: book.id };
}

async function importExportedBook(bytes: Uint8Array, creatorDisplayName = "Hey") {
  const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
  const { transinfo, account } = pickSheets(parsed);
  const extras = pickOptionalSheets(parsed);
  const mapping = mapUpload(transinfo, account);
  expect(mapping.blocking).toBe(false);
  const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, account, mapping, extras);
  expect(plan.blocking).toBe(false);
  const empty = createMemoryStore();
  const result = await applyImport(empty, plan, {
    createdByUserId: "user-2",
    creatorDisplayName,
    decisions: importAll(plan),
  });
  return { empty, result, plan, transinfo, extras };
}

describe("export / import round-trip", () => {
  it("re-imports every table field from a full ledger", async () => {
    const { store, bookId } = await seedFullLedger();
    const before = await snapshotBook(store, bookId);

    expect(before.schedules).toEqual([
      {
        effectiveOn: "2024-01-01",
        legs: [
          { memberName: "Hey", percent: moneyKey("0.5") },
          { memberName: "Sze", percent: moneyKey("0.5") },
        ],
      },
      {
        effectiveOn: "2024-06-01",
        legs: [
          { memberName: "Hey", percent: moneyKey("0.6") },
          { memberName: "Sze", percent: moneyKey("0.4") },
        ],
      },
    ]);
    expect(before.members.map((row) => row.displayName)).toEqual(["Hey", "Kit", "Sze", "Wah"]);
    expect(before.trades.some((row) => row.note === "kit limit")).toBe(true);
    expect(before.trades.some((row) => row.side === "sell" && row.note === "trim")).toBe(true);

    const bytes = await exportBookXlsx(store, bookId);
    const { empty, result, extras } = await importExportedBook(bytes);
    expect(extras.members?.rows.flat()).toEqual(expect.arrayContaining(["Hey", "Kit", "Sze", "Wah"]));
    expect(
      extras.allocation?.rows.some((row) => row.some((cell) => cell.startsWith("0.6"))),
    ).toBe(true);

    const after = await snapshotBook(empty, result.bookId);
    expect(after.members).toEqual(before.members);
    expect(after.accounts).toEqual(before.accounts);
    expect(after.cashFlows).toEqual(before.cashFlows);
    expect(after.trades).toEqual(before.trades);
    expect(after.allocations).toEqual(before.allocations);
    expect(after.schedules).toEqual(before.schedules);

    const tsla = after.allocations.filter((row) => row.symbol === "TSLA" && row.side === "buy");
    const heyLeg = tsla.find((row) => row.memberName === "Hey");
    const szeLeg = tsla.find((row) => row.memberName === "Sze");
    expect(heyLeg?.quantity).toBe(moneyKey("6"));
    expect(szeLeg?.quantity).toBe(moneyKey("4"));
    expect(heyLeg?.costUsd).toBe(moneyKey("240"));
    expect(szeLeg?.costUsd).toBe(moneyKey("160"));
  });

  it("imports a v0.1.12 two-sheet fixture without Members or Allocation sheets", async () => {
    const { transinfo, account } = legacyV012ExportSheets();
    const mapping = mapUpload(transinfo, account);
    expect(mapping.blocking).toBe(false);
    expect(transinfo.headers).not.toContain("備註");
    const plan = buildPlan("book-export.xlsx", "legacy-v012", transinfo, account, mapping);
    expect(plan.blocking).toBe(false);
    expect(plan.schedules).toEqual([]);
    expect(plan.trades.some((row) => row.symbol === "NVDA" && (row.side ?? "buy") === "buy")).toBe(true);
    expect(plan.trades.find((row) => row.symbol === "AAPL")?.sellDate).toBe("2024-03-01");
    expect(plan.trades.find((row) => row.symbol === "MSFT" && (row.side ?? "buy") === "buy")?.memberName).toBe("Sze");
    expect(plan.trades.some((row) => row.side === "split" && row.symbol === "NVDA")).toBe(true);
    expect(plan.trades.some((row) => row.side === "adjustment" && row.note?.includes("股息"))).toBe(true);
    expect(plan.trades.some((row) => row.side === "adjustment" && (row.symbol === "—" || !row.symbol))).toBe(true);
    expect(plan.cashFlows.some((row) => row.kind === "withdrawal")).toBe(true);

    const store = createMemoryStore();
    const result = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    const trades = await store.listTrades(result.bookId);
    const cash = await store.listCashFlows(result.bookId);
    const members = await store.listMembers(result.bookId);
    expect(cash.filter((row) => row.kind === "deposit")).toHaveLength(2);
    expect(cash.some((row) => row.kind === "withdrawal")).toBe(true);
    expect(trades.some((row) => row.symbol === "NVDA" && row.side === "buy")).toBe(true);
    expect(trades.some((row) => row.symbol === "AAPL" && row.side === "sell")).toBe(true);
    expect(trades.some((row) => row.symbol === "MSFT" && row.side === "buy")).toBe(true);
    expect(trades.some((row) => row.side === "split")).toBe(true);
    expect(trades.some((row) => row.side === "adjustment" && row.note?.includes("股息"))).toBe(true);
    expect(trades.some((row) => row.side === "adjustment" && row.symbol === "—")).toBe(true);
    expect(members.map((row) => row.displayName).sort()).toEqual(["Hey", "Sze"]);
  });

  it("errors on an unmatched holder with the row number and the name", async () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "Ghost", "2024-01-02", "500"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const mapping = mapUpload(transinfo, account);
    expect(mapping.blocking).toBe(false);
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapping);
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "unknown_member");
    expect(issue).toBeTruthy();
    expect(issue?.row).toBe(2);
    expect(issue?.message).toContain("Ghost");
    expect(issue?.message).toContain("2");
    expect(plan.trades.some((row) => row.holderError === "unknown")).toBe(true);

    const store = createMemoryStore();
    await expect(
      applyImport(store, plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/第 2 行 holder「Ghost」/);
    expect(store.books).toHaveLength(0);
    expect(store.members).toHaveLength(0);
    expect(store.accounts).toHaveLength(0);
    expect(store.cashFlows).toHaveLength(0);
    expect(store.trades).toHaveLength(0);
    expect(store.allocations).toHaveLength(0);
    expect(store.schedules).toHaveLength(0);
    expect(store.scheduleLegs).toHaveLength(0);
  });

  it("exports the equal split a 3-member app-created book actually uses, with no Hey/Sze invented", async () => {
    const store = createMemoryStore();
    const { book, member: ming, account: mingCash } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "小明",
    });
    const hong = await addMember(store, { bookId: book.id, displayName: "小紅" });
    const wah = await addMember(store, { bookId: book.id, displayName: "小華" });
    const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: ming.id,
      ledgerAccountId: mingCash.id,
      amountHkd: "900",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: ming.id,
      symbol: "NVDA",
      quantity: "6",
      price: "10",
      occurredOn: "2024-02-01",
    });
    expect(await store.listAllocationSchedules(book.id)).toEqual([]);
    const beforeLegs = await store.listTradeAllocations(book.id);
    const names = new Map((await store.listMembers(book.id)).map((row) => [row.id, row.displayName]));
    expect(beforeLegs.map((row) => names.get(row.memberId)).sort()).toEqual(["小明", "小紅", "小華"]);
    expect(beforeLegs.every((row) => row.quantity === "2.00000000")).toBe(true);
    expect([ming.displayName, hong.member.displayName, wah.member.displayName]).toEqual([
      "小明",
      "小紅",
      "小華",
    ]);

    const bytes = await exportBookXlsx(store, book.id);
    const before = await snapshotBook(store, book.id);
    const { empty, result, extras } = await importExportedBook(bytes, "小明");
    expect(extras.allocation).toBeTruthy();
    expect(extras.allocation?.rows ?? []).toEqual([]);
    expect(extras.members?.rows.flat()).toEqual(expect.arrayContaining(["小明", "小紅", "小華"]));
    expect(extras.members?.rows.flat().some((name) => name === "Hey" || name === "Sze")).toBe(false);

    const after = await snapshotBook(empty, result.bookId);
    expect(after).toEqual(before);
    expect(after.schedules).toEqual([]);
    const nvda = after.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda).toHaveLength(3);
    expect(nvda.map((row) => row.memberName).sort()).toEqual(["小明", "小紅", "小華"]);
    expect(nvda.every((row) => row.quantity === moneyKey("2"))).toBe(true);
  });

  it("replace clears allocation schedules so legs are not duplicated", async () => {
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
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "NVDA",
      quantity: "10",
      price: "10",
      occurredOn: "2024-02-01",
    });
    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo, account } = pickSheets(parsed);
    const extras = pickOptionalSheets(parsed);
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, account, mapUpload(transinfo, account), extras);

    const first = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    const afterFirst = await snapshotBook(store, first.bookId);
    expect(afterFirst.schedules).toHaveLength(1);
    expect(afterFirst.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy")).toHaveLength(2);

    await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    const afterSecond = await snapshotBook(store, book.id);
    expect(afterSecond.schedules).toHaveLength(1);
    const nvda = afterSecond.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda).toHaveLength(2);
    expect(nvda.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("6"));
    expect(nvda.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("4"));
  });

  it("append rejects a same-date allocation that differs from the one already stored", async () => {
    const store = createMemoryStore();
    const { book, member: hey } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.6" },
        { memberId: sze.member.id, percent: "0.4" },
      ],
    });
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "F", "2024-02-01", "100"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "Hey", "1000", "1", "1000", "in"]],
    };
    const extras = {
      members: {
        kind: "members" as const,
        name: "Members",
        headers: ["Name"],
        rows: [["Hey"], ["Sze"]],
      },
      allocation: {
        kind: "allocation" as const,
        name: "Allocation",
        headers: ["Effective Date", "Member", "Percent"],
        rows: [
          ["2024-01-01", "Hey", "0.5"],
          ["2024-01-01", "Sze", "0.5"],
        ],
      },
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), extras);
    expect(plan.blocking).toBe(false);
    const before = await snapshotBook(store, book.id);
    await expect(
      applyImport(store, plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        existingBookId: book.id,
        decisions: { ...importAll(plan), reimportMode: "append" },
      }),
    ).rejects.toThrow(/2024-01-01/);
    expect(await snapshotBook(store, book.id)).toEqual(before);
  });

  it("append skips an identical same-date allocation", async () => {
    const store = createMemoryStore();
    const { book, member: hey } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.5" },
        { memberId: sze.member.id, percent: "0.5" },
      ],
    });
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "F", "2024-02-01", "100"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "Hey", "1000", "1", "1000", "in"]],
    };
    const extras = {
      members: {
        kind: "members" as const,
        name: "Members",
        headers: ["Name"],
        rows: [["Hey"], ["Sze"]],
      },
      allocation: {
        kind: "allocation" as const,
        name: "Allocation",
        headers: ["Effective Date", "Member", "Percent"],
        rows: [
          ["2024-01-01", "Hey", "0.5"],
          ["2024-01-01", "Sze", "0.5"],
        ],
      },
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), extras);
    await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "append" },
    });
    const schedules = await store.listAllocationSchedules(book.id);
    expect(schedules).toHaveLength(1);
  });

  it("round-trips members named B, F, K, 明, Joint and 聯名", async () => {
    const names = ["B", "F", "K", "明", "Joint", "聯名"];
    const store = createMemoryStore();
    const { book, member: first, account } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: names[0],
    });
    const added = [first];
    for (const name of names.slice(1)) {
      const row = await addMember(store, { bookId: book.id, displayName: name });
      added.push(row.member);
    }
    const joint = await createJointAccount(store, { bookId: book.id, name: "聯名倉" });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: first.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    for (const [index, member] of added.entries()) {
      const personal = (await store.listLedgerAccounts(book.id)).find(
        (row) => row.memberId === member.id && row.kind === "personal",
      );
      await createTrade(store, {
        bookId: book.id,
        ledgerAccountId: personal!.id,
        memberId: member.id,
        symbol: "AAA",
        quantity: "1",
        price: "10",
        occurredOn: `2024-02-0${index + 1}`,
        note: member.displayName,
      });
    }
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: first.id,
      symbol: "NVDA",
      quantity: "6",
      price: "10",
      occurredOn: "2024-03-01",
    });

    const bytes = await exportBookXlsx(store, book.id);
    const { empty, result, extras } = await importExportedBook(bytes, names[0]);
    expect(extras.members?.rows.flat()).toEqual(expect.arrayContaining(names));
    const after = await snapshotBook(empty, result.bookId);
    expect(after.members.map((row) => row.displayName).sort()).toEqual([...names].sort());
    for (const name of names) {
      expect(after.trades.some((row) => row.note === name && row.accountKind === "personal")).toBe(true);
    }
    expect(after.trades.some((row) => row.symbol === "NVDA" && row.accountKind === "joint")).toBe(true);
  });

  it("errors on an empty holder and never writes Hey", async () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "", "2024-01-02", "500"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "empty_holder");
    expect(issue?.row).toBe(2);
    expect(issue?.message).toMatch(/空白/);
    expect(plan.trades.every((row) => row.memberName !== "Hey")).toBe(true);

    const store = createMemoryStore();
    await expect(
      applyImport(store, plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/空白/);
    expect(store.trades).toHaveLength(0);
    expect(store.members.map((row) => row.displayName)).not.toContain("Hey");
  });

  it("rolls back every table when an unknown holder appears after earlier rows", async () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [
        ["NVDA", "10", "H", "2024-01-02", "500"],
        ["AAPL", "5", "Ghost", "2024-01-03", "100"],
      ],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.issues.some((item) => item.kind === "unknown_member" && item.message.includes("Ghost"))).toBe(
      true,
    );
    expect(plan.trades.some((row) => row.holderError === "unknown")).toBe(true);

    const store = createMemoryStore();
    await expect(
      applyImport(store, plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/Ghost/);
    expect(store.books).toHaveLength(0);
    expect(store.members).toHaveLength(0);
    expect(store.accounts).toHaveLength(0);
    expect(store.cashFlows).toHaveLength(0);
    expect(store.trades).toHaveLength(0);
    expect(store.allocations).toHaveLength(0);
    expect(store.schedules).toHaveLength(0);
    expect(store.scheduleLegs).toHaveLength(0);
  });

  it("exports buy fees and round-trips sell fees", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "聯倉",
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
      feeUsd: "1.25",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "4",
      price: "60",
      occurredOn: "2024-03-01",
      side: "sell",
      feeUsd: "0.8",
    });
    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo } = pickSheets(parsed);
    expect(transinfo.headers).toContain("買入手續費");
    const feeIndex = transinfo.headers.indexOf("買入手續費");
    const sellFeeIndex = transinfo.headers.indexOf("手續費");
    const kindIndex = transinfo.headers.indexOf("種類");
    const buyRow = transinfo.rows.find((row) => row[kindIndex] === "buy");
    const sellRow = transinfo.rows.find((row) => row[kindIndex] === "sell");
    expect(buyRow?.[feeIndex]).toBe("1.25");
    expect(sellRow?.[sellFeeIndex]).toBe("0.8");
    expect(sellRow?.[transinfo.headers.indexOf("買入日期")]).toBe("");
    expect(sellRow?.[transinfo.headers.indexOf("賣出日期")]).toBe("2024-03-01");

    const { empty, result } = await importExportedBook(bytes);
    const after = await snapshotBook(empty, result.bookId);
    expect(after.trades.find((row) => row.side === "buy")?.feeUsd).toBe(moneyKey("1.25"));
    expect(after.trades.find((row) => row.side === "sell")?.feeUsd).toBe(moneyKey("0.8"));
  });

  it("errors on bad Allocation headers or percents with the sheet and row", () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "H", "2024-01-02", "500"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const members = {
      kind: "members" as const,
      name: "Members",
      headers: ["Name"],
      rows: [["Hey"]],
    };
    const badHeaders = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members,
      allocation: {
        kind: "allocation",
        name: "Allocation",
        headers: ["Foo", "Bar"],
        rows: [["2024-01-01", "Hey"]],
      },
    });
    expect(badHeaders.blocking).toBe(true);
    expect(badHeaders.issues.some((item) => item.message.includes("Allocation") && item.message.includes("表頭"))).toBe(
      true,
    );

    const badPercent = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members,
      allocation: {
        kind: "allocation",
        name: "Allocation",
        headers: ["Effective Date", "Member", "Percent"],
        rows: [["2024-01-01", "Hey", "nope"]],
      },
    });
    expect(badPercent.blocking).toBe(true);
    const pct = badPercent.issues.find((item) => item.kind === "allocation_invalid" && item.row === 2);
    expect(pct?.message).toContain("Allocation");
    expect(pct?.message).toContain("2");
    expect(pct?.message).toContain("nope");
  });

  it("does not auto-create members that only appear on the Allocation sheet", () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "H", "2024-01-02", "500"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members: {
        kind: "members",
        name: "Members",
        headers: ["Name"],
        rows: [["Hey"]],
      },
      allocation: {
        kind: "allocation",
        name: "Allocation",
        headers: ["Effective Date", "Member", "Percent"],
        rows: [
          ["2024-01-01", "Hey", "0.5"],
          ["2024-01-01", "Ghost", "0.5"],
        ],
      },
    });
    expect(plan.members).not.toContain("Ghost");
    expect(plan.blocking).toBe(true);
    expect(plan.issues.some((item) => item.message.includes("Ghost") && item.message.includes("Allocation"))).toBe(
      true,
    );
  });

  it("round-trips an adjustment with no symbol", async () => {
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
      occurredOn: "2024-08-01",
      note: "rounding",
      amountUsd: "2.5",
    });
    const bytes = await exportBookXlsx(store, book.id);
    const { empty, result } = await importExportedBook(bytes);
    const after = await snapshotBook(empty, result.bookId);
    expect(after.trades.some((row) => row.side === "adjustment" && row.symbol === "—" && row.note === "rounding")).toBe(
      true,
    );
  });

  it("errors when a holder is ambiguous, naming the row", () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "KIT", "2024-01-02", "500"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members: {
        kind: "members",
        name: "Members",
        headers: ["Name"],
        rows: [["Kit"], ["kit"]],
      },
    });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "duplicate_member");
    expect(issue?.row).toBe(3);
    expect(issue?.message).toContain("kit");
    expect(issue?.message).toContain("3");
  });

  it("round-trips members A/H/明 on a no-schedule joint book with Member A NAV 1080", async () => {
    const store = createMemoryStore();
    const { book, member: memberA, account: cashA } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "A",
    });
    const memberH = await addMember(store, { bookId: book.id, displayName: "H" });
    const memberMing = await addMember(store, { bookId: book.id, displayName: "明" });
    const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
    for (const row of [
      { member: memberA, account: cashA },
      { member: memberH.member, account: memberH.account },
      { member: memberMing.member, account: memberMing.account },
    ]) {
      await createCashFlow(store, {
        bookId: book.id,
        memberId: row.member.id,
        ledgerAccountId: row.account.id,
        amountHkd: "1500",
        fxRate: "1",
        occurredOn: "2024-01-01",
      });
    }
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: memberA.id,
      symbol: "NVDA",
      quantity: "6",
      price: "210",
      occurredOn: "2024-02-01",
    });
    expect(await store.listAllocationSchedules(book.id)).toEqual([]);

    async function memberNav(target: LedgerStore, bookId: string, memberId: string) {
      const cashFlows = filterByMember(await target.listCashFlows(bookId), memberId);
      const allocations = filterByMember(await target.listTradeAllocations(bookId), memberId);
      const trades = await target.listTrades(bookId);
      const lots = filterByMember(openLotsFromTrades(trades, await target.listTradeAllocations(bookId)), memberId);
      return summarizeLedger(cashFlows, allocations, lots);
    }

    const beforeNav = await memberNav(store, book.id, memberA.id);
    expect(beforeNav.cashUsd.toFixed(2)).toBe("1080.00");
    expect(beforeNav.navUsd.toFixed(2)).toBe("1080.00");

    const bytes = await exportBookXlsx(store, book.id);
    const { empty, result, extras } = await importExportedBook(bytes, "A");
    expect(extras.members?.rows.flat()).toEqual(expect.arrayContaining(["A", "H", "明"]));
    expect(extras.members?.rows.flat().some((name) => name === "Hey" || name === "Sze")).toBe(false);
    const afterMembers = await empty.listMembers(result.bookId);
    expect(afterMembers.map((row) => row.displayName).sort()).toEqual(["A", "H", "明"]);
    const afterA = afterMembers.find((row) => row.displayName === "A")!;
    const afterNav = await memberNav(empty, result.bookId, afterA.id);
    expect(afterNav.cashUsd.toFixed(2)).toBe("1080.00");
    expect(afterNav.navUsd.toFixed(2)).toBe("1080.00");
    expect(await empty.listAllocationSchedules(result.bookId)).toEqual([]);
  });

  it("keeps schedule count unchanged across three replace imports, and export1 equals export2 including Members", async () => {
    const { store, bookId } = await seedFullLedger();
    const beforeCount = (await store.listAllocationSchedules(bookId)).length;
    const bytes1 = await exportBookXlsx(store, bookId);
    const parsed1 = await parseUpload([{ name: EXPORT_FILENAME, bytes: bytes1 }]);
    expect(parsed1.sheets.some((sheet) => sheet.kind === "members")).toBe(true);
    const { transinfo, account } = pickSheets(parsed1);
    const extras = pickOptionalSheets(parsed1);
    const plan = buildPlan(parsed1.filename, parsed1.fileHash, transinfo, account, mapUpload(transinfo, account), extras);

    for (let i = 0; i < 3; i += 1) {
      await applyImport(store, plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        existingBookId: bookId,
        decisions: { ...importAll(plan), reimportMode: "replace" },
      });
    }
    expect((await store.listAllocationSchedules(bookId)).length).toBe(beforeCount);

    const bytes2 = await exportBookXlsx(store, bookId);
    const parsed2 = await parseUpload([{ name: EXPORT_FILENAME, bytes: bytes2 }]);
    expect(parsed2.sheets.some((sheet) => sheet.kind === "members")).toBe(true);
    const byName = (parsed: typeof parsed1) =>
      Object.fromEntries(parsed.sheets.map((sheet) => [sheet.name, { headers: sheet.headers, rows: sheet.rows }]));
    expect(byName(parsed2)).toEqual(byName(parsed1));
  });

  it("moving the 60/40 date to 2024-08-01 re-splits the 2024-07-15 TSLA buy 50/50", async () => {
    const { store, bookId } = await seedFullLedger();
    const bytes = await exportBookXlsx(store, bookId);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo, account } = pickSheets(parsed);
    const extras = pickOptionalSheets(parsed);
    expect(extras.allocation).toBeTruthy();
    const moved = {
      ...extras.allocation!,
      rows: extras.allocation!.rows.map((row) =>
        row[0] === "2024-06-01" ? ["2024-08-01", row[1], row[2]] : row,
      ),
    };
    const rewritten = await writeBookXlsx(transinfo, account, {
      members: extras.members,
      allocation: moved,
    });
    const { empty, result } = await importExportedBook(rewritten);
    const after = await snapshotBook(empty, result.bookId);
    expect(after.schedules.map((row) => row.effectiveOn)).toEqual(["2024-01-01", "2024-08-01"]);
    const tsla = after.allocations.filter((row) => row.symbol === "TSLA" && row.side === "buy");
    expect(tsla.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("5"));
    expect(tsla.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("5"));
  });

  it("does not warn 賣出日空白 on a partly sold buy", () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total", "Sell Date", "Sell Price", "Sell Total", "Kind"],
      rows: [
        ["NVDA", "10", "H", "2024-01-02", "500", "", "", "", "buy"],
        ["NVDA", "4", "H", "", "", "2024-03-01", "60", "240", "sell"],
      ],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.issues.some((issue) => issue.kind === "open_lot")).toBe(false);
    expect(plan.issues.some((issue) => issue.message.includes("賣出日空白"))).toBe(false);
    expect(plan.trades.some((row) => row.side === "buy" && row.symbol === "NVDA")).toBe(true);
    expect(plan.trades.some((row) => row.side === "sell" && row.symbol === "NVDA")).toBe(true);
  });

  it("round-trips a per-trade custom joint split that differs from the schedule", async () => {
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
        { memberId: hey.id, percent: "0.5" },
        { memberId: sze.member.id, percent: "0.5" },
      ],
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "NVDA",
      quantity: "10",
      price: "10",
      occurredOn: "2024-02-01",
      legs: [
        { memberId: hey.id, quantity: "7", costUsd: "70", proceedsUsd: "0" },
        { memberId: sze.member.id, quantity: "3", costUsd: "30", proceedsUsd: "0" },
      ],
    });
    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    expect(parsed.sheets.some((sheet) => sheet.kind === "tradesplits")).toBe(true);
    const { empty, result } = await importExportedBook(bytes);
    const after = await snapshotBook(empty, result.bookId);
    const nvda = after.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("7"));
    expect(nvda.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("3"));
  });

  it("keeps same-day joint and personal NVDA buys distinct using the app export TradeId", async () => {
    const store = createMemoryStore();
    const { book, member: hey, account: heyCash } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    const kit = await addMember(store, { bookId: book.id, displayName: "Kit" });
    const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.5" },
        { memberId: sze.member.id, percent: "0.5" },
      ],
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: kit.member.id,
      ledgerAccountId: kit.account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });
    await createCashFlow(store, {
      bookId: book.id,
      memberId: hey.id,
      ledgerAccountId: heyCash.id,
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
      price: "10",
      occurredOn: "2024-02-01",
      legs: [
        { memberId: hey.id, quantity: "7", costUsd: "70", proceedsUsd: "0" },
        { memberId: sze.member.id, quantity: "3", costUsd: "30", proceedsUsd: "0" },
      ],
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "NVDA",
      quantity: "2",
      price: "10",
      occurredOn: "2024-02-01",
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: kit.account.id,
      memberId: kit.member.id,
      symbol: "NVDA",
      quantity: "2",
      price: "10",
      occurredOn: "2024-02-01",
    });

    const before = await snapshotBook(store, book.id);
    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    expect(parsed.sheets.some((sheet) => sheet.kind === "tradesplits")).toBe(true);
    const { empty, result } = await importExportedBook(bytes);
    const after = await snapshotBook(empty, result.bookId);
    expect(after).toEqual(before);
    const jointBuys = after.allocations.filter(
      (row) => row.symbol === "NVDA" && row.side === "buy" && row.accountKind === "joint",
    );
    expect(jointBuys.find((row) => row.memberName === "Hey" && row.quantity === moneyKey("7"))).toBeTruthy();
    expect(jointBuys.find((row) => row.memberName === "Sze" && row.quantity === moneyKey("3"))).toBeTruthy();
    expect(jointBuys.find((row) => row.memberName === "Hey" && row.quantity === moneyKey("1"))).toBeTruthy();
    expect(jointBuys.find((row) => row.memberName === "Sze" && row.quantity === moneyKey("1"))).toBeTruthy();
    const kitBuy = after.allocations.find(
      (row) => row.symbol === "NVDA" && row.side === "buy" && row.memberName === "Kit",
    );
    expect(kitBuy?.quantity).toBe(moneyKey("2"));
    expect(kitBuy?.accountKind).toBe("personal");
  });

  it("errors when TradeSplits quantities 99+1 do not sum to the trade quantity 10", async () => {
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
        { memberId: hey.id, percent: "0.5" },
        { memberId: sze.member.id, percent: "0.5" },
      ],
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "NVDA",
      quantity: "10",
      price: "10",
      occurredOn: "2024-02-01",
      legs: [
        { memberId: hey.id, quantity: "7", costUsd: "70", proceedsUsd: "0" },
        { memberId: sze.member.id, quantity: "3", costUsd: "30", proceedsUsd: "0" },
      ],
    });
    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo, account } = pickSheets(parsed);
    const extras = pickOptionalSheets(parsed);
    expect(extras.tradeSplits).toBeTruthy();
    const qtyIndex = extras.tradeSplits!.headers.findIndex((header) => header === "Quantity");
    extras.tradeSplits!.rows = extras.tradeSplits!.rows.map((row, index) => {
      const next = [...row];
      next[qtyIndex] = index === 0 ? "99" : "1";
      return next;
    });
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, account, mapUpload(transinfo, account), extras);
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "tradesplit_invalid");
    expect(issue?.message).toMatch(/第 \d+ 行/);
    expect(issue?.row).toBeGreaterThan(0);
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/第 \d+ 行/);
  });

  it("keeps a Hey/Sze 4.5/4.5 joint dividend after Wah joins", async () => {
    const store = createMemoryStore();
    const { book, member: hey } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    await addMember(store, { bookId: book.id, displayName: "Sze" });
    const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await createAdjustment(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      occurredOn: "2024-07-01",
      note: "股息 MSFT",
      symbol: "MSFT",
      amountUsd: "9",
    });
    const beforeWah = (await store.listTradeAllocations(book.id)).map((row) => row.proceedsUsd).sort();
    expect(beforeWah).toEqual(["4.50000000", "4.50000000"]);
    await addMember(store, { bookId: book.id, displayName: "Wah" });

    const bytes = await exportBookXlsx(store, book.id);
    const { empty, result } = await importExportedBook(bytes);
    const after = await snapshotBook(empty, result.bookId);
    const div = after.allocations.filter((row) => row.symbol === "MSFT" && row.side === "adjustment");
    expect(div.find((row) => row.memberName === "Hey")?.proceedsUsd).toBe(moneyKey("4.5"));
    expect(div.find((row) => row.memberName === "Sze")?.proceedsUsd).toBe(moneyKey("4.5"));
    expect(div.some((row) => row.memberName === "Wah")).toBe(false);
  });

  it("round-trips a personal-only book with no schedule and no phantom 聯名 account", async () => {
    const store = createMemoryStore();
    const { book, member, account } = await createBook(store, {
      name: "獨倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Kit",
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
      quantity: "2",
      price: "10",
      occurredOn: "2024-02-01",
    });
    const before = await snapshotBook(store, book.id);
    expect(before.accounts.some((row) => row.kind === "joint")).toBe(false);
    expect(before.schedules).toEqual([]);
    const { empty, result, extras } = await importExportedBook(await exportBookXlsx(store, book.id), "Kit");
    expect(extras.allocation).toBeTruthy();
    expect(extras.allocation?.rows ?? []).toEqual([]);
    const after = await snapshotBook(empty, result.bookId);
    expect(after).toEqual(before);
    expect(after.accounts.some((row) => row.kind === "joint" || row.name === "聯名")).toBe(false);
    expect(after.schedules).toEqual([]);
  });

  it("keeps legacy F / 聯名（Hey + Sze） as Hey/Sze 50/50 even when Wah is a member", async () => {
    const { transinfo, account } = legacyV012WahExportSheets();
    const mapping = mapUpload(transinfo, account);
    const plan = buildPlan("book-export.xlsx", "legacy-wah", transinfo, account, mapping);
    expect(plan.blocking).toBe(false);
    expect(plan.trades.every((row) => row.legacyHeySze)).toBe(true);
    const store = createMemoryStore();
    const result = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    const after = await snapshotBook(store, result.bookId);
    expect(after.members.map((row) => row.displayName).sort()).toEqual(["Hey", "Sze", "Wah"]);
    const nvda = after.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("5"));
    expect(nvda.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("5"));
    expect(nvda.some((row) => row.memberName === "Wah")).toBe(false);
    const aapl = after.allocations.filter((row) => row.symbol === "AAPL" && row.side === "buy");
    expect(aapl.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("2"));
    expect(aapl.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("2"));
    expect(aapl.some((row) => row.memberName === "Wah")).toBe(false);
  });

  it("errors on Members names that differ only by case", () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "Kit", "2024-01-02", "500"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "Kit", "1000", "1", "1000", "in"]],
    };
    const members = {
      kind: "members" as const,
      name: "Members",
      headers: ["Name"],
      rows: [["Kit"], ["KIT"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { members });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "duplicate_member");
    expect(issue?.message).toContain("KIT");
    expect(issue?.row).toBe(3);
    const sameCase = {
      kind: "members" as const,
      name: "Members",
      headers: ["Name"],
      rows: [["Kit"], ["Kit"]],
    };
    const planSame = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members: sameCase,
    });
    expect(planSame.blocking).toBe(true);
    expect(planSame.issues.some((item) => item.kind === "duplicate_member")).toBe(true);
    const padded = {
      kind: "members" as const,
      name: "Members",
      headers: ["Name"],
      rows: [["Kit "], [" Kit"]],
    };
    const planPad = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members: padded,
    });
    expect(planPad.blocking).toBe(true);
    expect(planPad.counts.errors).toBeGreaterThan(0);
    expect(planPad.issues.some((item) => item.kind === "duplicate_member" && item.row === 3)).toBe(true);
  });

  it("errors on duplicate Allocation date+member rows with the sheet and row (dup-alloc-x3)", async () => {
    const sheets = dupAllocX3Sheets();
    const bytes = await writeBookXlsx(sheets.transinfo, sheets.account, {
      members: sheets.members,
      allocation: sheets.allocation,
    });
    const parsed = await parseUpload([{ name: "dup-alloc-x3.xlsx", bytes }]);
    const { transinfo, account } = pickSheets(parsed);
    const extras = pickOptionalSheets(parsed);
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, account, mapUpload(transinfo, account), extras);
    expect(plan.blocking).toBe(true);
    expect(plan.hasAllocationSheet).toBe(true);
    expect(plan.schedules).toEqual([]);
    const issue = plan.issues.find((item) => item.kind === "allocation_invalid" && item.row === 4);
    expect(issue?.sheet).toBe("allocation");
    expect(issue?.message).toContain("Allocation");
    expect(issue?.message).toContain("4");
    expect(issue?.message).toMatch(/Hey/i);
    expect(plan.counts.errors).toBeGreaterThan(0);
    expect(plan.counts.errors).toBe(
      plan.issues.filter((item) => item.kind === "allocation_invalid" || item.kind === "duplicate_member").length,
    );
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/Allocation 第 4 行/);
  });

  it("does not invent a joint account or schedule for personal books (明, A/H, prefix names)", async () => {
    for (const names of [["明"], ["A", "H"], ["B", "F", "K"]]) {
      const store = createMemoryStore();
      const { book, member: first, account } = await createBook(store, {
        name: "獨倉",
        createdByUserId: "user-1",
        creatorDisplayName: names[0],
      });
      const added = [first];
      for (const name of names.slice(1)) {
        added.push((await addMember(store, { bookId: book.id, displayName: name })).member);
      }
      for (const [index, member] of added.entries()) {
        const personal =
          index === 0
            ? account
            : (await store.listLedgerAccounts(book.id)).find(
                (row) => row.memberId === member.id && row.kind === "personal",
              )!;
        await createCashFlow(store, {
          bookId: book.id,
          memberId: member.id,
          ledgerAccountId: personal.id,
          amountHkd: String(1000 + index * 100),
          fxRate: "1",
          occurredOn: "2024-01-01",
        });
        await createTrade(store, {
          bookId: book.id,
          ledgerAccountId: personal.id,
          memberId: member.id,
          symbol: "NVDA",
          quantity: String(index + 1),
          price: "10",
          occurredOn: "2024-02-01",
        });
      }
      const before = await snapshotBook(store, book.id);
      expect(before.accounts.some((row) => row.kind === "joint")).toBe(false);
      expect(before.schedules).toEqual([]);
      expect(scheduleInForce(await store.listAllocationSchedules(book.id), todayIso())).toBeNull();

      const { empty, result, extras } = await importExportedBook(await exportBookXlsx(store, book.id), names[0]);
      expect(extras.allocation).toBeTruthy();
      expect(extras.allocation?.rows ?? []).toEqual([]);
      const after = await snapshotBook(empty, result.bookId);
      expect(after).toEqual(before);
      expect(after.accounts.some((row) => row.kind === "joint" || row.name === "聯名")).toBe(false);
      expect(after.schedules).toEqual([]);
      expect(scheduleInForce(await empty.listAllocationSchedules(result.bookId), todayIso())).toBeNull();
    }
  });

  it("imports v0.1.12 F rows as Hey/Sze 50/50 for a 小明 importer, creating Sze", async () => {
    const { transinfo, account } = legacyV012ExportSheets();
    const plan = buildPlan("book-export.xlsx", "legacy-v012-ming", transinfo, account, mapUpload(transinfo, account));
    expect(plan.trades.filter((row) => row.book === "joint").every((row) => row.legacyHeySze)).toBe(true);
    const store = createMemoryStore();
    const result = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "小明",
      decisions: importAll(plan),
    });
    const after = await snapshotBook(store, result.bookId);
    expect(after.members.map((row) => row.displayName).sort()).toEqual(["Hey", "Sze", "小明"]);
    const split = after.trades.find((row) => row.side === "split" && row.symbol === "NVDA");
    expect(split?.accountMember).toBe("Hey");
    expect(split?.accountKind).toBe("personal");
    expect(split?.accountMember).not.toBe("小明");
    const aapl = after.allocations.filter((row) => row.symbol === "AAPL" && row.side === "buy");
    expect(aapl.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("2.5"));
    expect(aapl.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("2.5"));
    expect(aapl.some((row) => row.memberName === "小明")).toBe(false);

    const fOnly = legacyV012FOnlyExportSheets();
    const fPlan = buildPlan("f-only.xlsx", "legacy-f-only", fOnly.transinfo, fOnly.account, mapUpload(fOnly.transinfo, fOnly.account));
    const empty = createMemoryStore();
    const fResult = await applyImport(empty, fPlan, {
      createdByUserId: "user-2",
      creatorDisplayName: "小明",
      decisions: importAll(fPlan),
    });
    const fAfter = await snapshotBook(empty, fResult.bookId);
    expect(fAfter.members.map((row) => row.displayName).sort()).toEqual(["Hey", "Sze", "小明"]);
    const nvda = fAfter.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda).toHaveLength(2);
    expect(nvda.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("5"));
    expect(nvda.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("5"));
    expect(nvda.some((row) => row.memberName === "小明")).toBe(false);
  });

  it("keeps existing schedules when replace import has no Allocation sheet", async () => {
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
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "TSLA",
      quantity: "10",
      price: "10",
      occurredOn: "2024-02-01",
    });
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "F", "2024-03-01", "100"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-01-01", "入金", "H", "2000", "1", "2000", "in"]],
    };
    const plan = buildPlan("no-alloc.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.hasAllocationSheet).toBe(false);
    expect(plan.schedules).toEqual([]);
    await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    const after = await snapshotBook(store, book.id);
    expect(after.schedules).toEqual([
      {
        effectiveOn: "2024-01-01",
        legs: [
          { memberName: "Hey", percent: moneyKey("0.6") },
          { memberName: "Sze", percent: moneyKey("0.4") },
        ],
      },
    ]);
    expect(after.trades.some((row) => row.symbol === "TSLA")).toBe(false);
    const nvda = after.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("5"));
    expect(nvda.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("5"));
  });

  it("replace of an app no-schedule export onto a 70/30 book stores 小明 5 / 小紅 5", async () => {
    const dest = createMemoryStore();
    const { book: destBook, member: hey } = await createBook(dest, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(dest, { bookId: destBook.id, displayName: "Sze" });
    const destJoint = await createJointAccount(dest, { bookId: destBook.id, name: "聯名" });
    await setAllocationSchedule(dest, {
      bookId: destBook.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.7" },
        { memberId: sze.member.id, percent: "0.3" },
      ],
    });
    await createTrade(dest, {
      bookId: destBook.id,
      ledgerAccountId: destJoint.id,
      memberId: hey.id,
      symbol: "TSLA",
      quantity: "10",
      price: "10",
      occurredOn: "2024-02-01",
    });

    const source = createMemoryStore();
    const { book: srcBook, member: ming } = await createBook(source, {
      name: "聯倉",
      createdByUserId: "user-2",
      creatorDisplayName: "小明",
    });
    const hong = await addMember(source, { bookId: srcBook.id, displayName: "小紅" });
    const srcJoint = await createJointAccount(source, { bookId: srcBook.id, name: "聯名" });
    await createTrade(source, {
      bookId: srcBook.id,
      ledgerAccountId: srcJoint.id,
      memberId: ming.id,
      symbol: "NVDA",
      quantity: "10",
      price: "10",
      occurredOn: "2024-03-01",
    });
    const srcLegs = await source.listTradeAllocations(srcBook.id);
    const srcNames = new Map((await source.listMembers(srcBook.id)).map((row) => [row.id, row.displayName]));
    expect(srcLegs.map((row) => srcNames.get(row.memberId)).sort()).toEqual(["小明", "小紅"]);
    expect(srcLegs.every((row) => row.quantity === "5.00000000")).toBe(true);
    void hong;

    const bytes = await exportBookXlsx(source, srcBook.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    expect(parsed.sheets.some((sheet) => sheet.kind === "allocation" || sheet.name === "Allocation")).toBe(true);
    const extras = pickOptionalSheets(parsed);
    expect(extras.allocation).toBeTruthy();
    expect(extras.allocation?.rows ?? []).toEqual([]);
    const { transinfo, account } = pickSheets(parsed);
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, account, mapUpload(transinfo, account), extras);
    expect(plan.hasAllocationSheet).toBe(true);
    expect(plan.schedules).toEqual([]);

    await applyImport(dest, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: destBook.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    const after = await snapshotBook(dest, destBook.id);
    expect(after.schedules).toEqual([]);
    const nvda = after.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda.find((row) => row.memberName === "小明")?.quantity).toBe(moneyKey("5"));
    expect(nvda.find((row) => row.memberName === "小紅")?.quantity).toBe(moneyKey("5"));
    expect(nvda.some((row) => row.memberName === "Hey" || row.memberName === "Sze")).toBe(false);
  });

  it("legacy F replace into a 70/30 book is Hey/Sze 50/50 (250/250, adjustment 1/1)", async () => {
    const store = createMemoryStore();
    const { book, member: hey } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.7" },
        { memberId: sze.member.id, percent: "0.3" },
      ],
    });
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: [...LEGACY_V012_TRANSINFO_HEADERS],
      rows: [
        ["NVDA", "10", "F", "2024-02-01", "50", "500", "", "", "", "", "", "buy"],
        ["MSFT", "", "F", "2024-07-01", "", "2", "", "", "", "", "", "股息"],
      ],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: [...ACCOUNT_EXPORT_HEADERS],
      rows: [
        ["2024-01-01", "入金", "H", "1000", "1", "1000", "入"],
        ["2024-02-01", "NVDA", "F", "", "", "", ""],
        ["2024-07-01", "MSFT", "F", "", "", "", ""],
      ],
    };
    const plan = buildPlan("book-export.xlsx", "legacy-70-30", transinfo, account, mapUpload(transinfo, account));
    expect(plan.hasAllocationSheet).toBe(false);
    expect(plan.trades.filter((row) => row.book === "joint").every((row) => row.legacyHeySze)).toBe(true);
    await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    const after = await snapshotBook(store, book.id);
    expect(after.schedules).toHaveLength(1);
    expect(after.schedules[0]?.legs.find((leg) => leg.memberName === "Hey")?.percent).toBe(moneyKey("0.7"));
    const nvda = after.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda.find((row) => row.memberName === "Hey")?.costUsd).toBe(moneyKey("250"));
    expect(nvda.find((row) => row.memberName === "Sze")?.costUsd).toBe(moneyKey("250"));
    const div = after.allocations.filter((row) => row.symbol === "MSFT" && row.side === "adjustment");
    expect(div.find((row) => row.memberName === "Hey")?.proceedsUsd).toBe(moneyKey("1"));
    expect(div.find((row) => row.memberName === "Sze")?.proceedsUsd).toBe(moneyKey("1"));
  });

  it("legacy F replace into a 小明/小紅 schedule still creates Hey/Sze 50/50", async () => {
    const store = createMemoryStore();
    const { book, member: ming } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-1",
      creatorDisplayName: "小明",
    });
    const hong = await addMember(store, { bookId: book.id, displayName: "小紅" });
    await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: ming.id, percent: "0.5" },
        { memberId: hong.member.id, percent: "0.5" },
      ],
    });
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total", "Kind"],
      rows: [["NVDA", "10", "F", "2024-03-01", "100", "buy"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-03-01", "NVDA", "F", "", "", "", ""]],
    };
    const plan = buildPlan("legacy.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.hasAllocationSheet).toBe(false);
    expect(plan.trades.some((row) => row.legacyHeySze)).toBe(true);
    await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "小明",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    const after = await snapshotBook(store, book.id);
    expect(after.members.map((row) => row.displayName).sort()).toEqual(["Hey", "Sze", "小明", "小紅"]);
    expect(after.schedules).toHaveLength(1);
    const nvda = after.allocations.filter((row) => row.symbol === "NVDA" && row.side === "buy");
    expect(nvda.find((row) => row.memberName === "Hey")?.quantity).toBe(moneyKey("5"));
    expect(nvda.find((row) => row.memberName === "Sze")?.quantity).toBe(moneyKey("5"));
    expect(nvda.some((row) => row.memberName === "小明" || row.memberName === "小紅")).toBe(false);
  });
});


