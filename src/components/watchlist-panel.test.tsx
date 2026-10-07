/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchlistPanel, type WatchRow } from "./watchlist-panel";

const hang = () => new Promise<never>(() => {});

vi.mock("@/app/actions/watchlist", () => ({
  addWatchAction: vi.fn(async () => ({})),
  removeWatchAction: vi.fn(async () => ({})),
  muteWatchAction: vi.fn(async () => hang()),
  searchWatchAction: vi.fn(async () => []),
}));

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
  {
    id: "w2",
    displayCode: "NVDA",
    muted: false,
    market: "US",
    marketLabel: "美",
    lastDisplay: "200",
    percentChange: "-1.00%",
    name: "NVIDIA",
  },
];

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

describe("watchlist mute pending", () => {
  it("does not share mute pending across rows or duplicate hidden forms", async () => {
    const user = userEvent.setup();
    render(<WatchlistPanel items={rows} />);

    const buttons = await screen.findAllByRole("button", { name: "靜音新聞" });
    expect(buttons).toHaveLength(2);

    await user.click(buttons[0]!);
    await waitFor(() => {
      expect(buttons[0]!.disabled).toBe(true);
    });
    expect(buttons[1]!.disabled).toBe(false);
    expect(buttons[1]!.textContent).toContain("靜音新聞");
  });
});
