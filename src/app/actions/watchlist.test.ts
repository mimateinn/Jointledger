import { beforeEach, describe, expect, it, vi } from "vitest";

const setWatchMuted = vi.fn();
const getCurrentMembership = vi.fn();
const requireUser = vi.fn();

vi.mock("@/auth/session", () => ({
  requireUser: () => requireUser(),
}));
vi.mock("@/lib/current-book", () => ({
  getCurrentMembership: () => getCurrentMembership(),
}));
vi.mock("@/watchlist/repo", () => ({
  setWatchMuted: (...args: unknown[]) => setWatchMuted(...args),
  addWatchItem: vi.fn(),
  listWatchItems: vi.fn(),
  removeWatchItem: vi.fn(),
}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { muteWatchAction } from "./watchlist";

describe("muteWatchAction", () => {
  beforeEach(() => {
    requireUser.mockResolvedValue({ id: "user-1" });
    getCurrentMembership.mockResolvedValue({ book: { id: "book-1" } });
    setWatchMuted.mockReset();
  });

  it("returns 更新失敗 when the repo write throws", async () => {
    setWatchMuted.mockRejectedValue(new Error("SQLITE_BUSY: database is locked"));
    const fd = new FormData();
    fd.set("id", "w1");
    fd.set("muted", "1");
    await expect(muteWatchAction({}, fd)).resolves.toEqual({ error: "更新失敗" });
  });
});
