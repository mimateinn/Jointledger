import { describe, expect, it } from "vitest";
import { rectsOverlap } from "./rects";

describe("rectsOverlap", () => {
  it("detects overlap and separated boxes", () => {
    expect(
      rectsOverlap({ top: 40, left: 40, right: 360, bottom: 96 }, { top: 80, left: 20, right: 200, bottom: 140 }),
    ).toBe(true);
    expect(
      rectsOverlap({ top: 40, left: 40, right: 360, bottom: 88 }, { top: 120, left: 20, right: 200, bottom: 164 }),
    ).toBe(false);
  });
});
