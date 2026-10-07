/** @vitest-environment jsdom */

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DELETE_BLOCKED_BY_LATER } from "@/ledger";
import { LedgerEntryDelete } from "./ledger-entry-delete";

vi.mock("@/app/actions/entry", () => ({
  deleteLedgerEntryAction: vi.fn(async () => ({})),
  checkDeleteLedgerEntryAction: vi.fn(async () => ({})),
}));

afterEach(() => {
  cleanup();
  document.getElementById("toast-host")?.remove();
});

async function openConfirm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "刪除 買入 AAPL" }));
  await user.click(screen.getByRole("button", { name: "確認刪除" }));
}

describe("ledger entry delete undo and reject", () => {
  it("restore dismisses the undo toast and returns the row delete control", async () => {
    const user = userEvent.setup();
    render(
      <LedgerEntryDelete
        id="t1"
        kind="trade"
        label="買入 AAPL"
        checkDelete={async () => ({ ok: "可以刪" })}
        deleteAction={async () => ({})}
        undoMs={60_000}
      />,
    );

    await openConfirm(user);
    expect(screen.getByText("已刪除・還原")).toBeTruthy();
    expect(screen.getByText("買入 AAPL")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "還原" }));
    expect(screen.queryByText("已刪除・還原")).toBeNull();
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
  });

  it("shows a FIFO reject error immediately, without an undo toast", async () => {
    const user = userEvent.setup();
    render(
      <LedgerEntryDelete
        id="t1"
        kind="trade"
        label="買入 AAPL"
        checkDelete={async () => ({ error: DELETE_BLOCKED_BY_LATER })}
        deleteAction={async () => ({ ok: "should not run" })}
        undoMs={60_000}
      />,
    );

    await openConfirm(user);
    expect(screen.queryByText("已刪除・還原")).toBeNull();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(DELETE_BLOCKED_BY_LATER);
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
  });

  it("dismisses the undo toast and shows an error toast when the later delete is rejected", async () => {
    const user = userEvent.setup();
    render(
      <LedgerEntryDelete
        id="t1"
        kind="trade"
        label="買入 AAPL"
        checkDelete={async () => ({ ok: "可以刪" })}
        deleteAction={async () => ({ error: DELETE_BLOCKED_BY_LATER })}
        undoMs={20}
      />,
    );

    await openConfirm(user);
    expect(screen.getByText("已刪除・還原")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("已刪除・還原")).toBeNull();
      expect(screen.getByRole("alert").textContent).toContain(DELETE_BLOCKED_BY_LATER);
    });
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
  });
});
