import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBook } from "@/ledger/create-book";
import { createCashFlow } from "@/ledger/create-cash-flow";
import { createTrade } from "@/ledger/create-trade";
import { deleteLot } from "@/ledger/delete-lot";
import { openLotsFromTrades, summarizeLedger } from "@/ledger/summary";
import { resetDbClients } from "./client";
import { createDrizzleStore } from "./drizzle-store";

const prevUrl = process.env.DATABASE_URL;

function snapshot(
  store: ReturnType<typeof createDrizzleStore>,
  bookId: string,
) {
  return Promise.all([
    store.listCashFlows(bookId),
    store.listTrades(bookId),
    store.listTradeAllocations(bookId),
  ]).then(([cashFlows, trades, allocations]) => {
    const lots = openLotsFromTrades(trades, allocations);
    return summarizeLedger(cashFlows, allocations, lots);
  });
}

describe("cash invariant on sqlite", () => {
  let dir: string;

  beforeEach(async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-"));
    const file = join(dir, "joint-ledger.sqlite");
    const url = `file:${file}`;
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

  it("keeps cash at 500 after deposit 1000 and buy 10 @ 50", async () => {
    const store = createDrizzleStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-demo",
      creatorDisplayName: "小明",
      creatorEmail: "demo@example.com",
    });

    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });

    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });

    const afterBuy = await snapshot(store, book.id);
    resetDbClients();
    const client = createClient({ url: `file:${join(dir, "joint-ledger.sqlite")}` });
    const stored = await client.execute(
      "SELECT typeof(amount_usd) AS t, amount_usd AS v FROM cash_flows",
    );
    client.close();
    expect(String(stored.rows[0]?.t)).toBe("text");
    expect(String(stored.rows[0]?.v)).not.toMatch(/e/i);

    expect(afterBuy.cashUsd.toFixed(2)).toBe("500.00");
    expect(afterBuy.openValueUsd.toFixed(2)).toBe("0.00");
    expect(afterBuy.navUsd.toFixed(2)).toBe("500.00");
    expect(afterBuy.partial).toBe(true);
    expect(afterBuy.navUsd.toFixed(2)).not.toBe("1000.00");
    expect(afterBuy.navUsd.toFixed(2)).not.toBe("1500.00");
  });

  it("deleting a buy lot restores cash to 1000", async () => {
    const store = createDrizzleStore();
    const { book, member, account } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-demo",
      creatorDisplayName: "小明",
      creatorEmail: "demo@example.com",
    });

    await createCashFlow(store, {
      bookId: book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: "1000",
      fxRate: "1",
      occurredOn: "2024-01-01",
    });

    const { trade } = await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: account.id,
      memberId: member.id,
      symbol: "NVDA",
      quantity: "10",
      price: "50",
      occurredOn: "2024-01-02",
    });

    const afterBuy = await snapshot(store, book.id);
    expect(afterBuy.cashUsd.toFixed(2)).toBe("500.00");

    await deleteLot(store, { bookId: book.id, tradeId: trade.id, memberId: member.id });
    const afterDelete = await snapshot(store, book.id);
    expect(afterDelete.cashUsd.toFixed(2)).toBe("1000.00");
    expect(afterDelete.navUsd.toFixed(2)).toBe("1000.00");
    expect((await store.listTrades(book.id)).length).toBe(0);
  });
});
