/** @vitest-environment jsdom */

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rectsOverlap } from "@/lib/rects";

function src(path: string): string {
  return readFileSync(path, "utf8");
}

describe("toast geometry", () => {
  it("reserves a band under the tape so the toast overlaps no mute control", () => {
    const css = src("src/app/components.css") + src("src/app/tokens.css");
    expect(css).toContain("--toast-reserve");
    expect(css).toMatch(/body:has\(\.toast\)\s+main\.main/);
    expect(css).toMatch(/padding-top:\s*calc\(var\(--page-pad\) \+ var\(--toast-reserve\)\)/);
    expect(css).toMatch(/top:\s*calc\(var\(--tape-h\) \+ env\(safe-area-inset-top\) \+ var\(--sp-2\)\)/);

    const tapeH = 32;
    const toast = { top: tapeH + 8, left: 40, right: 335, bottom: tapeH + 8 + 56 };
    const mute = {
      top: tapeH + 16 + 76,
      left: 16,
      right: 359,
      bottom: tapeH + 16 + 76 + 44,
    };
    expect(rectsOverlap(toast, mute)).toBe(false);
  });
});
