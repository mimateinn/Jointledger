import { describe, expect, it } from "vitest";
import { DIVIDEND_NOTE_PREFIX, dividendNote, isDividendNote } from "./dividend";

describe("dividend note convention", () => {
  it("treats the prefix and a following detail as a dividend", () => {
    expect(isDividendNote(DIVIDEND_NOTE_PREFIX)).toBe(true);
    expect(isDividendNote("股息 AAPL")).toBe(true);
    expect(isDividendNote("rounding")).toBe(false);
    expect(isDividendNote(null)).toBe(false);
    expect(isDividendNote("")).toBe(false);
  });

  it("builds a stable note without duplicating the prefix", () => {
    expect(dividendNote("")).toBe("股息");
    expect(dividendNote("AAPL")).toBe("股息 AAPL");
    expect(dividendNote("股息 AAPL")).toBe("股息 AAPL");
    expect(dividendNote("股息")).toBe("股息");
  });
});
