import type { LedgerStore } from "@/ledger";
import { getDb } from "./client";
import { createDrizzleStore } from "./drizzle-store";

export async function withLedgerTransaction<T>(
  fn: (store: LedgerStore) => Promise<T>,
): Promise<T> {
  const db = getDb();
  return db.transaction(async (tx) => fn(createDrizzleStore(tx)));
}
