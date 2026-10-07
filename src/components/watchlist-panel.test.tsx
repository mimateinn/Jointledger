/** @vitest-environment jsdom */

import React from "react";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WatchActions, WatchlistPanel, type WatchRow } from "./watchlist-panel";

const hang = () => new Promise<never>(() => {});

vi.mock("@/app/actions/watchlist", () => ({
  addWatchAction: vi.fn(async () => ({})),
  removeWatchAction: vi.fn(async () => ({})),
  muteWatchAction: vi.fn(async () => hang()),
  searchWatchAction: vi.fn(async () => []),
}));

vi.mock("react", async () => {
  const actual = await vi.importActual<typeof import("react")>("react");
  function useTransitionMock(): [boolean, (cb: () => void) => void] {
    const [isPending, setPending] = actual.useState(false);
    const start = (cb: () => void) => {
      setPending(true);
      const result = cb() as unknown;
      if (result && typeof (result as { then?: unknown }).then === "function") {
        void Promise.resolve(result);
      }
    };
    return [isPending, start];
  }
  return { ...actual, useTransition: useTransitionMock };
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
  document.getElementById("toast-host")?.remove();
  vi.unstubAllGlobals();
});

describe("watchlist mute pending", () => {
  it("does not share mute pending across rows or duplicate hidden forms", async () => {
    const user = userEvent.setup();
    const { container } = render(<WatchlistPanel items={rows} />);

    const buttons = await screen.findAllByRole("button", { name: "靜音新聞" });
    expect(buttons).toHaveLength(2);
    expect(container.querySelector(".watch-list")).toBeTruthy();
    expect(container.querySelector(".watch-table")).toBeTruthy();

    await user.click(buttons[0]!);
    await waitFor(() => {
      expect(buttons[0]!.disabled).toBe(true);
    });
    expect(buttons[1]!.disabled).toBe(false);
    expect(buttons[1]!.textContent).toContain("靜音新聞");
  });

  it("re-enables each row and flips the label when the action resolves but refresh never does", async () => {
    const user = userEvent.setup();
    const muteAction = vi.fn(async () => ({}));
    render(
      <>
        <WatchActions row={rows[0]!} muteAction={muteAction} />
        <WatchActions row={rows[1]!} muteAction={muteAction} />
      </>,
    );

    for (let i = 0; i < 20; i += 1) {
      const rowIndex = i % 2;
      const clicksOnRow = Math.floor(i / 2);
      const buttons = screen.getAllByRole("button", { name: /靜音新聞|恢復新聞/ });
      const button = buttons[rowIndex]!;
      await user.click(button);
      await waitFor(
        () => {
          expect(button.disabled).toBe(false);
        },
        { timeout: 2000 },
      );
      const expected = clicksOnRow % 2 === 0 ? "恢復新聞" : "靜音新聞";
      expect(button.textContent).toContain(expected);
    }
    expect(muteAction).toHaveBeenCalledTimes(20);
  });

  it("reverts the optimistic mute label and shows an error toast when the action throws", async () => {
    const user = userEvent.setup();
    const muteAction = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    render(<WatchActions row={rows[0]!} muteAction={muteAction} />);

    const button = screen.getByRole("button", { name: "靜音新聞" });
    await user.click(button);
    expect(await screen.findByRole("alert")).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toContain("更新失敗");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("靜音新聞");
  });

  it("guards a same-tick double click with a synchronous in-flight ref", async () => {
    const muteAction = vi.fn(async () => ({}));
    render(<WatchActions row={rows[0]!} muteAction={muteAction} />);

    const button = screen.getByRole("button", { name: "靜音新聞" });
    act(() => {
      fireEvent.click(button);
      fireEvent.click(button);
    });
    await waitFor(() => {
      expect(muteAction).toHaveBeenCalledTimes(1);
    });
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
    expect(button.textContent).toContain("恢復新聞");
  });

  it("reverts the mute label and toasts 更新失敗 when the action returns a raw server error", async () => {
    const user = userEvent.setup();
    const muteAction = vi.fn(async () => ({
      error:
        "SQLITE_BUSY: UPDATE watch_items SET muted = 1 WHERE id = '550e8400-e29b-41d4-a716-446655440000'",
    }));
    render(<WatchActions row={rows[0]!} muteAction={muteAction} />);

    const button = screen.getByRole("button", { name: "靜音新聞" });
    await user.click(button);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("更新失敗");
    expect(alert.textContent).not.toContain("UPDATE watch_items");
    expect(alert.textContent).not.toContain("550e8400-e29b-41d4-a716-446655440000");
    expect(button.disabled).toBe(false);
    expect(button.textContent).toContain("靜音新聞");
  });

  it("re-enables the unwatch button in finally after the action throws", async () => {
    const user = userEvent.setup();
    const removeAction = vi.fn(async () => {
      throw new Error("aborted");
    });
    render(<WatchActions row={rows[0]!} removeAction={removeAction} />);

    const button = screen.getByRole("button", { name: "取消關注" });
    await user.click(button);
    await waitFor(() => {
      expect(button.disabled).toBe(false);
    });
    expect(removeAction).toHaveBeenCalledTimes(1);
  });
});
