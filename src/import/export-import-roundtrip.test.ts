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
import { setAllocationSchedule } from "@/ledger/set-allocation-schedule";
import type { LedgerStore } from "@/ledger/store";
import { applyImport } from "./apply";
import { EXPORT_FILENAME, exportBookXlsx } from "./book-export";
import { mapUpload } from "./columns";
import { legacyV012ExportSheets } from "./fixtures/legacy-v0-1-12";
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
        `${a.occurredOn}:${a.side}:${a.symbol}:${a.note ?? ""}`.localeCompare(
          `${b.occurredOn}:${b.side}:${b.symbol}:${b.note ?? ""}`,
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
        `${a.occurredOn}:${a.side}:${a.symbol}:${a.memberName}`.localeCompare(
          `${b.occurredOn}:${b.side}:${b.symbol}:${b.memberName}`,
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
    expect(extras.allocation?.rows.some((row) => row.includes("0.6") || row.includes("0.60"))).toBe(true);

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
    expect(plan.trades.find((row) => row.symbol === "MSFT")?.memberName).toBe("Sze");

    const store = createMemoryStore();
    const result = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    const trades = await store.listTrades(result.bookId);
    const cash = await store.listCashFlows(result.bookId);
    const members = await store.listMembers(result.bookId);
    expect(cash).toHaveLength(2);
    expect(trades.some((row) => row.symbol === "NVDA" && row.side === "buy")).toBe(true);
    expect(trades.some((row) => row.symbol === "AAPL" && row.side === "sell")).toBe(true);
    expect(trades.some((row) => row.symbol === "MSFT" && row.side === "buy")).toBe(true);
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
    expect(plan.trades).toHaveLength(0);

    const store = createMemoryStore();
    await expect(
      applyImport(store, plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/第 2 行 holder「Ghost」/);
    expect(store.trades).toHaveLength(0);
  });
});
