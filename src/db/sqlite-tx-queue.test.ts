import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { eq, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  getDb,
  getSqliteClient,
  resetDbClients,
  setSqliteTxMaxMs,
  SQLITE_TX_EXECUTE_ERROR,
  SQLITE_TX_TIMEOUT_ERROR,
} from "./client";
import { users } from "./tables";

const prevUrl = process.env.DATABASE_URL;

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

describe("sqlite transaction queue", () => {
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-txq-"));
    process.env.DATABASE_URL = `file:${join(dir, "joint-ledger.sqlite")}`;
    resetDbClients();
    const client = createClient({ url: process.env.DATABASE_URL });
    await client.execute("PRAGMA foreign_keys = OFF");
    await migrate(drizzle(client), { migrationsFolder: "./drizzle-sqlite" });
    await client.execute("PRAGMA foreign_keys = ON");
    client.close();
  });

  afterEach(() => {
    resetDbClients();
    process.env.DATABASE_URL = prevUrl;
    rmSync(dir, { recursive: true, force: true });
  });

  it("commits three parallel transactions instead of rejecting them as nested", async () => {
    const db = getDb();
    const results = await Promise.all(
      [1, 2, 3].map((n) =>
        db.transaction(async (tx) => {
          await tx.execute(sql`SELECT ${n}`);
          return n;
        }),
      ),
    );
    expect(results.sort()).toEqual([1, 2, 3]);
  });

  it(
    "queues a plain execute until the open transaction commits without BUSY",
    async () => {
      const db = getDb();
      let release!: () => void;
      const hold = new Promise<void>((resolve) => {
        release = resolve;
      });
      const txP = db.transaction(async (tx) => {
        await tx.execute(sql`SELECT 1`);
        await hold;
      });
      const t0 = Date.now();
      const execP = (db as unknown as { run: (q: unknown) => Promise<unknown> }).run(
        sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-probe', 'probe', null, 1)`,
      );
      await new Promise((resolve) => setTimeout(resolve, 40));
      release();
      await expect(execP).resolves.toBeTruthy();
      await txP;
      expect(Date.now() - t0).toBeLessThan(1000);
    },
    15_000,
  );

  it("queues two overlapping transactions, one with an await inside, and both succeed", async () => {
    const db = getDb();
    let firstInside = false;
    let releaseInner!: () => void;
    const inner = new Promise<void>((resolve) => {
      releaseInner = resolve;
    });
    const first = db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-await-1', 'await-1', null, 1)`,
      );
      firstInside = true;
      await inner;
      return "first";
    });
    const started = Date.now();
    while (!firstInside && Date.now() - started < 2000) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    expect(firstInside).toBe(true);
    const second = db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-await-2', 'await-2', null, 1)`,
      );
      return "second";
    });
    await new Promise((resolve) => setTimeout(resolve, 20));
    releaseInner();
    await expect(Promise.all([first, second])).resolves.toEqual(["first", "second"]);
  });

  it("does not map UNIQUE/FK/CHECK inside a transaction to BUSY and keeps the COMMIT error", async () => {
    const db = getDb();
    await db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-unique', 'unique-user', null, 1)`,
      );
    });
    try {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-unique-2', 'unique-user', null, 1)`,
        );
      });
      throw new Error("expected UNIQUE failure");
    } catch (error) {
      const message = errorChain(error);
      expect(message).toMatch(/UNIQUE|unique/i);
      expect(message).not.toMatch(/BUSY|TRANSACTION_CLOSED/i);
    }

    await expect(
      db.transaction(async (tx) => {
        await tx.execute(sql`PRAGMA defer_foreign_keys = ON`);
        await tx.execute(sql`
          INSERT INTO quotes (
            instrument_id, last, percent_change, previous_close, quoted_at, fetched_at, delay_seconds, status, source
          ) VALUES ('missing-instrument', null, null, null, null, 1, 900, 'empty', 'yahoo')
        `);
      }),
    ).rejects.toSatisfy((error) => /FOREIGN KEY|foreign key/i.test(errorChain(error)));

    await db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-after-check', 'after-check', null, 1)`,
      );
    });
  });

  it("throws a clear error on true re-entrant nesting and still queues a sibling", async () => {
    const db = getDb();
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const nested = db.transaction(async () => {
      await expect(getDb().transaction(async () => undefined)).rejects.toThrow(
        /nested SQLite transaction is not supported/,
      );
      await hold;
    });
    const sibling = db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1`);
      return "ok";
    });
    release();
    await nested;
    await expect(sibling).resolves.toBe("ok");
  });

  it("throws instead of deadlocking when getDb() execute runs inside a tx callback", async () => {
    const db = getDb();
    const t0 = Date.now();
    await expect(
      db.transaction(async () => {
        await getDb().execute(sql`SELECT 1`);
      }),
    ).rejects.toThrow(SQLITE_TX_EXECUTE_ERROR);
    expect(Date.now() - t0).toBeLessThan(1000);
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1`);
    });
  });

  it("throws within 1s for select builder, update builder, and raw client.execute inside a tx", async () => {
    const db = getDb();
    const client = getSqliteClient();
    for (const run of [
      async () => getDb().select().from(users),
      async () => getDb().update(users).set({ displayName: "probe" }).where(eq(users.id, "missing")),
      async () => client.execute("SELECT 1"),
    ]) {
      const t0 = Date.now();
      await expect(db.transaction(async () => run())).rejects.toSatisfy((error) =>
        errorChain(error).includes(SQLITE_TX_EXECUTE_ERROR),
      );
      expect(Date.now() - t0).toBeLessThan(1000);
    }
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1`);
    });
  });

  it("rolls back a hanging callback at the timeout and lets the next tx succeed", async () => {
    setSqliteTxMaxMs(200);
    const db = getDb();
    const hung = db.transaction(async (tx) => {
      await tx.execute(
        sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-hang', 'hang', null, 1)`,
      );
      await new Promise(() => {});
    });
    await expect(hung).rejects.toThrow(SQLITE_TX_TIMEOUT_ERROR);
    const leftover = await db.all(sql`SELECT id FROM users WHERE id = 'u-hang'`);
    expect(Array.isArray(leftover) ? leftover : []).toHaveLength(0);
    await expect(
      db.transaction(async (tx) => {
        await tx.execute(
          sql`INSERT INTO users (id, display_name, email, created_at) VALUES ('u-after-hang', 'after', null, 1)`,
        );
        return "ok";
      }),
    ).resolves.toBe("ok");
  });

  it("does not treat a timer-scheduled tx after the outer tx ends as nested", async () => {
    const db = getDb();
    let later!: Promise<string>;
    await db.transaction(async (tx) => {
      await tx.execute(sql`SELECT 1`);
      later = new Promise((resolve, reject) => {
        setTimeout(() => {
          getDb()
            .transaction(async (inner) => {
              await inner.execute(sql`SELECT 1`);
              return "later";
            })
            .then(resolve, reject);
        }, 20);
      });
    });
    await expect(later).resolves.toBe("later");
  });
});
