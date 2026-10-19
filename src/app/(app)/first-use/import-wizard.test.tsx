/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ImportActionState } from "@/app/actions/import";
import { mapUpload } from "@/import/columns";
import { dupAllocX3Sheets } from "@/import/fixtures/dup-alloc-x3";
import { buildPlan } from "@/import/plan";

const actionState: { current: ImportActionState } = { current: {} };

vi.mock("@/app/actions/import", () => ({
  parseImportAction: vi.fn(async () => ({})),
  confirmMapAction: vi.fn(async () => ({})),
  commitImportAction: vi.fn(async () => ({})),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  return {
    ...actual,
    useActionState: () => [actionState.current, vi.fn(), false],
  };
});

vi.mock("react-dom", async () => {
  const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
  return {
    ...actual,
    useFormStatus: () => ({ pending: false }),
  };
});

afterEach(() => {
  cleanup();
  actionState.current = {};
});

async function renderWizard(preview: ReturnType<typeof buildPlan>) {
  actionState.current = {
    draftId: "draft-1",
    preview,
    blocking: preview.blocking,
  };
  const { ImportWizard } = await import("./import-wizard");
  render(<ImportWizard />);
}

describe("import wizard blocking errors", () => {
  it("shows duplicate Allocation rows in the red alert as errors, not grey warning bullets", async () => {
    const sheets = dupAllocX3Sheets();
    const plan = buildPlan(
      "dup-alloc-x3.xlsx",
      "h",
      sheets.transinfo,
      sheets.account,
      mapUpload(sheets.transinfo, sheets.account),
      { members: sheets.members, allocation: sheets.allocation },
    );
    expect(plan.blocking).toBe(true);
    expect(plan.counts.errors).toBeGreaterThan(0);
    const openLot = plan.issues.find((item) => item.message.includes("賣出日空白"));
    if (openLot) {
      expect(plan.counts.warnings).toBeGreaterThan(0);
    }

    await renderWizard(plan);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Allocation");
    expect(alert.textContent).toContain("4");
    expect(alert.textContent).toContain("唔可以確認寫入");
    expect((screen.getByRole("button", { name: "確認寫入" }) as HTMLButtonElement).disabled).toBe(true);

    expect(screen.getByText(/錯誤 \d+/).textContent).toMatch(/錯誤 [1-9]/);
    const grey = document.querySelector("ul.muted");
    expect(grey?.textContent ?? "").not.toContain("Allocation 第 4 行");
    if (openLot) {
      expect(grey?.textContent).toContain("賣出日空白");
    }
  });

  it("shows duplicate member names (Kit/KIT) in the red alert and disables 確認寫入", async () => {
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
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members: {
        kind: "members",
        name: "Members",
        headers: ["Name"],
        rows: [["Kit"], ["KIT"]],
      },
    });

    await renderWizard(plan);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("Members");
    expect(alert.textContent).toContain("3");
    expect(alert.textContent).toMatch(/KIT|Kit/);
    expect((screen.getByRole("button", { name: "確認寫入" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector("ul.muted")?.textContent ?? "").not.toContain("KIT");
  });

  it("shows TradeSplits errors in the red alert and disables 確認寫入", async () => {
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
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      members: {
        kind: "members",
        name: "Members",
        headers: ["Name"],
        rows: [["Kit"]],
      },
      tradeSplits: {
        kind: "tradesplits",
        name: "TradeSplits",
        headers: ["TradeId", "Member", "Quantity"],
        rows: [
          ["T1", "Kit", "7"],
          ["T1", "Kit", "3"],
        ],
      },
    });

    await renderWizard(plan);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("TradeSplits");
    expect(alert.textContent).toContain("2");
    expect(alert.textContent).toContain("唔可以確認寫入");
    expect((screen.getByRole("button", { name: "確認寫入" }) as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelector("ul.muted")?.textContent ?? "").not.toContain("TradeSplits");
  });

  it("shows a blank TradeSplits money cell in the red alert", async () => {
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
      rows: [["2024-01-01", "入金", "H", "1000", "1", "1000", "in"]],
    };
    const plan = buildPlan("x.xlsx", "h", transinfo, account, mapUpload(transinfo, account), {
      tradeSplits: {
        kind: "tradesplits",
        name: "TradeSplits",
        headers: ["TradeId", "Member", "Quantity", "Cost", "Proceeds"],
        rows: [["t-1", "Hey", "5"]],
      },
    });

    await renderWizard(plan);

    const alert = screen.getByRole("alert");
    expect(alert.textContent).toContain("TradeSplits");
    expect(alert.textContent).toContain("2");
    expect(alert.textContent).toContain("空白");
    expect((screen.getByRole("button", { name: "確認寫入" }) as HTMLButtonElement).disabled).toBe(true);
  });
});
