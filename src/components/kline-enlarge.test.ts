import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("candlestick enlarge", () => {
  it("toggles enlarge and does not lock the small window to 360px", () => {
    const kline = readFileSync("src/components/kline-chart.tsx", "utf8");
    const shell = readFileSync("src/components/instrument-kline.tsx", "utf8");
    const css = readFileSync("src/app/globals.css", "utf8");
    expect(shell).toContain("放大");
    expect(shell).toContain("還原");
    expect(shell).toContain("kline-stage-open");
    expect(kline).not.toMatch(/Math\.max\(360/);
    expect(css).not.toMatch(/\.kline\s*\{[^}]*min-height:\s*360px/);
    expect(css).toContain("aspect-ratio");
    expect(css).toContain("100dvh");
  });
});
