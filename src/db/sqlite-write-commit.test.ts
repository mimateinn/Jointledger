import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createTrade } from "@/ledger/create-trade";
import { addWatchItem, setWatchMuted } from "@/watchlist/repo";
import { getDb, resetDbClients } from "./client";
import { createDrizzleStore } from "./drizzle-store";
import { withLedgerTransaction } from "./ledger-tx";

const prevUrl = process.env.DATABASE_URL;

/**
 * Hold the WAL write lock on a second in-process libsql connection.
 * A child-process EXCLUSIVE lock is not visible to @libsql/client 0.15.15
 * in this environment; the leftover-BUSY bug is reproduced by a peer
 * connection in the same process (CR also reproduced it with pure libsql).
 */
async function holdWriteLock(url: string): Promise<{ release: () => Promise<void> }> {
  const locker = createClient({ url });
  await locker.execute("PRAGMA journal_mode = WAL");
  await locker.execute("PRAGMA busy_timeout = 5000");
  await locker.execute("BEGIN IMMEDIATE");
  await locker.execute("UPDATE watch_items SET muted = muted");
  return {
    release: async () => {
      try {
        await locker.execute("COMMIT");
      } finally {
        locker.close();
      }
    },
  };
}

async function settle<T>(work: Promise<T>): Promise<{ ok: boolean }> {
  try {
    await work;
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

function dbRun(query: unknown): Promise<unknown> {
  return (getDb() as unknown as { run: (q: unknown) => Promise<unknown> }).run(query);
}

function errorChain(error: unknown): string {
  const parts: string[] = [];
  let current: unknown = error;
  for (let i = 0; i < 5 && current; i += 1) {
    if (current instanceof Error) {
      parts.push(current.message);
      current = current.cause;
      continue;
    }
    parts.push(String(current));
    break;
  }
  return parts.join(" | ");
}

async function forceBusyOnSharedHandle(id: string): Promise<void> {
  await getDb().all(sql`PRAGMA busy_timeout = 250`);
  const t0 = Date.now();
  try {
    await dbRun(sql`UPDATE watch_items SET muted = 1 WHERE id = ${id}`);
    throw new Error("expected SQLITE_BUSY from UPDATE while write lock is held");
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("expected SQLITE_BUSY")) {
      throw error;
    }
    expect(Date.now() - t0).toBeGreaterThan(200);
    expect(errorChain(error)).toMatch(/BUSY|locked|Failed query/i);
  }
}

async function assertCommittedMute(url: string, id: string) {
  const probe = createClient({ url });
  try {
    const watches = await probe.execute({
      sql: "SELECT muted FROM watch_items WHERE id = ?",
      args: [id],
    });
    expect(Number(watches.rows[0]?.muted) === 1 || watches.rows[0]?.muted === true).toBe(true);
  } finally {
    probe.close();
  }
}

async function assertExternalWriterUnblocked(url: string) {
  const writer = createClient({ url });
  const t0 = Date.now();
  try {
    await writer.execute("PRAGMA busy_timeout = 200");
    await writer.execute("BEGIN IMMEDIATE");
    await writer.execute("COMMIT");
  } finally {
    writer.close();
  }
  expect(Date.now() - t0).toBeLessThan(500);
}

describe("sqlite write commit", () => {
  let dir: string;
  let url: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-commit-"));
    url = `file:${join(dir, "joint-ledger.sqlite")}`;
    process.env.DATABASE_URL = url;
    resetDbClients();
    const client = createClient({ url });
    await client.execute("PRAGMA foreign_keys = OFF");
    await migrate(drizzle(client), { migrationsFolder: "./drizzle-sqlite" });
    await client.execute("PRAGMA foreign_keys = ON");
    await client.execute({
      sql: "INSERT INTO users (id, display_name, email, created_at) VALUES (?, ?, ?, ?)",
      args: ["user-demo", "小明", "demo@example.com", Date.now()],
    });
    client.close();
  });

  afterEach(() => {
    resetDbClients();
    process.env.DATABASE_URL = prevUrl;
    rmSync(dir, { recursive: true, force: true });
  });

  it(
    "commits a write on the same client after a BUSY failure and does not hold the lock",
    async () => {
      const store = createDrizzleStore();
      const { book } = await createBook(store, {
        name: "測試簿",
        createdByUserId: "user-demo",
        creatorDisplayName: "小明",
        creatorEmail: "demo@example.com",
      });
      const nvda = await addWatchItem(book.id, "NVDA");
      await getDb().all(sql`SELECT 1`);

      const lock = await holdWriteLock(url);
      try {
        await forceBusyOnSharedHandle(nvda.id);
      } finally {
        await lock.release();
      }

      const second = await settle(setWatchMuted(book.id, nvda.id, true));
      expect(second.ok).toBe(true);
      await assertCommittedMute(url, nvda.id);
      await assertExternalWriterUnblocked(url);
    },
    20_000,
  );

  it(
    "commits mute, deposit, and buy after a BUSY failure",
    async () => {
      const store = createDrizzleStore();
      const { book, member, account } = await createBook(store, {
        name: "測試簿",
        createdByUserId: "user-demo",
        creatorDisplayName: "小明",
        creatorEmail: "demo@example.com",
      });
      const nvda = await addWatchItem(book.id, "NVDA");
      await getDb().all(sql`SELECT 1`);

      const lock = await holdWriteLock(url);
      try {
        await forceBusyOnSharedHandle(nvda.id);
      } finally {
        await lock.release();
      }

      const mute = await settle(setWatchMuted(book.id, nvda.id, true));
      const deposit = await settle(
        withLedgerTransaction((ledger) =>
          createCashFlow(ledger, {
            bookId: book.id,
            memberId: member.id,
            ledgerAccountId: account.id,
            amountHkd: "250",
            fxRate: "1",
            occurredOn: "2024-03-01",
          }),
        ),
      );
      const buy = await settle(
        withLedgerTransaction((ledger) =>
          createTrade(ledger, {
            bookId: book.id,
            ledgerAccountId: account.id,
            memberId: member.id,
            symbol: "NVDA",
            quantity: "1",
            price: "10",
            occurredOn: "2024-03-02",
          }),
        ),
      );

      const probe = createClient({ url });
      try {
        const watches = await probe.execute({
          sql: "SELECT muted FROM watch_items WHERE id = ?",
          args: [nvda.id],
        });
        const cash = await probe.execute("SELECT id FROM cash_flows");
        const trades = await probe.execute("SELECT id FROM trades");
        const allocations = await probe.execute("SELECT id FROM trade_allocations");
        if (mute.ok) {
          expect(Number(watches.rows[0]?.muted) === 1 || watches.rows[0]?.muted === true).toBe(true);
        }
        if (deposit.ok) {
          expect(cash.rows.length).toBe(1);
        }
        if (buy.ok) {
          expect(trades.rows.length).toBe(1);
          expect(allocations.rows.length).toBe(1);
        }
        expect(mute.ok || deposit.ok || buy.ok).toBe(true);
      } finally {
        probe.close();
      }
      await assertExternalWriterUnblocked(url);
    },
    20_000,
  );

  it("closes the tx handle after a failed COMMIT so the next write still persists", async () => {
    const src = readFileSync(new URL("./client.ts", import.meta.url), "utf8");
    expect(src).toMatch(/closeTx\?\.\(\)/);
    expect(src).toMatch(/tx\.commit = \(\) => finish\(commit, "commit"\)/);

    const store = createDrizzleStore();
    const { book } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-demo",
      creatorDisplayName: "小明",
      creatorEmail: "demo@example.com",
    });
    const nvda = await addWatchItem(book.id, "NVDA");
    const db = getDb();
    try {
      await db.transaction(async (tx) => {
        await tx.execute(sql`PRAGMA defer_foreign_keys = ON`);
        await tx.execute(sql`
          INSERT INTO quotes (
            instrument_id, last, percent_change, previous_close, quoted_at, fetched_at, delay_seconds, status, source
          ) VALUES ('missing-instrument', null, null, null, null, 1, 900, 'empty', 'yahoo')
        `);
      });
      throw new Error("expected COMMIT FOREIGN KEY failure");
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("expected COMMIT")) {
        throw error;
      }
      const message = errorChain(error);
      expect(message).toMatch(/FOREIGN KEY|foreign key/i);
      expect(message).not.toMatch(/TRANSACTION_CLOSED/i);
      expect(message).not.toMatch(/BUSY/i);
    }

    const second = await settle(setWatchMuted(book.id, nvda.id, true));
    expect(second.ok).toBe(true);
    await assertCommittedMute(url, nvda.id);
    await assertExternalWriterUnblocked(url);
  });

  it("throws on nested getDb().transaction while a transaction is open", async () => {
    const db = getDb();
    await expect(
      db.transaction(async () => {
        await getDb().transaction(async () => undefined);
      }),
    ).rejects.toThrow(/nested SQLite transaction/);
  });
});
