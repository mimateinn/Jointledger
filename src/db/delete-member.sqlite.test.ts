import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { count } from "drizzle-orm";
import { drizzle } from "drizzle-orm/libsql";
import { migrate } from "drizzle-orm/libsql/migrator";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createBook } from "@/ledger/create-book";
import { deleteMemberCascade } from "@/ledger/delete-member";
import { resetDbClients, getDb } from "./client";
import { createDrizzleStore } from "./drizzle-store";
import { users } from "./tables";

const prevUrl = process.env.DATABASE_URL;

describe("delete last user on sqlite", () => {
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

  it("last member delete leaves zero users for 建立帳戶", async () => {
    const store = createDrizzleStore();
    const { book, member } = await createBook(store, {
      name: "測試簿",
      createdByUserId: "user-demo",
      creatorDisplayName: "小明",
      creatorEmail: "demo@example.com",
    });

    const result = await deleteMemberCascade({ bookId: book.id, memberId: member.id });
    expect(result.bookDeleted).toBe(true);
    expect(result.deletedUserId).toBe("user-demo");
    expect(result.usersRemaining).toBe(0);

    const db = getDb();
    const [row] = await db.select({ n: count() }).from(users);
    expect(Number(row?.n ?? 0)).toBe(0);
  });
});
