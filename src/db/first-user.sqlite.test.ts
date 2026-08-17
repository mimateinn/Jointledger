import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getDb, resetDbClients } from "./client";
import { insertFirstUser } from "./first-user";

const prevUrl = process.env.DATABASE_URL;

describe("first user on empty sqlite", () => {
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-"));
    const url = `file:${join(dir, "joint-ledger.sqlite")}`;
    process.env.DATABASE_URL = url;
    resetDbClients();
    const client = createClient({ url });
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

  it("exposes db.transaction and can create 小明 on an empty book", async () => {
    const db = getDb();
    expect(typeof db.transaction).toBe("function");

    const first = await insertFirstUser({
      displayName: "小明",
      email: "demo@example.com",
      passwordHash: "hash-demo",
    });
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(first.user.displayName).toBe("小明");
    expect(first.user.email).toBe("demo@example.com");

    const second = await insertFirstUser({
      displayName: "另一人",
      email: "other@example.com",
      passwordHash: "hash-other",
    });
    expect(second.ok).toBe(false);
  });
});
