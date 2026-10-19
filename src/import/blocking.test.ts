import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  allocationBlockingIssues,
  commitBlockingResponse,
  holderBlockingIssues,
  holderBlockingMessage,
  previewBlockingIssues,
  previewBlockingMessage,
} from "./blocking";
import { mapUpload } from "./columns";
import { buildPlan } from "./plan";
import type { ImportIssue, ImportPlan } from "./types";

function planWith(issues: ImportIssue[], blocking = true): Pick<ImportPlan, "issues" | "blocking"> {
  return { issues, blocking };
}

describe("import confirm blocking", () => {
  it("names the row and holder for an unknown-holder plan, and does not ask for column mapping", () => {
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
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    expect(plan.blocking).toBe(true);
    const holders = holderBlockingIssues(plan);
    expect(holders).toHaveLength(1);
    expect(holders[0]?.message).toContain("Ghost");
    expect(holders[0]?.message).toContain("2");
    const response = commitBlockingResponse(plan);
    expect(response?.needsMap).toBe(false);
    expect(response?.error).toContain("Ghost");
    expect(response?.error).toContain("2");
    expect(response?.error).not.toBe("欄位未確認，零寫入。");
  });

  it("keeps column-mapping only for unmapped headers", () => {
    const response = commitBlockingResponse(
      planWith([
        {
          id: "map-0",
          sheet: "transinfo",
          row: 0,
          kind: "unmapped_column",
          message: "未識別欄「Mystery」。",
          pending: false,
        },
      ]),
    );
    expect(response).toEqual({ error: "欄位未確認，零寫入。", needsMap: true });
  });

  it("wizard shows a holder error banner and disables 確認寫入", () => {
    const wizard = readFileSync("src/app/(app)/first-use/import-wizard.tsx", "utf8");
    expect(wizard).toContain("previewBlockingIssues");
    expect(wizard).toContain("確認寫入");
    expect(wizard).toMatch(/disabled=\{writeBlocked/);
    expect(wizard).toContain('role="alert"');
    expect(wizard).not.toMatch(/needsMap:\s*true/);
  });

  it("commitImportAction uses the preview blocking message instead of the mapping form", () => {
    const action = readFileSync("src/app/actions/import.ts", "utf8");
    expect(action).toContain("commitBlockingResponse");
    expect(action).toContain("previewBlockingMessage");
    expect(holderBlockingMessage({ issues: [] })).toBeNull();
    expect(previewBlockingMessage({ issues: [] })).toBeNull();
  });

  it("treats duplicate Allocation / member-name issues as preview-blocking errors", () => {
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
        rows: [["Kit"], ["KIT"]],
      },
    });
    expect(plan.blocking).toBe(true);
    expect(plan.counts.errors).toBeGreaterThan(0);
    expect(allocationBlockingIssues(plan).some((item) => item.kind === "duplicate_member")).toBe(true);
    const preview = previewBlockingIssues(plan);
    expect(preview.some((item) => item.message.includes("Members") && item.message.includes("3"))).toBe(true);
    expect(commitBlockingResponse(plan)?.needsMap).toBe(false);
  });

  it("treats TradeSplits and duplicate TradeId issues as preview-blocking errors", () => {
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
    expect(plan.counts.errors).toBeGreaterThan(0);
    expect(allocationBlockingIssues(plan).some((item) => item.kind === "tradesplit_invalid")).toBe(true);
    expect(previewBlockingIssues(plan).some((item) => item.message.includes("TransInfo") && item.message.includes("3"))).toBe(
      true,
    );
    expect(commitBlockingResponse(plan)?.needsMap).toBe(false);
    expect(commitBlockingResponse(plan)?.error).toContain("T1");
  });

  it("counts holder errors separately from skipped rows and open-lot warnings", () => {
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
      rows: [
        ["2024-01-01", "入金", "H", "1000", "1", "1000", "in"],
        ["2024-02-01", "入金", "S", "200", "", "200", "in"],
      ],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account));
    const errorCount = plan.issues.filter(
      (item) =>
        item.kind === "unknown_member" ||
        item.kind === "empty_holder" ||
        item.kind === "ambiguous_holder" ||
        item.kind === "allocation_invalid" ||
        item.kind === "tradesplit_invalid" ||
        item.kind === "duplicate_member",
    ).length;
    const skippedCount = plan.issues.filter((item) =>
      ["missing_fx", "missing_date", "missing_qty", "missing_amount", "unknown_own"].includes(item.kind),
    ).length;
    const warningCount = plan.issues.filter(
      (item) =>
        !item.pending &&
        item.kind !== "unmapped_column" &&
        item.kind !== "column_collision" &&
        item.kind !== "missing_required" &&
        !["missing_fx", "missing_date", "missing_qty", "missing_amount", "unknown_own"].includes(item.kind) &&
        item.kind !== "unknown_member" &&
        item.kind !== "empty_holder" &&
        item.kind !== "ambiguous_holder" &&
        item.kind !== "allocation_invalid" &&
        item.kind !== "tradesplit_invalid" &&
        item.kind !== "duplicate_member",
    ).length;
    expect(errorCount).toBeGreaterThan(0);
    expect(skippedCount).toBeGreaterThan(0);
    expect(plan.counts.errors).toBe(errorCount);
    expect(plan.counts.skipped).toBe(skippedCount);
    expect(plan.counts.warnings).toBe(warningCount);
    expect(plan.issues.some((item) => item.kind === "unknown_member")).toBe(true);
    expect(plan.issues.some((item) => item.kind === "missing_fx")).toBe(true);
    expect(
      plan.issues.filter((item) => item.kind === "unknown_member").length +
        plan.issues.filter((item) => item.kind === "missing_fx").length,
    ).toBe(plan.counts.errors + plan.counts.skipped);
  });
});
