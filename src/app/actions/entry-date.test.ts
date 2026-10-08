import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("date-accepting entry actions", () => {
  it("runs requireIsoDate through readOccurredOn on deposit, buy, and bookkeeping", () => {
    const src = readFileSync(new URL("./entry.ts", import.meta.url), "utf8");
    expect(src).toContain("function readOccurredOn");
    expect(src).toContain("requireIsoDate");
    expect(src.match(/readOccurredOn\(formData\)/g)?.length).toBe(3);
  });
});
