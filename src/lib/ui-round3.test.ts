import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function src(path: string): string {
  return readFileSync(path, "utf8");
}

describe("round 3 mobile and display fixes", () => {
  it("renders a mobile watchlist card list with 44px actions", () => {
    const watch = src("src/components/watchlist-panel.tsx");
    const css = src("src/app/components.css");
    expect(watch).toContain("watch-list");
    expect(watch).toContain("watch-card");
    expect(watch).toContain("取消關注");
    expect(watch).toContain("靜音新聞");
    expect(css).toContain(".watch-list");
    expect(css).toContain(".watch-actions .btn { min-height: var(--hit-min)");
    expect(css).toMatch(/@media \(max-width: 800px\)[\s\S]*\.watch-table \{ display: none;/);
  });

  it("shows a design-system undo toast with 已刪除・還原", () => {
    const toast = src("src/components/undo-toast.tsx");
    const entry = src("src/components/ledger-entry-delete.tsx");
    expect(toast).toContain("已刪除・還原");
    expect(toast).toContain('className="toast"');
    expect(toast).toContain("createPortal");
    expect(entry).toContain("UndoToast");
    expect(entry).toContain("還原");
  });

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
