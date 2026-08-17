import { describe, expect, it } from "vitest";
import { computeSma, sma } from "./index";

describe("SMA", () => {
  it("averages the last N closes and stays null until the window is full", () => {
    const values = [1, 2, 3, 4, 5];
    expect(sma(values, 3)).toEqual([null, null, 2, 3, 4]);
    expect(computeSma(values, 2)).toEqual([null, 1.5, 2.5, 3.5, 4.5]);
  });

  it("skips a window that contains a gap instead of inventing a value", () => {
    expect(sma([1, null, 3, 4, 5], 3)).toEqual([null, null, null, null, 4]);
  });
});
