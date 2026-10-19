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

  it("errors when TradeSplits money is 0/0 on a 500 trade, naming the row", async () => {
    const { transinfo, account } = sheets();
    transinfo.rows = [["NVDA", "10", "F", "2024-02-01", "500", "t-1"]];
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["t-1", "Hey", "5", "0", "0"],
        ["t-1", "Sze", "5", "0", "0"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find(
      (item) => item.kind === "tradesplit_invalid" && item.message.includes("金額") && item.row === 2,
    );
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行/);
  });

  it("rejects negative TradeSplits quantity 12/-2 with the row number", async () => {
    const { transinfo, account } = sheets();
    transinfo.rows = [["NVDA", "10", "F", "2024-02-01", "500", "t-1"]];
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["t-1", "Hey", "12", "250", "0"],
        ["t-1", "Sze", "-2", "250", "0"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "tradesplit_invalid" && item.message.includes("數量"));
    expect(issue?.row).toBe(3);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("3");
  });

  it("rejects negative TradeSplits cost 550/-50 with the row number", async () => {
    const { transinfo, account } = sheets();
    transinfo.rows = [["NVDA", "10", "F", "2024-02-01", "500", "t-1"]];
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["t-1", "Hey", "5", "550", "0"],
        ["t-1", "Sze", "5", "-50", "0"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find((item) => item.kind === "tradesplit_invalid" && item.message.includes("金額"));
    expect(issue?.row).toBe(3);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("3");
  });

  it("rejects all-zero TradeSplits legs 7/0 + 3/0 on a 100 buy with the row number", async () => {
    const { transinfo, account } = sheets();
    transinfo.rows = [["NVDA", "10", "F", "2024-02-01", "100", "t-1"]];
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["t-1", "Hey", "7", "0", "0"],
        ["t-1", "Sze", "3", "0", "0"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find(
      (item) => item.kind === "tradesplit_invalid" && item.message.includes("金額") && item.row === 2,
    );
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    expect(plan.trades.find((row) => row.exportId === "t-1")?.customLegs).toBeUndefined();
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行/);
  });

  it("rejects buy money written in the proceeds column with the row number", async () => {
    const { transinfo, account } = sheets();
    transinfo.rows = [["NVDA", "10", "F", "2024-02-01", "100", "t-1"]];
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["t-1", "Hey", "5", "0", "50"],
        ["t-1", "Sze", "5", "0", "50"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find(
      (item) => item.kind === "tradesplit_invalid" && item.message.includes("賣出欄"),
    );
    expect(issue?.row).toBe(2);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    expect(issue?.message).toMatch(/買入/);
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行買入金額唔可以寫喺賣出欄/);
  });

  it("rejects sell money written in the cost column with the row number", async () => {
    const transinfo = {
      kind: "transinfo" as const,
      name: "TransInfo",
      headers: ["Code", "Qty", "Holder", "Buy Date", "Buy Total", "Sell Date", "Sell Price", "Sell Total", "Kind", "TradeId"],
      rows: [["NVDA", "10", "F", "", "", "2024-03-01", "10", "100", "sell", "t-1"]],
    };
    const account = {
      kind: "account" as const,
      name: "Account Detail",
      headers: ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"],
      rows: [
        ["2024-01-01", "入金", "H", "1000", "1", "1000", "in"],
        ["2024-03-01", "NVDA", "F", "", "", "", ""],
      ],
    };
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["t-1", "Hey", "5", "50", "50"],
        ["t-1", "Sze", "5", "50", "50"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(true);
    const issue = plan.issues.find(
      (item) => item.kind === "tradesplit_invalid" && item.message.includes("買入欄"),
    );
    expect(issue?.row).toBe(2);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    expect(issue?.message).toMatch(/賣出/);
    await expect(
      applyImport(createMemoryStore(), plan, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行賣出金額唔可以寫喺買入欄/);
  });

  it("accepts TradeSplits amounts that differ from the trade by 0.01 (s7)", () => {
    const { transinfo, account } = sheets();
    transinfo.rows = [["NVDA", "10", "F", "2024-02-01", "100", "t-1"]];
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [
        ["t-1", "Hey", "5", "50.01", "0"],
        ["t-1", "Sze", "5", "50.00", "0"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    expect(plan.blocking).toBe(false);
    expect(plan.issues.some((item) => item.kind === "tradesplit_invalid")).toBe(false);
    expect(plan.trades.find((row) => row.exportId === "t-1")?.customLegs).toEqual([
      { memberName: "Hey", quantity: "5", costUsd: "50.01", proceedsUsd: "0" },
      { memberName: "Sze", quantity: "5", costUsd: "50", proceedsUsd: "0" },
    ]);
  });

  it("does not crash on a blank TradeSplits money cell and names the row", async () => {
    const { transinfo, account } = sheets();
    const tradeSplits = {
      kind: "tradesplits" as const,
      name: "TradeSplits",
      headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
      rows: [["t-1", "Hey", "5"]],
    };
    let plan: ReturnType<typeof buildPlan>;
    expect(() => {
      plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), { tradeSplits });
    }).not.toThrow();
    expect(plan!.blocking).toBe(true);
    const issue = plan!.issues.find((item) => item.kind === "tradesplit_invalid" && item.message.includes("空白"));
    expect(issue?.row).toBe(2);
    expect(issue?.message).toContain("TradeSplits");
    expect(issue?.message).toContain("2");
    await expect(
      applyImport(createMemoryStore(), plan!, {
        createdByUserId: "user-1",
        creatorDisplayName: "Hey",
        decisions: importAll(plan!),
      }),
    ).rejects.toThrow(/TradeSplits 第 2 行金額空白/);
  });
});
