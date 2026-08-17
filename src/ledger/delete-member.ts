import { and, count, eq, inArray } from "drizzle-orm";
import { getDb } from "@/db/client";
import {
  allocationLegs,
  allocationSchedules,
  books,
  cashFlows,
  importBatches,
  ledgerAccounts,
  members,
  sessions,
  tradeAllocations,
  trades,
  users,
  watchItems,
} from "@/db/tables";

export type DeleteMemberResult = {
  deletedUserId: string | null;
  bookDeleted: boolean;
  usersRemaining: number;
};

/**
 * Remove a member and, if bound, their user. Last claimed user on the book
 * takes the book with them. Last user in the DB leaves an empty register path.
 */
export async function deleteMemberCascade(input: {
  bookId: string;
  memberId: string;
}): Promise<DeleteMemberResult> {
  const db = getDb();
  return db.transaction(async (tx) => {
    const [member] = await tx
      .select()
      .from(members)
      .where(and(eq(members.id, input.memberId), eq(members.bookId, input.bookId)))
      .limit(1);
    if (!member) {
      throw new Error("搵唔到呢個成員");
    }

    const bookMembers = await tx.select().from(members).where(eq(members.bookId, input.bookId));
    const claimedLeft = bookMembers.filter(
      (row) => row.id !== member.id && row.userId != null,
    );
    const wipeBook = claimedLeft.length === 0;

    const memberTrades = await tx
      .select({ id: trades.id })
      .from(trades)
      .innerJoin(tradeAllocations, eq(tradeAllocations.tradeId, trades.id))
      .where(and(eq(trades.bookId, input.bookId), eq(tradeAllocations.memberId, member.id)));
    const memberTradeIds = [...new Set(memberTrades.map((row) => row.id))];
    if (memberTradeIds.length > 0) {
      await tx
        .delete(tradeAllocations)
        .where(
          and(
            eq(tradeAllocations.memberId, member.id),
            inArray(tradeAllocations.tradeId, memberTradeIds),
          ),
        );
      const leftover = await tx
        .select({ tradeId: tradeAllocations.tradeId })
        .from(tradeAllocations)
        .where(inArray(tradeAllocations.tradeId, memberTradeIds));
      const used = new Set(leftover.map((row) => row.tradeId));
      const unused = memberTradeIds.filter((id) => !used.has(id));
      if (unused.length > 0) {
        await tx.delete(trades).where(and(eq(trades.bookId, input.bookId), inArray(trades.id, unused)));
      }
    }

    await tx
      .delete(cashFlows)
      .where(and(eq(cashFlows.bookId, input.bookId), eq(cashFlows.memberId, member.id)));
    await tx.delete(allocationLegs).where(eq(allocationLegs.memberId, member.id));

    const schedules = await tx
      .select()
      .from(allocationSchedules)
      .where(eq(allocationSchedules.bookId, input.bookId));
    for (const schedule of schedules) {
      const [legs] = await tx
        .select({ n: count() })
        .from(allocationLegs)
        .where(eq(allocationLegs.scheduleId, schedule.id));
      if (Number(legs?.n ?? 0) === 0) {
        await tx.delete(allocationSchedules).where(eq(allocationSchedules.id, schedule.id));
      }
    }

    await tx
      .delete(ledgerAccounts)
      .where(and(eq(ledgerAccounts.bookId, input.bookId), eq(ledgerAccounts.memberId, member.id)));
    await tx.delete(members).where(eq(members.id, member.id));

    if (wipeBook) {
      const bookTrades = await tx.select({ id: trades.id }).from(trades).where(eq(trades.bookId, input.bookId));
      const tradeIds = bookTrades.map((row) => row.id);
      if (tradeIds.length > 0) {
        await tx.delete(tradeAllocations).where(inArray(tradeAllocations.tradeId, tradeIds));
      }
      await tx.delete(trades).where(eq(trades.bookId, input.bookId));
      await tx.delete(cashFlows).where(eq(cashFlows.bookId, input.bookId));
      const leftoverSchedules = await tx
        .select({ id: allocationSchedules.id })
        .from(allocationSchedules)
        .where(eq(allocationSchedules.bookId, input.bookId));
      const scheduleIds = leftoverSchedules.map((row) => row.id);
      if (scheduleIds.length > 0) {
        await tx.delete(allocationLegs).where(inArray(allocationLegs.scheduleId, scheduleIds));
      }
      await tx.delete(allocationSchedules).where(eq(allocationSchedules.bookId, input.bookId));
      await tx.delete(ledgerAccounts).where(eq(ledgerAccounts.bookId, input.bookId));
      await tx.delete(watchItems).where(eq(watchItems.bookId, input.bookId));
      await tx.delete(importBatches).where(eq(importBatches.bookId, input.bookId));
      await tx.delete(members).where(eq(members.bookId, input.bookId));
      await tx.delete(books).where(eq(books.id, input.bookId));
    } else if (member.userId) {
      const [other] = claimedLeft;
      if (other?.userId) {
        await tx
          .update(books)
          .set({ createdByUserId: other.userId })
          .where(and(eq(books.id, input.bookId), eq(books.createdByUserId, member.userId)));
      }
    }

    let deletedUserId: string | null = null;
    if (member.userId) {
      deletedUserId = member.userId;
      await tx.delete(importBatches).where(eq(importBatches.createdByUserId, member.userId));
      await tx.delete(sessions).where(eq(sessions.userId, member.userId));
      const stillOwns = await tx
        .select({ id: books.id })
        .from(books)
        .where(eq(books.createdByUserId, member.userId))
        .limit(1);
      if (stillOwns.length > 0) {
        throw new Error("呢個用戶仲開住記帳表，刪唔到");
      }
      await tx.delete(users).where(eq(users.id, member.userId));
    }

    const [remaining] = await tx.select({ n: count() }).from(users);
    return {
      deletedUserId,
      bookDeleted: wipeBook,
      usersRemaining: Number(remaining?.n ?? 0),
    };
  });
}
