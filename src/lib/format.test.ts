import { describe, expect, it } from "vitest";
import { todayIso } from "./format";

describe("todayIso", () => {
  it("uses the Asia/Shanghai calendar date, not UTC", () => {
    expect(todayIso(new Date("2026-08-16T16:30:00.000Z"))).toBe("2026-08-17");
    expect(todayIso(new Date("2026-08-16T01:00:00.000Z"))).toBe("2026-08-16");
  });
});
