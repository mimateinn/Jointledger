import { describe, expect, it } from "vitest";
import { lastGoodStillFresh, resolveDisplayedMark } from "./apply-status";
import { classifyTwelveDataBody } from "./twelve-data";

describe("quote failure mapping", () => {
  const lastGood = { last: "60", percentChange: "1.2", fetchedAt: new Date("2026-08-14T00:00:00Z") };
  const now = new Date("2026-08-16T00:00:00Z");

  it("maps no key / 401 / 403 / 404 / empty to — and excludes last-good", () => {
    for (const outcome of [
      { kind: "no_key" as const },
      { kind: "unauthorized" as const },
      { kind: "plan" as const },
      { kind: "not_found" as const },
      { kind: "denied" as const },
      { kind: "empty" as const },
    ]) {
      const mark = resolveDisplayedMark(outcome, lastGood, now);
      expect(mark.last).toBeNull();
      expect(mark.usedLastGood).toBe(false);
    }
  });

  it("uses last-good on 429 / 5xx when ≤7 calendar days", () => {
    const limited = resolveDisplayedMark({ kind: "rate_limited" }, lastGood, now);
    expect(limited.last).toBe("60");
    expect(limited.usedLastGood).toBe(true);
    const stale = resolveDisplayedMark(
      { kind: "upstream" },
      { ...lastGood, fetchedAt: new Date("2026-08-08T00:00:00Z") },
      now,
    );
    expect(stale.last).toBeNull();
    expect(lastGoodStillFresh(new Date("2026-08-09T12:00:00Z"), now)).toBe(true);
    expect(lastGoodStillFresh(new Date("2026-08-08T12:00:00Z"), now)).toBe(false);
  });

  it("classifies Twelve Data bodies without inventing a price", () => {
    expect(classifyTwelveDataBody(401, { code: 401, status: "error" }).kind).toBe("unauthorized");
    expect(classifyTwelveDataBody(403, { code: 403, message: "Upgrade your plan", status: "error" }).kind).toBe(
      "plan",
    );
    expect(classifyTwelveDataBody(404, { code: 404, status: "error" }).kind).toBe("not_found");
    expect(classifyTwelveDataBody(429, { code: 429, status: "error" }).kind).toBe("rate_limited");
    expect(classifyTwelveDataBody(500, { status: "error" }).kind).toBe("upstream");
    expect(classifyTwelveDataBody(200, { close: null }).kind).toBe("empty");
    expect(classifyTwelveDataBody(200, { close: "178.42", percent_change: "2.14" })).toMatchObject({
      kind: "ok",
      last: "178.42",
    });
  });
});
