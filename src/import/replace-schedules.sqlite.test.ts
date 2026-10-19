import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { addMember } from "@/ledger/add-member";
import { createBook } from "@/ledger/create-book";
import { createJointAccount } from "@/ledger/create-joint-account";
import { createTrade } from "@/ledger/create-trade";
import { setAllocationSchedule } from "@/ledger/set-allocation-schedule";
import { resetDbClients } from "@/db/client";
import { createDrizzleStore } from "@/db/drizzle-store";
import { applyImport } from "./apply";
import { EXPORT_FILENAME, exportBookXlsx } from "./book-export";
import { mapUpload } from "./columns";
import { buildPlan } from "./plan";

vi.mock("server-only", () => ({}));

const { parseUpload, pickOptionalSheets, pickSheets } = await import("./parse");

const prevUrl = process.env.DATABASE_URL;

function importAll(plan: ReturnType<typeof buildPlan>) {
  const pending: Record<string, "import" | "skip"> = {};
  for (const issue of plan.issues.filter((item) => item.pending)) {
    pending[issue.id] = "import";
  }
  return { pending };
}

describe("replace clears schedules on sqlite", () => {
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
      args: ["user-demo", "Hey", "demo@example.com", Date.now()],
    });
    client.close();
  });

  afterEach(() => {
    resetDbClients();
    process.env.DATABASE_URL = prevUrl;
    rmSync(dir, { recursive: true, force: true });
  });

  it("does not duplicate allocation legs after two replace imports", async () => {
    const store = createDrizzleStore();
    const { book, member: hey } = await createBook(store, {
      name: "聯倉",
      createdByUserId: "user-demo",
      creatorDisplayName: "Hey",
      creatorEmail: "demo@example.com",
    });
    const sze = await addMember(store, { bookId: book.id, displayName: "Sze" });
    const joint = await createJointAccount(store, { bookId: book.id, name: "聯名" });
    await setAllocationSchedule(store, {
      bookId: book.id,
      effectiveOn: "2024-01-01",
      legs: [
        { memberId: hey.id, percent: "0.6" },
        { memberId: sze.member.id, percent: "0.4" },
      ],
    });
    await createTrade(store, {
      bookId: book.id,
      ledgerAccountId: joint.id,
      memberId: hey.id,
      symbol: "NVDA",
      quantity: "10",
      price: "10",
      occurredOn: "2024-02-01",
    });

    const bytes = await exportBookXlsx(store, book.id);
    const parsed = await parseUpload([{ name: EXPORT_FILENAME, bytes }]);
    const { transinfo, account } = pickSheets(parsed);
    const extras = pickOptionalSheets(parsed);
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, account, mapUpload(transinfo, account), extras);

    await applyImport(store, plan, {
      createdByUserId: "user-demo",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });
    await applyImport(store, plan, {
      createdByUserId: "user-demo",
      creatorDisplayName: "Hey",
      existingBookId: book.id,
      decisions: { ...importAll(plan), reimportMode: "replace" },
    });

    const schedules = await store.listAllocationSchedules(book.id);
    expect(schedules).toHaveLength(1);
    expect(schedules[0]?.legs).toHaveLength(2);
    const trades = await store.listTrades(book.id);
    const nvdaIds = new Set(trades.filter((row) => row.symbol === "NVDA").map((row) => row.id));
    const allocations = (await store.listTradeAllocations(book.id)).filter((row) => nvdaIds.has(row.tradeId));
    expect(allocations).toHaveLength(2);
  });
});
