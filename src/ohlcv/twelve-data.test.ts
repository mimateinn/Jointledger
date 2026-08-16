import { describe, expect, it } from "vitest";
import { TIME_SERIES_INTERVAL, TIME_SERIES_OUTPUT_SIZE, TIME_SERIES_PATH } from "./constants";
import { buildTimeSeriesUrl, classifyTimeSeriesBody, parseTimeSeriesBars } from "./twelve-data";

describe("Twelve Data time_series", () => {
  it("requests daily bars with outputsize 250–500", () => {
    const url = buildTimeSeriesUrl("NVDA", "NASDAQ");
    expect(url.pathname).toBe(TIME_SERIES_PATH);
    expect(url.searchParams.get("interval")).toBe(TIME_SERIES_INTERVAL);
    expect(url.searchParams.get("interval")).toBe("1day");
    expect(url.searchParams.get("outputsize")).toBe(String(TIME_SERIES_OUTPUT_SIZE));
    expect(TIME_SERIES_OUTPUT_SIZE).toBeGreaterThanOrEqual(250);
    expect(TIME_SERIES_OUTPUT_SIZE).toBeLessThanOrEqual(500);
    expect(url.searchParams.get("outputsize")).not.toBe("5000");
    expect(url.searchParams.get("symbol")).toBe("NVDA");
    expect(url.searchParams.get("exchange")).toBe("NASDAQ");
  });

  it("does not invent candles from a last quote or incomplete rows", () => {
    expect(parseTimeSeriesBars(undefined)).toEqual([]);
    expect(parseTimeSeriesBars([])).toEqual([]);
    expect(
      parseTimeSeriesBars([{ datetime: "2026-08-01", open: "100", high: "110", low: "90", close: null as unknown as string }]),
    ).toEqual([]);
    expect(classifyTimeSeriesBody(200, { close: "178.42" }).kind).toBe("empty");
    expect(classifyTimeSeriesBody(401, { code: 401, status: "error" }).kind).toBe("unauthorized");
    expect(classifyTimeSeriesBody(403, { code: 403, message: "Upgrade your plan", status: "error" }).kind).toBe("plan");
    expect(classifyTimeSeriesBody(404, { code: 404, status: "error" }).kind).toBe("not_found");
    expect(classifyTimeSeriesBody(429, { code: 429, status: "error" }).kind).toBe("rate_limited");
    expect(classifyTimeSeriesBody(500, { status: "error" }).kind).toBe("upstream");
  });

  it("parses valid daily bars newest-first into ascending time", () => {
    const outcome = classifyTimeSeriesBody(200, {
      status: "ok",
      values: [
        { datetime: "2026-08-04", open: "175", high: "180", low: "174", close: "178.42", volume: "12" },
        { datetime: "2026-08-01", open: "170", high: "176", low: "168", close: "175", volume: "10" },
      ],
    });
    expect(outcome).toEqual({
      kind: "ok",
      bars: [
        { time: "2026-08-01", open: 170, high: 176, low: 168, close: 175, volume: 10 },
        { time: "2026-08-04", open: 175, high: 180, low: 174, close: 178.42, volume: 12 },
      ],
    });
  });
});
