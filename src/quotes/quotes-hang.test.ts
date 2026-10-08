import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbClients } from "@/db/client";

vi.stubGlobal(
  "fetch",
  vi.fn(
    () =>
      new Promise<Response>((resolve) => {
        setTimeout(() => resolve(new Response(null, { status: 504 })), 60_000);
      }),
  ),
);

vi.mock("@/auth/session", () => ({
  getSessionUser: async () => ({ id: "user-demo", displayName: "小明", email: "demo@example.com" }),
}));

vi.mock("@/lib/book-view", () => ({
  listOpenLotSymbols: async () => ["NVDA"],
}));

import { GET } from "@/app/api/quotes/route";
import { loadInstrumentView } from "./service";

const prevUrl = process.env.DATABASE_URL;
const originalKey = process.env.TWELVE_DATA_API_KEY;

describe("quote routes return last-good without waiting on a hung fetch", () => {
  let dir: string;

  beforeEach(async () => {
    delete process.env.TWELVE_DATA_API_KEY;
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-qhang-"));
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
    process.env.TWELVE_DATA_API_KEY = originalKey;
    rmSync(dir, { recursive: true, force: true });
  });

  it("resolves /api/quotes and loadInstrumentView in under 1s when fetch hangs 60s", async () => {
    const t0 = Date.now();
    const [quotes, view] = await Promise.all([GET(), loadInstrumentView("NVDA")]);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(quotes.status).toBe(200);
    expect(view.display).toBe("NVDA");
  });
});
