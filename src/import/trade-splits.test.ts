import { describe, expect, it } from "vitest";
import { createMemoryStore } from "@/ledger/memory-store";
import { applyImport } from "./apply";
import { mapUpload } from "./columns";
import { buildPlan } from "./plan";

function importAll(plan: ReturnType<typeof buildPlan>) {
  const pending: Record<string, "import" | "skip"> = {};
  for (const issue of plan.issues.filter((item) => item.pending)) {
    pending[issue.id] = "import";
  }
  return { pending };
}

function sheets() {
  const transinfo = {
    kind: "transinfo" as const,
    name: "TransInfo",
    headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total", "TradeId"],
    rows: [["NVDA", "10", "F", "2024-02-01", "100", "t-1"]],
  };
  const account = {
    kind: "account" as const,
    name: "Account Detail",
    headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
    rows: [
      ["2024-01-01", "入金", "H", "1000", "1", "1000", "in"],
      ["2024-01-01", "入金", "S", "1000", "1", "1000", "in"],
    ],
  };
  return { transinfo, account };
}

describe("TradeSplits sheet", () => {
  it("errors on missing TradeId / Member / Quantity headers", () => {
    const { transinfo, account } = sheets();
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["Date", "Symbol"],
      rows: [["2024-02-01", "NVDA"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    expect(plan.issues.some((issue) => issue.message.includes("表頭缺必要欄"))).toBe(true);
  });

  it("names the TradeSplits row when the member is unknown", async () => {
    const { transinfo, account } = sheets();
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity"],
      rows: [
        ["t-1", "Hey", "5"],
        ["t-1", "Ghost", "5"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "unknown_member");
    expect(issue?.row).toBe(3);
    expect(issue?.message).toContain("Ghost");
    expect(issue?.message).toContain("3");
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 3 行成員「Ghost」/);
  });

  it("rejects TradeSplits legs on a personal Kit trade (r9)", async () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total", "TradeId"],
      rows: [["NVDA", "10", "Kit", "2024-02-01", "100", "T1"]],
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
      rows: [["Kit"]],
    };
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity"],
      rows: [
        ["T1", "Kit", "7"],
        ["T1", "Kit", "3"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members,
      tradeSplits,
    });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "tradesplit_invalid");
    expect(issue?.row).toBe(2);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    expect(issue?.message).toMatch(/聯名|個人|唔係/);
    expect(plan.trades.find((row) => row.exportId === "T1")?.customLegs).toBeUndefined();
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Kit",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行 TradeId「T1」唔係聯名買賣/);
  });

  it("errors when TradeSplits TradeId is unknown, naming the row (r10)", async () => {
    const { transinfo, account } = sheets();
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity"],
      rows: [
        ["T-missing", "Hey", "5"],
        ["T-missing", "Sze", "5"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "tradesplit_invalid" && item.message.includes("T-missing"));
    expect(issue?.row).toBe(2);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    expect(issue?.message).toContain("T-missing");
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行 TradeId「T-missing」/);
  });

  it("errors when dividend TradeSplits amounts 100+100 do not sum to 9, naming the row", async () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total", "Kind", "TradeId"],
      rows: [["MSFT", "", "F", "2024-07-01", "9", "股息", "T1"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [["2024-07-01", "MSFT", "F", "", "", "", ""]],
    };
    const members = {
      kind: "members" as const,
      name: "Members",
      headers: ["Name"],
      rows: [["Hey"], ["Sze"]],
    };
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["T1", "Hey", "0", "0", "100"],
        ["T1", "Sze", "0", "0", "100"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members,
      tradeSplits,
    });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "tradesplit_invalid" && item.message.includes("金額"));
    expect(issue?.row).toBe(2);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行分帳金額/);
  });

  it("errors on a duplicate TradeId in TransInfo, naming the row", async () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total", "TradeId"],
      rows: [
        ["NVDA", "10", "F", "2024-02-01", "100", "T1"],
        ["AAPL", "4", "F", "2024-03-01", "40", "T1"],
      ],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [
        ["2024-02-01", "NVDA", "F", "", "", "", ""],
        ["2024-03-01", "AAPL", "F", "", "", "", ""],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.message.includes("T1") && item.message.includes("重複"));
    expect(issue?.sheet).toBe("transinfo");
    expect(issue?.row).toBe(3);
    expect(issue?.message).toContain("TransInfo");
    expect(issue?.message).toContain("3");
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TransInfo 第 3 行 TradeId「T1」同第 2 行重複/);
  });
});
