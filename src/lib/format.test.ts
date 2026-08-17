import { describe, expect, it } from "vitest";
import { CANON_SCHEDULES, normalizeScheduleLegs } from "@/import/canon";
import { formatAsOfClock, formatQty, formatRelativeDate, formatSchedulePercent, formatUsd, todayIso } from "./format";

describe("formatSchedulePercent", () => {
  it("multiplies stored unit fractions by 100; does not treat 0.49 as 0.5%", () => {
    const legs = normalizeScheduleLegs(CANON_SCHEDULES[1].legs);
    expect(legs[0].percent.startsWith("0.49487")).toBe(true);
    expect(legs[1].percent.startsWith("0.50512")).toBe(true);
    expect(Number(legs[0].percent).toFixed(1)).toBe("0.5");
    expect(formatSchedulePercent(legs[0].percent)).toBe("49.5%");
    expect(formatSchedulePercent(legs[1].percent)).toBe("50.5%");
  });
});

describe("formatQty", () => {
  it("shows 10 not 10.0000", () => {
    expect(formatQty("10")).toBe("10");
    expect(formatQty("10.5")).toBe("10.5");
    expect(formatQty("1000")).toBe("1,000");
  });
});

describe("formatUsd", () => {
  it("uses one currency system with thousands and decimals", () => {
    expect(formatUsd("1234.5")).toBe("US$ 1,234.50");
    expect(formatUsd("0")).toBe("US$ 0.00");
    expect(formatUsd("-50")).toBe("-US$ 50.00");
  });
});

describe("formatRelativeDate", () => {
  it("uses 今天／昨天 when recent in HKT", () => {
    const now = new Date("2026-08-17T16:00:00+08:00");
    expect(formatRelativeDate("2026-08-17", now)).toBe("今天");
    expect(formatRelativeDate("2026-08-16", now)).toBe("昨天");
    expect(formatRelativeDate("2026-08-01", now)).toBe("2026-08-01");
  });
});

describe("formatAsOfClock", () => {
  it("labels NAV as-of with 截至", () => {
    expect(formatAsOfClock(new Date("2026-08-17T21:04:00+08:00"))).toBe("截至 21:04");
  });
});

describe("todayIso", () => {
  it("uses the Asia/Shanghai calendar date, not UTC", () => {
    expect(todayIso(new Date("2026-08-16T16:30:00.000Z"))).toBe("2026-08-17");
    expect(todayIso(new Date("2026-08-16T01:00:00.000Z"))).toBe("2026-08-16");
  });
});
