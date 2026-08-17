import { describe, expect, it } from "vitest";
import { CANON_SCHEDULES, normalizeScheduleLegs } from "@/import/canon";
import { formatSchedulePercent, todayIso } from "./format";

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

describe("todayIso", () => {
  it("uses the Asia/Shanghai calendar date, not UTC", () => {
    expect(todayIso(new Date("2026-08-16T16:30:00.000Z"))).toBe("2026-08-17");
    expect(todayIso(new Date("2026-08-16T01:00:00.000Z"))).toBe("2026-08-16");
  });
});
