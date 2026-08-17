import { afterEach, describe, expect, it, vi } from "vitest";

const hang = { release: () => {} };

vi.mock("./refresh", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./refresh")>();
  return {
    ...orig,
    ensureQuotes: () =>
      new Promise<void>((resolve) => {
        hang.release = resolve;
      }),
  };
});

import { emptyTapeViews, loadMarksForLots, refreshAndLoadTape } from "./service";

describe("first paint does not wait on live quotes", () => {
  afterEach(() => {
    hang.release();
  });

  it("refreshAndLoadTape background mode returns cache without waiting", async () => {
    const tape = await Promise.race([
      refreshAndLoadTape([], { refresh: "background" }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("waited on live quotes")), 250);
      }),
    ]);
    expect(tape.items).toHaveLength(emptyTapeViews().items.length);
    expect(tape.items.every((item) => item.last === null || typeof item.last === "string")).toBe(true);
  });

  it("loadMarksForLots background mode returns last-good or — without waiting", async () => {
    const result = await Promise.race([
      loadMarksForLots(["NVDA"], { refresh: "background" }),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("waited on live quotes")), 250);
      }),
    ]);
    expect(result.marks.NVDA === null || typeof result.marks.NVDA === "string").toBe(true);
    expect(result.views.NVDA.last === null || typeof result.views.NVDA.last === "string").toBe(true);
  });
});
