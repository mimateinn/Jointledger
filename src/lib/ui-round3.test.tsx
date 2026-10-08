/** @vitest-environment jsdom */

import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistPanel, type WatchRow } from "@/components/watchlist-panel";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/actions/watchlist", () => ({
  addWatchAction: vi.fn(async () => ({})),
  removeWatchAction: vi.fn(async () => ({})),
  muteWatchAction: vi.fn(async () => ({})),
  searchWatchAction: vi.fn(async () => []),
}));

function src(path: string): string {
  return readFileSync(path, "utf8");
}

describe("round 3 mobile and display fixes", () => {
  it("keeps date fields as YYYY-MM-DD text, not native locale pickers", () => {
    const date = src("src/components/date-input.tsx");
    expect(date).toContain('type="text"');
    expect(date).toContain("YYYY-MM-DD");
    expect(date).toContain("ISO_DATE_INPUT");
    expect(src("src/app/(app)/entry/entry-form.tsx")).not.toContain('type="date"');
    expect(src("src/app/(app)/ledger/ledger-client.tsx")).not.toContain('type="date"');
    expect(src("src/app/(app)/returns/returns-client.tsx")).not.toContain('type="date"');
  });

  it("exposes 股息 as its own entry tab", () => {
    const form = src("src/app/(app)/entry/entry-form.tsx");
    expect(form).toContain('"股息"');
    expect(form).toContain('setBookKind("dividend")');
  });

  it("listens for OS theme changes in the root layout boot script", () => {
    const layout = src("src/app/layout.tsx");
    expect(layout).toContain('matchMedia("(prefers-color-scheme: dark)")');
    expect(layout).toContain('addEventListener("change"');
    expect(layout).toContain("data-theme-pref");
    expect(src("src/components/theme-toggle.tsx")).not.toContain("addEventListener");
  });

  it("restores the mobile holdings kline and uses the selected-surface token", () => {
    const css = src("src/app/components.css");
    const globals = src("src/app/globals.css");
    expect(css).toContain(".holdings-kline { display: block; }");
    expect(globals).toContain("var(--surface-selected)");
    expect(globals).not.toMatch(/tr\.selected \{\s*background: var\(--bg\);/);
  });
});

const rows: WatchRow[] = [
  {
    id: "w1",
    displayCode: "AAPL",
    muted: false,
    market: "US",
    marketLabel: "美",
    lastDisplay: "100",
    percentChange: "+1.00%",
    name: "Apple",
  },
];

describe("round 3 layout behaviour", () => {
  beforeEach(() => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({ items: {} }),
      })),
    );
    vi.stubGlobal(
      "matchMedia",
      vi.fn((query: string) => ({
        matches: String(query).includes("800"),
        media: query,
        addEventListener: () => {},
        removeEventListener: () => {},
        addListener: () => {},
        removeListener: () => {},
        dispatchEvent: () => false,
      })),
    );
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("keeps extra main padding-bottom and leaves the hidden watch layout non-interactive", async () => {
    const globals = src("src/app/globals.css");
    const match = globals.match(
      /@media \(max-width: 800px\) \{\s*main\.main \{\s*padding-bottom:\s*([^;]+);/,
    );
    expect(match?.[1]).toMatch(/var\(--bottom-bar-h\).*8rem/);
    const decl = (match?.[1] ?? "").replace(/env\([^)]+\)/g, "0px");
    expect(decl).toContain("8rem");

    document.documentElement.style.fontSize = "16px";
    const resolved = decl
      .replace(/var\(--bottom-bar-h\)/g, "56px")
      .replace(/var\(--sp-6\)/g, "24px")
      .replace(/([0-9.]+)rem/g, (_, n) => `${Number(n) * 16}px`);
    const style = document.createElement("style");
    style.textContent = `main.main { padding-bottom: ${resolved}; }`;
    document.head.appendChild(style);
    const main = document.createElement("main");
    main.className = "main";
    document.body.appendChild(main);
    let paddingBottom = getComputedStyle(main).paddingBottom;
    if (!Number.isFinite(parseFloat(paddingBottom))) {
      const sum = resolved
        .replace(/^calc\(/, "")
        .replace(/\)$/, "")
        .split("+")
        .map((part) => parseFloat(part.trim()))
        .reduce((a, b) => a + b, 0);
      main.style.paddingBottom = `${sum}px`;
      paddingBottom = getComputedStyle(main).paddingBottom;
    }
    const px = parseFloat(paddingBottom);
    expect(Number.isFinite(px), `computed padding-bottom was ${paddingBottom}`).toBe(true);
    expect(px).toBeGreaterThan(56 + 24 + 80);
    style.remove();
    main.remove();

    const { container } = render(<WatchlistPanel items={rows} />);
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: "靜音新聞" })).toHaveLength(1);
    });
    const table = container.querySelector(".watch-table");
    const list = container.querySelector(".watch-list");
    expect(table).toBeTruthy();
    expect(list).toBeTruthy();
    expect(table?.querySelectorAll("button")).toHaveLength(0);
    expect(table?.querySelector(".watch-actions-slot")?.getAttribute("aria-hidden")).toBe("true");
  });
});
