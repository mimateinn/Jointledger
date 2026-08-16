import { describe, expect, it } from "vitest";
import { withPackLock, type PackLockDb, type PackLockTx } from "./pack-lock";

function createFakePackDb(options?: { externallyHeld?: boolean }): PackLockDb & {
  events: string[];
  isHeld(): boolean;
} {
  let xactHeld = false;
  const events: string[] = [];
  return {
    events,
    isHeld: () => xactHeld,
    async transaction<T>(fn: (tx: PackLockTx) => Promise<T>): Promise<T> {
      events.push("begin");
      let lockedThisTx = false;
      const tx = {
        execute: async () => {
          if (options?.externallyHeld || xactHeld) {
            events.push("try-miss");
            return [{ locked: false }];
          }
          xactHeld = true;
          lockedThisTx = true;
          events.push("try-hit");
          return [{ locked: true }];
        },
      } as unknown as PackLockTx;
      try {
        const value = await fn(tx);
        events.push("commit");
        if (lockedThisTx) {
          xactHeld = false;
          events.push("xact-release");
        }
        return value;
      } catch (error) {
        events.push("rollback");
        if (lockedThisTx) {
          xactHeld = false;
          events.push("xact-release");
        }
        throw error;
      }
    },
  };
}

describe("withPackLock", () => {
  it("releases the xact lock after a no-key short-circuit so a second call proceeds", async () => {
    const db = createFakePackDb();
    const ran: string[] = [];
    await withPackLock(async () => {
      ran.push("first");
    }, db);
    await Promise.race([
      withPackLock(async () => {
        ran.push("second");
      }, db),
      new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error("deadlock: second withPackLock hung")), 200);
      }),
    ]);
    expect(ran).toEqual(["first", "second"]);
    expect(db.isHeld()).toBe(false);
    expect(db.events.filter((e) => e === "xact-release")).toHaveLength(2);
    expect(db.events.filter((e) => e === "commit")).toHaveLength(2);
  });

  it("releases the xact lock on throw so the next request is not stuck", async () => {
    const db = createFakePackDb();
    await expect(
      withPackLock(async () => {
        throw new Error("no-key write failed");
      }, db),
    ).rejects.toThrow("no-key write failed");
    let second = false;
    await withPackLock(async () => {
      second = true;
    }, db);
    expect(second).toBe(true);
    expect(db.isHeld()).toBe(false);
    expect(db.events).toContain("rollback");
    expect(db.events.filter((e) => e === "xact-release")).toHaveLength(2);
  });

  it("times out on try-lock instead of hanging on a blocking advisory lock", async () => {
    const db = createFakePackDb({ externallyHeld: true });
    await expect(withPackLock(async () => undefined, db, { waitMs: 80, retryMs: 20 })).rejects.toThrow(
      "quote pack lock timeout",
    );
    expect(db.events.every((e) => e !== "try-hit")).toBe(true);
    expect(db.isHeld()).toBe(false);
  });
});
