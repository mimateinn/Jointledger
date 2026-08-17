import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_ON_IDS, FORBIDDEN_INDICATOR_IDS, INDICATOR_GROUPS, INDICATORS } from "./catalog";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, acc);
    } else if ((path.endsWith(".ts") || path.endsWith(".tsx")) && !path.endsWith(".test.ts")) {
      acc.push(path);
    }
  }
  return acc;
}

describe("indicator catalog", () => {
  it("defaults to SMA20 + Volume only", () => {
    expect(DEFAULT_ON_IDS.sort()).toEqual(["sma20", "volume"].sort());
    expect(INDICATORS.find((row) => row.id === "sma50")?.defaultOn).toBe(false);
    expect(INDICATORS.find((row) => row.id === "sma200")?.defaultOn).toBe(false);
    expect(INDICATORS.find((row) => row.id === "bbands")?.defaultOn).toBe(false);
    expect(INDICATORS.find((row) => row.id === "rsi")?.defaultOn).toBe(false);
    expect(INDICATORS.find((row) => row.id === "macd")?.defaultOn).toBe(false);
  });

  it("uses the five locked groups and omits VWAP / MOM / ROC / CMF", () => {
    expect(INDICATOR_GROUPS.map((row) => row.label)).toEqual(["均線", "通道", "動量", "量能", "波動"]);
    const ids = INDICATORS.map((row) => row.id);
    expect(ids).toEqual([
      "sma20",
      "sma50",
      "sma200",
      "ema12",
      "ema26",
      "vwma20",
      "bbands",
      "donchian",
      "keltner",
      "ichimoku",
      "psar",
      "supertrend",
      "rsi",
      "macd",
      "stoch",
      "stochrsi",
      "cci",
      "willr",
      "volume",
      "mfi",
      "obv",
      "atr",
      "adx",
    ]);
    for (const forbidden of FORBIDDEN_INDICATOR_IDS) {
      expect(ids).not.toContain(forbidden);
    }
  });

  it("keeps indicator modules free of fetch and env", () => {
    for (const file of walk(join(process.cwd(), "src/indicators"))) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/process\.env/);
      expect(text, file).not.toMatch(/\bfetch\s*\(/);
      expect(text, file).not.toMatch(/TWELVE_DATA/);
      expect(text, file).not.toMatch(/api\.twelvedata\.com/);
    }
  });
});
