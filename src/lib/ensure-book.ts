import { withLedgerTransaction } from "@/db/ledger-tx";
import { createBook } from "@/ledger";
import type { SessionUser } from "@/auth/session";
import { getCurrentMembership } from "./current-book";

/** Empty book is usable. Never bounce the six nav items to a blocking wizard. */
export async function ensureCurrentBook(user: SessionUser) {
  const existing = await getCurrentMembership(user);
  if (existing) {
    return existing;
  }
  await withLedgerTransaction((store) =>
    createBook(store, {
      name: "聯倉",
      createdByUserId: user.id,
      creatorDisplayName: user.displayName,
      creatorEmail: user.email,
    }),
  );
  const created = await getCurrentMembership(user);
  if (!created) {
    throw new Error("開表失敗");
  }
  return created;
}
