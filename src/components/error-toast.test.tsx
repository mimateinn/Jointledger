/** @vitest-environment jsdom */

import React from "react";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ERROR_TOAST_MS, ErrorToast } from "./error-toast";

afterEach(() => {
  cleanup();
  document.getElementById("toast-host")?.remove();
  vi.useRealTimers();
});

describe("error toast", () => {
  it("closes from the close button", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<ErrorToast message="刪除失敗" onDismiss={onDismiss} />);
    await user.click(await screen.findByRole("button", { name: "關閉" }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("auto-dismisses after ERROR_TOAST_MS", async () => {
    vi.useFakeTimers();
    const onDismiss = vi.fn();
    render(<ErrorToast message="刪除失敗" onDismiss={onDismiss} />);
    expect(screen.getByRole("alert").textContent).toContain("刪除失敗");
    await vi.advanceTimersByTimeAsync(ERROR_TOAST_MS);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
