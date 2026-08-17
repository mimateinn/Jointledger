import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createClient } from "@libsql/client";
import { afterEach, describe, expect, it } from "vitest";
import { getDb, resetDbClients } from "./client";

const prevUrl = process.env.DATABASE_URL;

describe("sqlite wal", () => {
  let dir: string;

  afterEach(() => {
    resetDbClients();
    process.env.DATABASE_URL = prevUrl;
    if (dir) {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("opens the file database with WAL", async () => {
    dir = mkdtempSync(join(tmpdir(), "joint-ledger-wal-"));
    const url = `file:${join(dir, "joint-ledger.sqlite")}`;
    process.env.DATABASE_URL = url;
    resetDbClients();
    getDb();

    const probe = createClient({ url });
    try {
      await viWaitForJournal(probe);
    } finally {
      probe.close();
    }
  });
});

async function viWaitForJournal(client: ReturnType<typeof createClient>) {
  let mode = "";
  for (let i = 0; i < 40; i += 1) {
    const rs = await client.execute("PRAGMA journal_mode");
    const row = rs.rows[0] as Record<string, unknown> | undefined;
    mode = String(row?.journal_mode ?? Object.values(row ?? {})[0] ?? "").toLowerCase();
    if (mode === "wal") {
      expect(mode).toBe("wal");
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  expect(mode).toBe("wal");
}
