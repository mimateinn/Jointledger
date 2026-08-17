import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) {
      walk(path, acc);
    } else if (path.endsWith(".ts") || path.endsWith(".tsx")) {
      acc.push(path);
    }
  }
  return acc;
}

describe("quote client boundary", () => {
  it("does not put the Twelve Data lookup table or API key in client modules", () => {
    const files = walk(join(process.cwd(), "src"));
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      const isClient = /^\s*["']use client["']/.test(text);
      if (!isClient) {
        continue;
      }
      expect(text, file).not.toMatch(/TWELVE_DATA_API_KEY/);
      expect(text, file).not.toMatch(/NEXT_PUBLIC_.*API_KEY/);
      expect(text, file).not.toMatch(/from ["']@\/quotes\/symbol-map["']/);
      expect(text, file).not.toMatch(/from ["']@\/ohlcv(\/|["'])/);
      expect(text, file).not.toMatch(/api\.twelvedata\.com/);
      expect(text, file).not.toMatch(/massive\.com/);
    }
  });
});
