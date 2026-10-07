import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbClients } from "./client";

const prevUrl = process.env.DATABASE_URL;

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
});
