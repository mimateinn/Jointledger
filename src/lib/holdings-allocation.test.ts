import { describe, expect, it } from "vitest";
import { buildAllocation, currencyKeyFromSymbol, marketKeyFromSymbol } from "./holdings-allocation";

describe("holdings allocation", () => {
  it("classifies market and currency from the ticker", () => {
    expect(marketKeyFromSymbol("NVDA")).toBe("US");
    expect(marketKeyFromSymbol("0700.HK")).toBe("HK");
    expect(currencyKeyFromSymbol("0700.HK")).toBe("HKD");
    expect(currencyKeyFromSymbol("AAPL")).toBe("USD");
  });

  it("returns an empty result when there are no lots", () => {
    const result = buildAllocation([], "market");
    expect(result.total).toBe(0);
    expect(result.slices).toEqual([]);
    expect(result.singleGroup).toBe(true);
  });

  it("groups by market using market value and falls back to cost", () => {
    const result = buildAllocation(
      [
        { symbol: "NVDA", marketValueUsd: "8000", costUsd: "5000", lastDisplay: "120.00" },
        { symbol: "0700.HK", marketValueUsd: "2000", costUsd: "1800", lastDisplay: "380.00" },
        { symbol: "CASHX", marketValueUsd: null, costUsd: "500", lastDisplay: null },
      ],
      "market",
    );
    expect(result.total).toBe(10500);
    expect(result.missingPrice).toBe(1);
    expect(result.slices[0]).toMatchObject({ key: "US", label: "美股" });
    expect(result.slices[0].pct).toBeCloseTo(81.0, 1);
    expect(result.slices.find((s) => s.key === "HK")?.value).toBe(2000);
    expect(result.slices.reduce((sum, slice) => sum + slice.pct, 0)).toBeCloseTo(100, 5);
  });

  it("groups a single lot as one 100% member slice", () => {
    const one = buildAllocation(
      [{ symbol: "NVDA", memberLabel: "Member A", marketValueUsd: "100", costUsd: "80", lastDisplay: "10" }],
      "member",
    );
    expect(one.singleGroup).toBe(true);
    expect(one.slices[0].label).toBe("Member A");
    expect(one.slices[0].pct).toBe(100);
  });

  it("clamps negative values so they do not shrink the pie", () => {
    const result = buildAllocation(
      [
        { symbol: "AAPL", marketValueUsd: "100", costUsd: "80", lastDisplay: "10" },
        { symbol: "LOSS", marketValueUsd: "-40", costUsd: "-40", lastDisplay: "1" },
      ],
      "market",
    );
    expect(result.total).toBe(100);
    expect(result.slices.every((slice) => slice.value >= 0)).toBe(true);
    expect(result.slices.reduce((sum, slice) => sum + slice.pct, 0)).toBe(100);
  });

  it("folds many slices into 其他 and still rounds to 100%", () => {
    const lots = ["A", "B", "C", "D", "E", "F", "G"].map((name, index) => ({
      symbol: "AAPL",
      memberLabel: `Member ${name}`,
      marketValueUsd: String(100 + index),
      costUsd: "10",
      lastDisplay: "1",
    }));
    const result = buildAllocation(lots, "member");
    expect(result.slices.length).toBeLessThanOrEqual(6);
    expect(result.slices.some((slice) => slice.key === "other")).toBe(true);
    expect(result.slices.reduce((sum, slice) => sum + slice.pct, 0)).toBeCloseTo(100, 5);
  });
});
