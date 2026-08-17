import { describe, expect, it, vi } from "vitest";
import { createBook } from "@/ledger/create-book";
import { addMember } from "@/ledger/add-member";
import { createJointAccount } from "@/ledger/create-joint-account";
import { createMemoryStore } from "@/ledger/memory-store";
import { setAllocationSchedule } from "@/ledger/set-allocation-schedule";
import { openLotsFromTrades, summarizeLedger } from "@/ledger/summary";
import { applyImport } from "./apply";
import { mapUpload } from "./columns";
import { samplePlan, sampleSheets } from "./fixture";
import { buildPlan } from "./plan";

function importAll(plan: ReturnType<typeof samplePlan>) {
  const pending: Record<string, "import" | "skip"> = {};
  for (const issue of plan.issues.filter((item) => item.pending)) {
    pending[issue.id] = "import";
  }
  return { pending };
}

describe("M4 import apply", () => {
  it("calls createCashFlow / createTrade, not a private insert", async () => {
    const plan = samplePlan();
    expect(plan.blocking).toBe(false);
    const createCashFlowMock = vi.fn().mockResolvedValue({ id: "cf" });
    const createTradeMock = vi.fn().mockResolvedValue({
      trade: { id: "t" },
      allocation: { id: "a" },
      allocations: [{ id: "a" }],
    });
    const store = createMemoryStore();
    await applyImport(
      store,
      plan,
      {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      },
      {
        createBook,
        addMember,
        createJointAccount,
        setAllocationSchedule,
        createCashFlow: createCashFlowMock,
        createTrade: createTradeMock,
      },
    );
    expect(createCashFlowMock).toHaveBeenCalled();
    expect(createTradeMock).toHaveBeenCalled();
    expect(store.cashFlows).toHaveLength(0);
    expect(store.trades).toHaveLength(0);
    const firstCf = createCashFlowMock.mock.calls[0][1];
    expect(firstCf.amountHkd).toBe("1000");
    const firstTrade = createTradeMock.mock.calls[0][1];
    expect(firstTrade.costUsd).toBe("500");
    expect(firstTrade.symbol).toBe("NVDA");
  });

  it("keeps cash at 500 after deposit 1000 and buy cost 500", async () => {
    const plan = samplePlan();
    const store = createMemoryStore();
    const pending: Record<string, "import" | "skip"> = {};
    for (const issue of plan.issues.filter((item) => item.pending)) {
      pending[issue.id] = issue.symbol === "NVDA" ? "import" : "skip";
    }
    const result = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      decisions: { pending },
    });
    const cashFlows = await store.listCashFlows(result.bookId);
    const trades = await store.listTrades(result.bookId);
    const allocations = await store.listTradeAllocations(result.bookId);
    const lots = openLotsFromTrades(trades, allocations);
    const snap = summarizeLedger(cashFlows, allocations, lots);
    expect(snap.cashUsd.toFixed(2)).toBe("500.00");
    expect(snap.navUsd.toFixed(2)).toBe("500.00");
    expect(snap.partial).toBe(true);
    expect(snap.navUsd.toFixed(2)).not.toBe("1500.00");
    expect(snap.navUsd.toFixed(2)).not.toBe("1000.00");
  });

  it("tags sheet mismatches and 2020-21 open lots as 待確認", () => {
    const plan = samplePlan();
    const texts = plan.issues.map((issue) => issue.message).join("\n");
    expect(texts).toContain("TSLA");
    expect(texts).toContain("AAPL");
    expect(plan.issues.some((issue) => issue.kind === "open_lot" && issue.pending)).toBe(true);
    expect(plan.issues.some((issue) => issue.pending && issue.symbol === "TSLA")).toBe(true);
    expect(plan.issues.some((issue) => issue.pending && issue.symbol === "AAPL")).toBe(true);
  });

  it("does not default a joint mismatch to Hey solo", () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Own", "Buy Date", "Buy Price", "Buy Total"],
      rows: [["NVDA", "10", "H", "2020-05-01", "50", "500"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD"],
      rows: [
        ["2020-05-01", "NVDA", "F", "", "", ""],
        ["2020-04-01", "入金", "H", "1000", "1", "1000"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    const nvda = plan.trades.find((row) => row.symbol === "NVDA");
    expect(nvda?.book).toBe("joint");
    expect(plan.issues.some((issue) => issue.kind === "joint_mismatch")).toBe(true);
  });

  it("skips a cash row with missing FX and does not fill 0", () => {
    const { transinfo } = sampleSheets();
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD"],
      rows: [["2024-01-01", "入金", "H", "1000", "", "1000"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.cashFlows).toHaveLength(0);
    expect(plan.issues.some((issue) => issue.kind === "missing_fx")).toBe(true);
  });

  it("re-imports onto an existing book without createBook", async () => {
    const plan = samplePlan();
    const store = createMemoryStore();
    const first = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    const createBookMock = vi.fn();
    const beforeFlows = (await store.listCashFlows(first.bookId)).length;
    await applyImport(
      store,
      plan,
      {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        existingBookId: first.bookId,
        decisions: { ...importAll(plan), reimportMode: "append" },
      },
      { createBook: createBookMock },
    );
    expect(createBookMock).not.toHaveBeenCalled();
    expect(store.books).toHaveLength(1);
    expect((await store.listCashFlows(first.bookId)).length).toBeGreaterThan(beforeFlows);
  });

  it("replace on an existing book clears then writes via createCashFlow / createTrade", async () => {
    const plan = samplePlan();
    const store = createMemoryStore();
    const first = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    const afterFirst = (await store.listCashFlows(first.bookId)).length;
    await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      existingBookId: first.bookId,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    expect(store.books).toHaveLength(1);
    expect((await store.listCashFlows(first.bookId)).length).toBe(afterFirst);
  });

  it("refuses existing-book import without an explicit append/replace", async () => {
    const plan = samplePlan();
    const store = createMemoryStore();
    const first = await applyImport(store, plan, {
      createdByUserId: "user-1",
      creatorDisplayName: "Hey",
      decisions: importAll(plan),
    });
    await expect(
      applyImport(store, plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        existingBookId: first.bookId,
        decisions: importAll(plan),
      }),
    ).rejects.toThrow("再匯入要明示追加或取代");
  });

  it("blocks writes when a header is unrecognized", () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["???", "Qty", "Own", "Buy Date", "Buy Total"],
      rows: [["NVDA", "10", "H", "2024-01-02", "500"]],
    };
    const { account } = sampleSheets();
    const mapping = mapUpload(transinfo, account);
    expect(mapping.blocking).toBe(true);
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapping);
    expect(plan.blocking).toBe(true);
    expect(plan.cashFlows).toHaveLength(0);
    expect(plan.trades).toHaveLength(0);
  });
});
