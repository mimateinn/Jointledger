import { describe, expect, it } from "vitest";
import { autoMapSheet, mapUpload } from "./columns";
import { normalizeScheduleLegs } from "./canon";

describe("column map", () => {
  it("auto-maps the 兩頁 xlsx headers", () => {
    const ti = autoMapSheet("transinfo", [
      "Code",
      "Qty",
      "Own",
      "Buy Date",
      "Buy Price",
      "Buy Total",
      "Sell Date",
    ]);
    expect(ti.issues).toHaveLength(0);
    const ad = autoMapSheet("account", ["Date", "Detail", "Own", "HKD", "FX", "USD", "In/Out"]);
    expect(ad.issues).toHaveLength(0);
  });

  it("stops when one target is claimed twice", () => {
    const result = autoMapSheet("transinfo", ["Qty", "Quantity", "Code", "Own", "Buy Date", "Buy Total"]);
    expect(result.issues.some((issue) => issue.kind === "column_collision")).toBe(true);
  });

  it("stops on an unknown header", () => {
    const mapped = mapUpload(
      {
        kind: "transinfo",
        name: "TransInfo",
        headers: ["Mystery", "Qty", "Own", "Buy Date", "Buy Total"],
        rows: [],
      },
      {
        kind: "account",
        name: "Account Detail",
        headers: ["Date", "Detail", "Own", "HKD", "FX"],
        rows: [],
      },
    );
    expect(mapped.blocking).toBe(true);
    expect(mapped.issues.some((issue) => issue.kind === "unmapped_column")).toBe(true);
  });
});

describe("分帳 schedule", () => {
  it("normalizes 50 / 50 to 1", () => {
    const legs = normalizeScheduleLegs([
      { name: "Hey", raw: "50" },
      { name: "Sze", raw: "50" },
    ]);
    const sum = Number(legs[0].percent) + Number(legs[1].percent);
    expect(sum).toBeCloseTo(1, 8);
    expect(legs[0].percent.startsWith("0.49487")).toBe(true);
  });
});
