import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, describe, expect, it } from "vitest";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createTrade } from "@/ledger/create-trade";
import { addWatchItem, setWatchMuted } from "@/watchlist/repo";
import { getDb, resetDbClients } from "./client";
import { createDrizzleStore } from "./drizzle-store";
import { withLedgerTransaction } from "./ledger-tx";

const prevUrl = process.env.DATABASE_URL;
const RUNS = 10;
const LOCK_MS = 7500;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function holdWriteLock(url: string): Promise<{ release: () => Promise<void> }> {
  const child = spawn(process.execPath, [join(process.cwd(), "scripts/busy-lock-child.mjs"), url, String(LOCK_MS)], {
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stderr = "";
  child.stderr?.on("data", (chunk) => {
    stderr += String(chunk);
  });
  await new Promise<void>((resolve, reject) => {
    let locked = false;
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(new Error(`lock child did not print LOCKED: ${stderr || "timeout"}`));
    }, 5000);
    child.stdout?.on("data", (chunk) => {
      if (!String(chunk).includes("LOCKED") || locked) {
        return;
      }
      locked = true;
      clearTimeout(timer);
      resolve();
    });
    child.on("exit", (code) => {
      if (locked) {
        return;
      }
      clearTimeout(timer);
      reject(new Error(`lock child exited ${code}: ${stderr}`));
    });
  });
  return {
    release: async () => {
      if (child.exitCode != null) {
        return;
      }
      child.kill("SIGTERM");
      await new Promise<void>((resolve) => {
        child.once("exit", () => resolve());
        setTimeout(resolve, 2000);
      });
    },
  };
}

async function settle(work: Promise<unknown>): Promise<boolean> {
  try {
    await work;
    return true;
  } catch {
    return false;
  }
}

function dbRun(query: unknown): Promise<unknown> {
  return (getDb() as unknown as { run: (q: unknown) => Promise<unknown> }).run(query);
}

describe.skipIf(process.env.BUSY_E2E !== "1")("sqlite busy write e2e", () => {
  afterEach(() => {
    resetDbClients();
    process.env.DATABASE_URL = prevUrl;
  });

  it(
    "commits mute + deposit + buy after a 7.5s lock on every run",
    async () => {
      for (let run = 1; run <= RUNS; run += 1) {
        const dir = mkdtempSync(join(tmpdir(), "jl-busy-e2e-"));
        const url = `file:${join(dir, "joint-ledger.sqlite")}`;
        process.env.DATABASE_URL = url;
        resetDbClients();
        const setup = createClient({ url });
        await setup.execute("PRAGMA foreign_keys = OFF");
        await migrate(drizzle(setup), { migrationsFolder: "./drizzle-sqlite" });
        await setup.execute("PRAGMA foreign_keys = ON");
        await setup.execute({
          sql: "INSERT INTO users (id, display_name, email, created_at) VALUES (?, ?, ?, ?)",
          args: ["user-demo", "小明", "demo@example.com", Date.now()],
        });
        setup.close();

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
        const busyStarted = Date.now();
        const busy = settle(dbRun(sql`UPDATE watch_items SET muted = 1 WHERE id = ${nvda.id}`));
        await sleep(LOCK_MS);
        await lock.release();
        const busyOk = await busy;
        expect(busyOk, `run ${run} BUSY write should fail`).toBe(false);
        expect(Date.now() - busyStarted).toBeGreaterThan(4000);

        const muteOk = await settle(setWatchMuted(book.id, nvda.id, true));
        const depositOk = await settle(
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
        const buyOk = await settle(
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
        const watches = await probe.execute({
          sql: "SELECT muted FROM watch_items WHERE id = ?",
          args: [nvda.id],
        });
        const cash = await probe.execute("SELECT id FROM cash_flows");
        const trades = await probe.execute("SELECT id FROM trades");
        probe.close();
        const muted = Number(watches.rows[0]?.muted) === 1 || watches.rows[0]?.muted === true;
        expect(muteOk && muted, `run ${run} mute`).toBe(true);
        expect(depositOk && cash.rows.length === 1, `run ${run} deposit`).toBe(true);
        expect(buyOk && trades.rows.length === 1, `run ${run} buy`).toBe(true);
        resetDbClients();
        rmSync(dir, { recursive: true, force: true });
      }
    },
    180_000,
  );
});
