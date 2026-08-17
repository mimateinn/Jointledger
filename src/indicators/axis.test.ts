import { describe, expect, it } from "vitest";
import { priceDomain } from "./axis";
import type { Bar } from "./types";

function series(times: string[], prices: number[]): Bar[] {
  return times.map((time, i) => ({
    time,
    open: prices[i],
    high: prices[i] + 20,
    low: prices[i] - 20,
    close: prices[i],
    volume: 1,
  }));
}

describe("price domain", () => {
  it("uses only that series — HSI-like and XAU-like do not share a domain", () => {
    const hsi = series(
      ["2026-08-01", "2026-08-02", "2026-08-03"],
      [16820, 17367, 17428],
    );
    const xau = series(
      ["2026-08-01", "2026-08-02", "2026-08-03"],
      [2410, 2477, 2486],
    );
    const spy = series(["2026-08-01", "2026-08-02"], [560, 563]);
    const hsiDomain = priceDomain(hsi);
    const xauDomain = priceDomain(xau);
    const spyDomain = priceDomain(spy);
    expect(hsiDomain).toEqual({ min: 16800, max: 17448 });
    expect(xauDomain).toEqual({ min: 2390, max: 2506 });
    expect(spyDomain).toEqual({ min: 540, max: 583 });
    expect(hsiDomain).not.toEqual(xauDomain);
    expect(hsiDomain).not.toEqual(spyDomain);
    expect(xauDomain).not.toEqual(spyDomain);
  });

  it("returns null for an empty series instead of a borrowed 0700-style scale", () => {
    expect(priceDomain([])).toBeNull();
    const tencentLike = { min: 353.2, max: 381.8 };
    expect(priceDomain([])).not.toEqual(tencentLike);
  });
});
