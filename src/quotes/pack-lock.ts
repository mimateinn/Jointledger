import { sql, type SQLWrapper } from "drizzle-orm";
import { getDb, type Database } from "@/db/client";
import type { QuoteExecutor } from "./store";

export const PACK_LOCK = 2_026_081_602;

export type PackLockTx = QuoteExecutor & {
  execute: (query: SQLWrapper | string) => Promise<unknown>;
};

export type PackLockDb = {
  transaction<T>(fn: (tx: PackLockTx) => Promise<T>): Promise<T>;
};

function asPackLockDb(db: Database): PackLockDb {
  return {
    transaction: (fn) => db.transaction((tx) => fn(tx as unknown as PackLockTx)),
  };
}

export type PackLockOptions = {
  waitMs?: number;
  retryMs?: number;
};

const DEFAULT_WAIT_MS = 5_000;
const DEFAULT_RETRY_MS = 50;

function asRows(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) {
    return result as Record<string, unknown>[];
  }
  if (result && typeof result === "object" && "rows" in result) {
    const rows = (result as { rows: unknown }).rows;
    if (Array.isArray(rows)) {
      return rows as Record<string, unknown>[];
    }
  }
  return [];
}

function isTruthyFlag(value: unknown): boolean {
  return value === true || value === "t" || value === "true";
}

export async function tryAdvisoryXactLock(tx: PackLockTx): Promise<boolean> {
  const result = await tx.execute(sql`select pg_try_advisory_xact_lock(${PACK_LOCK}) as locked`);
  return isTruthyFlag(asRows(result)[0]?.locked);
}

/**
 * Quote pack mutex: one Drizzle transaction + session-safe xact lock.
 * COMMIT / ROLLBACK on that same connection releases the lock (no-key, 401, throw, early return).
 * Request path uses try-lock + timeout — never a blocking pg_advisory_lock.
 */
export async function withPackLock<T>(
  fn: (tx: PackLockTx) => Promise<T>,
  db: PackLockDb = asPackLockDb(getDb()),
  options: PackLockOptions = {},
): Promise<T> {
  const waitMs = options.waitMs ?? DEFAULT_WAIT_MS;
  const retryMs = options.retryMs ?? DEFAULT_RETRY_MS;
  const deadline = Date.now() + waitMs;

  while (true) {
    const attempt = await db.transaction(async (tx) => {
      const locked = await tryAdvisoryXactLock(tx);
      if (!locked) {
        return { ok: false as const };
      }
      const value = await fn(tx);
      return { ok: true as const, value };
    });
    if (attempt.ok) {
      return attempt.value;
    }
    if (Date.now() >= deadline) {
      throw new Error("quote pack lock timeout");
    }
    await new Promise((resolve) => setTimeout(resolve, retryMs));
  }
}
