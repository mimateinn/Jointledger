/** @vitest-environment jsdom */

import React from "react";
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

async function confirmDelete(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: `刪除 ${label}` }));
  await user.click(screen.getByRole("button", { name: "確認刪除" }));
}

describe("ledger entry delete undo and reject", () => {
  it("restore dismisses the undo toast and does not call deleteAction", async () => {
    const user = userEvent.setup();
    const deleteAction = vi.fn(async () => ({}));
    render(
      <LedgerEntryDelete
        id="t1"
        kind="trade"
        label="買入 AAPL"
        checkDelete={async () => ({ ok: "可以刪" })}
        deleteAction={deleteAction}
        undoMs={60_000}
      />,
    );

    await confirmDelete(user, "買入 AAPL");
    expect(await screen.findByText("已刪除・還原")).toBeTruthy();
    expect(screen.getByText("買入 AAPL")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "還原 買入 AAPL" }));
    await waitFor(() => {
      expect(screen.queryByText("已刪除・還原")).toBeNull();
    });
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("shows a FIFO reject error immediately, without an undo toast", async () => {
    const user = userEvent.setup();
    const deleteAction = vi.fn(async () => ({ ok: "should not run" }));
    render(
      <LedgerEntryDelete
        id="t1"
        kind="trade"
        label="買入 AAPL"
        checkDelete={async () => ({ error: DELETE_BLOCKED_BY_LATER })}
        deleteAction={deleteAction}
        undoMs={60_000}
      />,
    );

    await confirmDelete(user, "買入 AAPL");
    expect(screen.queryByText("已刪除・還原")).toBeNull();
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain(DELETE_BLOCKED_BY_LATER);
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
    expect(deleteAction).not.toHaveBeenCalled();
  });

  it("shows an error toast when the precheck throws", async () => {
    const user = userEvent.setup();
    const deleteAction = vi.fn(async () => ({}));
    render(
      <LedgerEntryDelete
        id="t1"
        kind="trade"
        label="買入 AAPL"
        checkDelete={async () => {
          throw new Error("Failed to fetch");
        }}
        deleteAction={deleteAction}
        undoMs={60_000}
      />,
    );

    await confirmDelete(user, "買入 AAPL");
    expect(screen.queryByText("已刪除・還原")).toBeNull();
    expect((await screen.findByRole("alert")).textContent).toContain("刪除失敗");
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
    expect(deleteAction).not.toHaveBeenCalled();
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

    await confirmDelete(user, "買入 AAPL");
    expect(await screen.findByText("已刪除・還原")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("已刪除・還原")).toBeNull();
      expect(screen.getByRole("alert").textContent).toContain(DELETE_BLOCKED_BY_LATER);
    });
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
  });

  it("keeps each pending delete on its own timer; undo A does not commit or cancel B", async () => {
    const user = userEvent.setup();
    const deleteA = vi.fn(async () => ({}));
    const deleteB = vi.fn(async () => ({}));
    render(
      <table>
        <tbody>
          <tr>
            <td>
              <LedgerEntryDelete
                id="a"
                kind="trade"
                label="列 A"
                checkDelete={async () => ({ ok: "可以刪" })}
                deleteAction={deleteA}
                undoMs={1000}
              />
            </td>
          </tr>
          <tr>
            <td>
              <LedgerEntryDelete
                id="b"
                kind="trade"
                label="列 B"
                checkDelete={async () => ({ ok: "可以刪" })}
                deleteAction={deleteB}
                undoMs={3000}
              />
            </td>
          </tr>
        </tbody>
      </table>,
    );

    await confirmDelete(user, "列 A");
    expect(await screen.findByText("列 A")).toBeTruthy();
    await confirmDelete(user, "列 B");
    expect(await screen.findAllByText("已刪除・還原")).toHaveLength(2);
    expect(deleteA).not.toHaveBeenCalled();
    expect(deleteB).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "還原 列 A" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "還原 列 A" })).toBeNull();
    });
    expect(screen.getByRole("button", { name: "刪除 列 A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "還原 列 B" })).toBeTruthy();
    expect(deleteA).not.toHaveBeenCalled();
    expect(deleteB).not.toHaveBeenCalled();

    await waitFor(() => {
      expect(deleteB).toHaveBeenCalledTimes(1);
    }, { timeout: 4000 });
    expect(deleteA).not.toHaveBeenCalled();
  });

  it("shows 刪除失敗 when the delete throws after the countdown", async () => {
    const user = userEvent.setup();
    const deleteAction = vi.fn(async () => {
      throw new Error("Failed to fetch");
    });
    render(
      <LedgerEntryDelete
        id="t1"
        kind="trade"
        label="買入 AAPL"
        checkDelete={async () => ({ ok: "可以刪" })}
        deleteAction={deleteAction}
        undoMs={20}
      />,
    );

    await confirmDelete(user, "買入 AAPL");
    expect(await screen.findByText("已刪除・還原")).toBeTruthy();
    await waitFor(() => {
      expect(screen.queryByText("已刪除・還原")).toBeNull();
      expect(screen.getByRole("alert").textContent).toContain("刪除失敗");
    });
    expect(deleteAction).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "刪除 買入 AAPL" })).toBeTruthy();
  });
});
