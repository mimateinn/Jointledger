import { describe, expect, it } from "vitest";
import { computeRsi } from "./compute";

describe("RSI(14)", () => {
  it("is 100 after a long run of higher closes and 0 after a long run of lower closes", () => {
    const up = Array.from({ length: 20 }, (_, i) => 100 + i);
    const down = Array.from({ length: 20 }, (_, i) => 100 - i);
    const upRsi = computeRsi(up, 14);
    const downRsi = computeRsi(down, 14);
    expect(upRsi[upRsi.length - 1]).toBe(100);
    expect(downRsi[downRsi.length - 1]).toBe(0);
  });

  it("matches a Wilder seed on a small fixture", () => {
    const closes = [44, 44.15, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28];
    const rsi = computeRsi(closes, 14);
    expect(rsi[13]).toBeNull();
    expect(rsi[14]).not.toBeNull();
    expect(rsi[14]!).toBeGreaterThan(70);
    expect(rsi[14]!).toBeLessThan(80);
  });
});
