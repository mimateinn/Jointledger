import { describe, expect, it } from "vitest";
import { normalizeScheduleLegs } from "@/import/canon";
import {
  formatAsOfClock,
  formatQty,
  formatRelativeDate,
  formatSchedulePercent,
  formatUsd,
  todayChangeLabel,
  todayIso,
} from "./format";

describe("formatSchedulePercent", () => {
  it("multiplies stored unit fractions by 100; does not treat 0.49 as 0.5%", () => {
    const legs = normalizeScheduleLegs([
      { name: "Hey", raw: "40" },
      { name: "Sze", raw: "60" },
    ]);
    expect(legs[0].percent.startsWith("0.4")).toBe(true);
    expect(legs[1].percent.startsWith("0.6")).toBe(true);
    expect(formatSchedulePercent(legs[0].percent)).toBe("40.0%");
    expect(formatSchedulePercent(legs[1].percent)).toBe("60.0%");
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

describe("todayChangeLabel", () => {
  it("writes % when there is a last price, including 0.00%", () => {
    expect(todayChangeLabel("225.01", "+1.20%")).toBe("+1.20%");
    expect(todayChangeLabel("225.01", "0.00%")).toBe("0.00%");
    expect(todayChangeLabel("225.01", null)).toBe("0.00%");
    expect(todayChangeLabel("225.01", "—")).toBe("0.00%");
  });

  it("writes the buy-price sentence only when there is no last price", () => {
    expect(todayChangeLabel(null, null)).toBe("暫時用買入價，未有市場價");
    expect(todayChangeLabel(null, "+1.20%")).toBe("暫時用買入價，未有市場價");
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
