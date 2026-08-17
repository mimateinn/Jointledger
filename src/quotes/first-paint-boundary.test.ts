import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("first paint quote boundary", () => {
  it("overview and tape paint from cache while refresh stays in the background", () => {
    const layout = readFileSync("src/app/(app)/layout.tsx", "utf8");
    const book = readFileSync("src/lib/book-view.ts", "utf8");
    const holdings = readFileSync("src/app/(app)/holdings/page.tsx", "utf8");
    const api = readFileSync("src/app/api/quotes/route.ts", "utf8");
    expect(layout).toMatch(/refresh:\s*["']background["']/);
    expect(book).toMatch(/refresh:\s*["']background["']/);
    expect(holdings).toMatch(/refresh:\s*["']background["']/);
    expect(api).not.toMatch(/refresh:\s*["']background["']/);
  });
});
