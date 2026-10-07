import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbClients } from "@/db/client";

const prevUrl = process.env.DATABASE_URL;
let fetchStarted!: () => void;
const started = { current: Promise.resolve() };

vi.mock("./public-source", async (importOriginal) => {
  const orig = await importOriginal<typeof import("./public-source")>();
  return {
    ...orig,
    quotesVia: () => "public" as const,
    fetchPublicQuotes: async () => {
      fetchStarted();
      await new Promise((resolve) => setTimeout(resolve, 3000));
      return new Map();
    },
  };
});

import { getDb } from "@/db/client";
import { ensureQuotes } from "./refresh";

describe("quote refresh does not hold the DB during fetch", () => {
  let dir: string;

  beforeEach(async () => {
    started.current = new Promise<void>((resolve) => {
      fetchStarted = resolve;
    });
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-refresh-"));
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

  it("lets an unrelated read finish while a 3s quote fetch is in flight", async () => {
    const refresh = ensureQuotes(["NVDA"], new Date(), { forceDisplays: ["NVDA"] });
    await started.current;
    const db = getDb();
    const t0 = Date.now();
    await db.all(sql`SELECT 1`);
    expect(Date.now() - t0).toBeLessThan(500);
    await refresh;
  });
});
