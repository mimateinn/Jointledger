import { spawn } from "node:child_process";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDbClients } from "@/db/client";
import { withPackLock } from "./pack-lock";
import { QUOTE_FETCH_BUDGET_MS } from "./public-source";
import { ensureQuotes } from "./refresh";
import {
  claimQuoteRefreshLease,
  loadQuoteRows,
  QUOTE_LEASE_MS,
  saveQuoteRow,
  upsertInstruments,
} from "./store";
import { resolveInstrument } from "./symbol-map";
import * as twelveData from "./twelve-data";
import { TWELVE_DATA_TIMEOUT_MS } from "./twelve-data";

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
          [join(process.cwd(), "scripts/quote-stale-writer.ts"), id, mode, String(base)],
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

  it("keeps the stale-writer fixture outside src", () => {
    expect(existsSync(join(process.cwd(), "src/quotes/quote-stale-writer.ts"))).toBe(false);
    expect(existsSync(join(process.cwd(), "scripts/quote-stale-writer.ts"))).toBe(true);
  });

  it("keeps the quote fetch budget below the lease", () => {
    expect(QUOTE_FETCH_BUDGET_MS).toBeLessThan(QUOTE_LEASE_MS);
    expect(TWELVE_DATA_TIMEOUT_MS).toBeLessThan(QUOTE_LEASE_MS);
  });

  it("releases the quote lease when a fetch throws", async () => {
    const prevKey = process.env.TWELVE_DATA_API_KEY;
    process.env.TWELVE_DATA_API_KEY = "test-key";
    const spy = vi.spyOn(twelveData, "fetchTwelveDataBatch").mockRejectedValue(new Error("upstream"));
    try {
      const instrument = resolveInstrument("NVDA");
      if (!instrument) {
        throw new Error("NVDA must resolve");
      }
      await upsertInstruments([instrument]);
      const now = new Date("2024-06-02T00:00:00Z");
      await ensureQuotes(["NVDA"], now, { forceDisplays: ["NVDA"] });
      const again = await withPackLock((tx) =>
        claimQuoteRefreshLease(new Date(now.getTime() + 1_000), tx, QUOTE_LEASE_MS),
      );
      expect(again).toBe(true);
    } finally {
      spy.mockRestore();
      if (prevKey === undefined) {
        delete process.env.TWELVE_DATA_API_KEY;
      } else {
        process.env.TWELVE_DATA_API_KEY = prevKey;
      }
    }
  });
});
