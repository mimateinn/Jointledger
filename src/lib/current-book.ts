import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { books, ledgerAccounts, members } from "@/db/tables";
import type { SessionUser } from "@/auth/session";

export async function getCurrentMembership(user: SessionUser) {
  const db = getDb();
  const [member] = await db
    .select()
    .from(members)
    .where(eq(members.userId, user.id))
    .limit(1);
  if (!member) {
    return null;
  }
  const [book] = await db.select().from(books).where(eq(books.id, member.bookId)).limit(1);
  if (!book) {
    return null;
  }
  const bookMembers = await db.select().from(members).where(eq(members.bookId, book.id));
  const accounts = await db
    .select()
    .from(ledgerAccounts)
    .where(eq(ledgerAccounts.bookId, book.id));
  return { book, member, members: bookMembers, accounts };
}
