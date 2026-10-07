import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { sql } from "drizzle-orm";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, reconnectSqliteClient, resetDbClients, SQLITE_BUSY_TIMEOUT_MS } from "./client";

const prevUrl = process.env.DATABASE_URL;

function timeoutFromRows(rows: unknown): number {
  const row = Array.isArray(rows) ? (rows[0] as Record<string, unknown> | undefined) : undefined;
  if (!row) {
    return Number.NaN;
  }
  const value = row.timeout ?? row.busy_timeout ?? Object.values(row)[0];
  return Number(value);
}

describe("sqlite busy_timeout", () => {
  let dir: string;

  afterEach(() => {
    resetDbClients();
    process.env.DATABASE_URL = prevUrl;
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("keeps PRAGMA busy_timeout at 5000 on queries after transaction()", async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-busy-"));
    process.env.DATABASE_URL = `file:${join(dir, "joint-ledger.sqlite")}`;
    resetDbClients();
    const db = getDb();

    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1`);
    });

    const rows = await db.all(sql`PRAGMA busy_timeout`);
    expect(timeoutFromRows(rows)).toBe(SQLITE_BUSY_TIMEOUT_MS);
  });

  it("keeps PRAGMA busy_timeout at 5000 on queries after reconnect()", async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-busy-re-"));
    process.env.DATABASE_URL = `file:${join(dir, "joint-ledger.sqlite")}`;
    resetDbClients();
    const db = getDb();
    await db.all(sql`SELECT 1`);
    await reconnectSqliteClient();
    const rows = await db.all(sql`PRAGMA busy_timeout`);
    expect(timeoutFromRows(rows)).toBe(SQLITE_BUSY_TIMEOUT_MS);
  });
});
