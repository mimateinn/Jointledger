import { count } from "drizzle-orm";
import { getDb, type Database } from "./client";
import { users } from "./tables";
import { xactLockSql } from "./xact-lock";

export async function insertFirstUser(
  input: { displayName: string; email: string | null; passwordHash: string },
  db: Database = getDb(),
) {
  return db.transaction(async (tx) => {
    await tx.execute(xactLockSql(87241001));
    const [existing] = await tx.select({ n: count() }).from(users);
    if (Number(existing?.n ?? 0) > 0) {
      return { ok: false as const };
    }
    const [created] = await tx.insert(users).values(input).returning();
    return { ok: true as const, user: created };
  });
}
