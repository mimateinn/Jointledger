import { describe, expect, it } from "vitest";
import { buildAllocation, currencyKeyFromSymbol, marketKeyFromSymbol } from "./holdings-allocation";

describe("holdings allocation", () => {
  it("classifies market and currency from the ticker", () => {
    expect(marketKeyFromSymbol("NVDA")).toBe("US");
    expect(marketKeyFromSymbol("0700.HK")).toBe("HK");
    expect(currencyKeyFromSymbol("0700.HK")).toBe("HKD");
    expect(currencyKeyFromSymbol("AAPL")).toBe("USD");
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
    expect(result.slices[0].pct).toBeCloseTo(80.95, 1);
    expect(result.slices.find((s) => s.key === "HK")?.value).toBe(2000);
  });

  it("groups by book and reports a single-group state", () => {
    const one = buildAllocation(
      [{ symbol: "NVDA", memberLabel: "Member A", marketValueUsd: "100", costUsd: "80", lastDisplay: "10" }],
      "book",
    );
    expect(one.singleGroup).toBe(true);
    expect(one.slices[0].label).toBe("Member A");
    expect(one.slices[0].pct).toBe(100);
  });
});
