import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next" || name === "dist") {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, acc);
    } else if (/\.(ts|tsx|js|mjs|md|json)$/.test(name) && !name.endsWith(".test.ts")) {
      acc.push(path);
    }
  }
  return acc;
}

describe("OHLCV client / upstream boundary", () => {
  it("never calls Twelve Data indicator endpoints or outputsize 5000", () => {
    const files = walk(join(process.cwd(), "src"));
    const forbidden = [/\/sma\b/, /\/rsi\b/, /\/macd\b/, /\/bbands\b/, /\/ema\b/, /\/stoch\b/, /\/vwap\b/];
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        expect(text, file).not.toMatch(pattern);
      }
      expect(text, file).not.toMatch(/outputsize["'\s:=]+5000/);
      expect(text, file).not.toMatch(/interval["'\s:=]+1min/);
    }
  });

  it("does not hardcode a 0700 price axis on the chart", () => {
    const chart = readFileSync(join(process.cwd(), "src/components/kline-chart.tsx"), "utf8");
    expect(chart).not.toMatch(/353\.2/);
    expect(chart).not.toMatch(/381\.8/);
    expect(chart).not.toMatch(/0700/);
    expect(chart).not.toMatch(/minValue:\s*353/);
    expect(chart).not.toMatch(/maxValue:\s*381/);
  });
});
