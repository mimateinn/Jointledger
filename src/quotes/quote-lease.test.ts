import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resetDbClients } from "@/db/client";
import { withPackLock } from "./pack-lock";
import {
  claimQuoteRefreshLease,
  loadQuoteRows,
  QUOTE_LEASE_MS,
  saveQuoteRow,
  upsertInstruments,
} from "./store";
import { resolveInstrument } from "./symbol-map";

const prevUrl = process.env.DATABASE_URL;

describe("quote lease and fetched_at", () => {
  let dir: string;
  let url: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-lease-"));
    url = `file:${join(dir, "joint-ledger.sqlite")}`;
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

  async function seedNvda(): Promise<string> {
    const instrument = resolveInstrument("NVDA");
    if (!instrument) {
      throw new Error("NVDA must resolve");
    }
    const ids = await upsertInstruments([instrument]);
    const id = ids.get("NVDA");
    if (!id) {
      throw new Error("NVDA instrument id");
    }
    return id;
  }

  it("never overwrites a newer fetched_at with an older row", async () => {
    const id = await seedNvda();
    const fresh = new Date("2024-06-02T00:00:14Z");
    const stale = new Date("2024-06-02T00:00:01Z");
    await saveQuoteRow(id, {
      last: "fresh",
      percentChange: "1",
      previousClose: "1",
      quotedAt: fresh,
      fetchedAt: fresh,
      status: "ok",
      source: "yahoo",
    });
    await saveQuoteRow(id, {
      last: "stale",
      percentChange: "0",
      previousClose: "0",
      quotedAt: stale,
      fetchedAt: stale,
      status: "ok",
      source: "yahoo",
    });
    const row = (await loadQuoteRows(["NVDA"])).get("NVDA");
    expect(row?.last).toBe("fresh");
    expect(row?.fetchedAt.getTime()).toBe(fresh.getTime());
  });

  it("lets two processes write 14 quotes each without fetched_at going backwards", async () => {
    const id = await seedNvda();
    resetDbClients();
    const base = Date.UTC(2024, 5, 2, 0, 0, 20);
    const run = (mode: "fresh" | "stale") =>
      new Promise<void>((resolve, reject) => {
        const child = spawn(
          join(process.cwd(), "node_modules/.bin/tsx"),
          [join(process.cwd(), "src/quotes/quote-stale-writer.ts"), id, mode, String(base)],
          { env: { ...process.env, DATABASE_URL: url }, stdio: ["ignore", "pipe", "pipe"] },
        );
        let stderr = "";
        child.stderr?.on("data", (chunk) => {
          stderr += String(chunk);
        });
        child.on("exit", (code) => {
          if (code === 0) {
            resolve();
            return;
          }
          reject(new Error(`${mode} writer exited ${code}: ${stderr}`));
        });
      });
    await Promise.all([run("fresh"), run("stale")]);
    resetDbClients();
    const row = (await loadQuoteRows(["NVDA"])).get("NVDA");
    expect(row).toBeTruthy();
    expect(row!.fetchedAt.getTime()).toBeGreaterThanOrEqual(base);
    expect(row!.last?.startsWith("stale")).toBe(false);
  }, 30_000);

  it("claims a short lease and rejects a second claim until it expires", async () => {
    const now = new Date("2024-06-02T00:00:00Z");
    const first = await withPackLock((tx) => claimQuoteRefreshLease(now, tx, QUOTE_LEASE_MS));
    const second = await withPackLock((tx) => claimQuoteRefreshLease(now, tx, QUOTE_LEASE_MS));
    const after = await withPackLock((tx) =>
      claimQuoteRefreshLease(new Date(now.getTime() + QUOTE_LEASE_MS + 1), tx, QUOTE_LEASE_MS),
    );
    expect(first).toBe(true);
    expect(second).toBe(false);
    expect(after).toBe(true);
  });
});
