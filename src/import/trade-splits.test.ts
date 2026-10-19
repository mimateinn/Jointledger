import { describe, expect, it } from "vitest";
import { mapUpload } from "./columns";
import { buildPlan } from "./plan";

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

  it("names the TradeSplits row when the member is unknown", () => {
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
  });
});
