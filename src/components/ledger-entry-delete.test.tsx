/** @vitest-environment jsdom */

import React from "react";
import { readFileSync } from "node:fs";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE_BLOCKED_BY_LATER } from "@/ledger";
import { LedgerEntryDelete } from "./ledger-entry-delete";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn(), prefetch: vi.fn(), push: vi.fn(), replace: vi.fn() }),
}));

vi.mock("@/app/actions/entry", () => ({
  deleteLedgerEntryAction: vi.fn(async () => ({})),
  checkDeleteLedgerEntryAction: vi.fn(async () => ({})),
}));

function injectToastCss() {
  document.getElementById("toast-css")?.remove();
  const style = document.createElement("style");
  style.id = "toast-css";
  style.textContent = `${readFileSync("src/app/tokens.css", "utf8")}\n${readFileSync("src/app/components.css", "utf8")}`;
  document.head.appendChild(style);
}

beforeEach(() => {
  injectToastCss();
});

afterEach(() => {
  cleanup();
  document.getElementById("toast-host")?.remove();
  document.getElementById("toast-css")?.remove();
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

  it("keeps every undo button visible and clickable across 3 deletes 1.2s apart", async () => {
    const user = userEvent.setup();
    const deleteA = vi.fn(async () => ({}));
    const deleteB = vi.fn(async () => ({}));
    const deleteC = vi.fn(async () => ({}));
    render(
      <table>
        <tbody>
          {[
            ["a", "列 A", deleteA],
            ["b", "列 B", deleteB],
            ["c", "列 C", deleteC],
          ].map(([id, label, deleteAction]) => (
            <tr key={id as string}>
              <td>
                <LedgerEntryDelete
                  id={id as string}
                  kind="trade"
                  label={label as string}
                  checkDelete={async () => ({ ok: "可以刪" })}
                  deleteAction={deleteAction as (prev: object, formData: FormData) => Promise<object>}
                  undoMs={8000}
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>,
    );

    await confirmDelete(user, "列 A");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await confirmDelete(user, "列 B");
    await new Promise((resolve) => setTimeout(resolve, 1200));
    await confirmDelete(user, "列 C");

    const undoNames = ["還原 列 A", "還原 列 B", "還原 列 C"];
    for (const name of undoNames) {
      const button = screen.getByRole("button", { name });
      expect(getComputedStyle(button).display).not.toBe("none");
      const toast = button.closest(".toast");
      expect(toast).toBeTruthy();
      expect(getComputedStyle(toast!).display).not.toBe("none");
    }

    await user.click(screen.getByRole("button", { name: "還原 列 A" }));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "還原 列 A" })).toBeNull();
    });
    expect(screen.getByRole("button", { name: "刪除 列 A" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "還原 列 B" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "還原 列 C" })).toBeTruthy();
    expect(deleteA).not.toHaveBeenCalled();
    expect(deleteB).not.toHaveBeenCalled();
    expect(deleteC).not.toHaveBeenCalled();
  }, 15_000);

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
