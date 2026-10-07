import { spawn } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
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
import { withPackLock } from "@/quotes/pack-lock";
import { addWatchItem, setWatchMuted } from "@/watchlist/repo";
import { getDb, resetDbClients } from "./client";
import { createDrizzleStore } from "./drizzle-store";
import { withLedgerTransaction } from "./ledger-tx";

const prevUrl = process.env.DATABASE_URL;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Another process holds the write lock so this event loop can still commit. */
function startExclusiveLock(url: string, holdMs: number): Promise<Promise<void>> {
  return new Promise((resolve, reject) => {
    const child = spawn(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `
        import { createClient } from "@libsql/client";
        const client = createClient({ url: process.env.LOCK_URL });
        await client.execute("BEGIN EXCLUSIVE");
        process.stdout.write("LOCKED\\n");
        await new Promise((r) => setTimeout(r, Number(process.env.LOCK_MS)));
        await client.execute("COMMIT");
        client.close();
        `,
      ],
      {
        cwd: process.cwd(),
        env: { ...process.env, LOCK_URL: url, LOCK_MS: String(holdMs) },
        stdio: ["ignore", "pipe", "pipe"],
      },
    );
    const done = new Promise<void>((doneResolve, doneReject) => {
      child.on("error", doneReject);
      child.on("exit", (code) => {
        if (code === 0) {
          doneResolve();
        } else {
          doneReject(new Error(`lock child exited ${code}`));
        }
      });
    });
    let armed = false;
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => {
      if (!armed && chunk.includes("LOCKED")) {
        armed = true;
        resolve(done);
      }
    });
    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      process.stderr.write(chunk);
    });
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!armed) {
        reject(new Error(`lock child exited ${code} before LOCKED`));
      }
    });
  });
}

async function settle<T>(name: string, work: Promise<T>): Promise<{ name: string; ok: boolean }> {
  try {
    await work;
    return { name, ok: true };
  } catch {
    return { name, ok: false };
  }
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
    "never reports success for a write that another connection cannot read back",
    async () => {
      const store = createDrizzleStore();
      const { book, member, account } = await createBook(store, {
        name: "測試簿",
        createdByUserId: "user-demo",
        creatorDisplayName: "小明",
        creatorEmail: "demo@example.com",
      });
      const hk = await addWatchItem(book.id, "0700.HK");
      const nvda = await addWatchItem(book.id, "NVDA");
      const aapl = await addWatchItem(book.id, "AAPL");

      const hold = await startExclusiveLock(url, 7500);

      // Quote pack-lock retries BEGIN IMMEDIATE / COMMIT / ROLLBACK on the
      // shared client. The b3c1ba0 prepare.then wrapper let a later UPDATE
      // join that transaction and disappear on ROLLBACK.
      const pack = (async () => {
        const deadline = Date.now() + 9000;
        while (Date.now() < deadline) {
          const attempt = await settle(
            "pack-lock",
            withPackLock(
              async (tx) => {
                await tx.execute(sql`SELECT 1`);
              },
              undefined,
              { waitMs: 800, retryMs: 40 },
            ),
          );
          if (attempt.ok) {
            return attempt;
          }
        }
        return { name: "pack-lock", ok: false };
      })();

      await sleep(80);
      const firstMute = await settle("mute-0700", setWatchMuted(book.id, hk.id, true));

      const secondMute = settle("mute-nvda", setWatchMuted(book.id, nvda.id, true));
      const thirdMute = settle("mute-aapl", setWatchMuted(book.id, aapl.id, true));
      const deposit = settle(
        "ledger-deposit",
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
      const buy = settle(
        "ledger-buy",
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

      const results = [firstMute, ...(await Promise.all([secondMute, thirdMute, deposit, buy, pack]))];
      await hold;

      const probe = createClient({ url });
      try {
        const watches = await probe.execute("SELECT id, display_code, muted FROM watch_items");
        const mutedById = new Map(
          watches.rows.map((row) => [String(row.id), Number(row.muted) === 1 || row.muted === true]),
        );
        const cash = await probe.execute("SELECT id FROM cash_flows");
        const trades = await probe.execute("SELECT id FROM trades");
        const allocations = await probe.execute("SELECT id, trade_id FROM trade_allocations");

        const byName = Object.fromEntries(results.map((row) => [row.name, row.ok]));
        expect(mutedById.get(hk.id)).toBe(Boolean(byName["mute-0700"]));
        expect(mutedById.get(nvda.id)).toBe(Boolean(byName["mute-nvda"]));
        expect(mutedById.get(aapl.id)).toBe(Boolean(byName["mute-aapl"]));
        expect(cash.rows.length).toBe(byName["ledger-deposit"] ? 1 : 0);
        expect(trades.rows.length).toBe(byName["ledger-buy"] ? 1 : 0);
        expect(allocations.rows.length).toBe(byName["ledger-buy"] ? 1 : 0);
        expect(results.some((row) => row.name.startsWith("mute-") && row.ok)).toBe(true);
        expect(results.some((row) => row.name.startsWith("ledger-") && row.ok)).toBe(true);
      } finally {
        probe.close();
      }
    },
    45_000,
  );

  it("does not run a plain write while another transaction is still open", async () => {
    const store = createDrizzleStore();
    const { book } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-demo",
      creatorDisplayName: "小明",
      creatorEmail: "demo@example.com",
    });
    const nvda = await addWatchItem(book.id, "NVDA");

    let muteFinished = false;
    const open = getDb().transaction(async () => {
      await sleep(80);
      expect(muteFinished).toBe(false);
    });
    const mute = settle("mute-nvda", setWatchMuted(book.id, nvda.id, true)).then((row) => {
      muteFinished = true;
      return row;
    });
    const [, muted] = await Promise.all([open, mute]);
    expect(muted.ok).toBe(true);

    const probe = createClient({ url });
    try {
      const watches = await probe.execute({
        sql: "SELECT muted FROM watch_items WHERE id = ?",
        args: [nvda.id],
      });
      expect(Number(watches.rows[0]?.muted) === 1 || watches.rows[0]?.muted === true).toBe(true);
    } finally {
      probe.close();
    }
  });
});
