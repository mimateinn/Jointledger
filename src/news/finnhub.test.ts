import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { fetchCompanyNews, fetchMarketNews, finnhubKey } from "./finnhub";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "node_modules" || name === ".next") {
      continue;
    }
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, acc);
    } else if (/\.(ts|tsx|js|mjs)$/.test(name) && !name.endsWith(".test.ts")) {
      acc.push(path);
    }
  }
  return acc;
}

describe("Finnhub news boundary", () => {
  it("never calls Finnhub quote and never puts the key in the browser", () => {
    const files = walk(join(process.cwd(), "src"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      expect(text, file).not.toMatch(/finnhub\.io\/api\/v1\/quote/);
      expect(text, file).not.toMatch(/NEXT_PUBLIC_FINNHUB/);
      if (/^\s*["']use client["']/.test(text)) {
        expect(text, file).not.toMatch(/FINNHUB_API_KEY/);
        expect(text, file).not.toMatch(/finnhub\.io/);
      }
    }
    const news = walk(join(process.cwd(), "src/news")).map((file) => readFileSync(file, "utf8")).join("\n");
    expect(news).toContain("company-news");
    expect(news).toContain("api/v1/news");
    expect(news).toContain("?category=");
    expect(news).not.toMatch(/\/quote\b/);
  });

  it("empty key → empty list, no throw", async () => {
    const prev = process.env.FINNHUB_API_KEY;
    process.env.FINNHUB_API_KEY = "";
    expect(finnhubKey()).toBe("");
    await expect(fetchCompanyNews("AAPL")).resolves.toEqual([]);
    await expect(fetchMarketNews("general")).resolves.toEqual([]);
    process.env.FINNHUB_API_KEY = prev;
  });
});
