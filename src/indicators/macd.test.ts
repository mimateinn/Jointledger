import { describe, expect, it } from "vitest";
import { computeMacd } from "./compute";
import { ema } from "./math";

describe("MACD(12,26,9)", () => {
  it("is EMA12 − EMA26 with a 9-period signal of that line", () => {
    const values = Array.from({ length: 40 }, (_, i) => 100 + i * 0.5);
    const { macd, signal, hist } = computeMacd(values, 12, 26, 9);
    const fast = ema(values, 12);
    const slow = ema(values, 26);
    const last = values.length - 1;
    expect(macd[last]).toBeCloseTo(fast[last]! - slow[last]!, 10);
    expect(hist[last]).toBeCloseTo(macd[last]! - signal[last]!, 10);
    expect(macd[25]).not.toBeNull();
    expect(macd[24]).toBeNull();
  });
});
