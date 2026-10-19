import { and, eq, inArray, isNull } from "drizzle-orm";
import type { LedgerStore } from "@/ledger";
import type {
  AllocationLeg,
  AllocationSchedule,
  Book,
  CashFlow,
  LedgerAccount,
  Member,
  NewAllocationLeg,
  NewAllocationSchedule,
  NewBook,
  NewCashFlow,
  NewLedgerAccount,
  NewMember,
  NewTrade,
  NewTradeAllocation,
  Trade,
  TradeAllocation,
} from "@/ledger/types";
import { getDb, type Database } from "./client";
import {
  allocationLegs,
  allocationSchedules,
  books,
  cashFlows,
  ledgerAccounts,
  members,
  tradeAllocations,
  trades,
} from "./tables";

type Executor = Pick<Database, "insert" | "select" | "delete">;

function asBook(row: typeof books.$inferSelect): Book {
  return {
    id: row.id,
    name: row.name,
    tradeCurrency: row.tradeCurrency,
    depositCurrency: row.depositCurrency,
    createdByUserId: row.createdByUserId,
  };
}

function asMember(row: typeof members.$inferSelect): Member {
  const expires = row.inviteExpiresAt ? new Date(row.inviteExpiresAt).getTime() : 0;
  return {
    id: row.id,
    bookId: row.bookId,
    userId: row.userId,
    displayName: row.displayName,
    email: row.email,
    hasPendingInvite: Boolean(row.inviteSecretHash && (!row.inviteExpiresAt || expires > Date.now())),
  };
}

function asAccount(row: typeof ledgerAccounts.$inferSelect): LedgerAccount {
  return {
    id: row.id,
    bookId: row.bookId,
    memberId: row.memberId,
    kind: row.kind as LedgerAccount["kind"],
    name: row.name,
  };
}

function asCashFlow(row: typeof cashFlows.$inferSelect): CashFlow {
  return {
    id: row.id,
    bookId: row.bookId,
    memberId: row.memberId,
    ledgerAccountId: row.ledgerAccountId,
    kind: row.kind as CashFlow["kind"],
    amountHkd: row.amountHkd,
    fxRate: row.fxRate,
    amountUsd: row.amountUsd,
    occurredOn: row.occurredOn,
  };
}

function asTrade(row: typeof trades.$inferSelect): Trade {
  return {
    id: row.id,
    bookId: row.bookId,
    ledgerAccountId: row.ledgerAccountId,
    symbol: row.symbol,
    side: row.side as Trade["side"],
    quantity: row.quantity,
    price: row.price,
    feeUsd: row.feeUsd,
    occurredOn: row.occurredOn,
    note: row.note,
  };
}

function asAllocation(row: typeof tradeAllocations.$inferSelect): TradeAllocation {
  return {
    id: row.id,
    tradeId: row.tradeId,
    memberId: row.memberId,
    quantity: row.quantity,
    costUsd: row.costUsd,
    proceedsUsd: row.proceedsUsd,
  };
}

function asSchedule(row: typeof allocationSchedules.$inferSelect): AllocationSchedule {
  return {
    id: row.id,
    bookId: row.bookId,
    effectiveOn: row.effectiveOn,
  };
}

function asScheduleLeg(row: typeof allocationLegs.$inferSelect): AllocationLeg {
  return {
    id: row.id,
    scheduleId: row.scheduleId,
    memberId: row.memberId,
    percent: row.percent,
  };
}

export function createDrizzleStore(db: Executor = getDb()): LedgerStore {
  return {
    async insertBook(input: NewBook) {
      const [row] = await db.insert(books).values(input).returning();
      return asBook(row);
    },
    async insertMember(input: NewMember) {
      const [row] = await db.insert(members).values(input).returning();
      return asMember(row);
    },
    async insertLedgerAccount(input: NewLedgerAccount) {
      const [row] = await db.insert(ledgerAccounts).values(input).returning();
      return asAccount(row);
    },
    async insertCashFlow(input: NewCashFlow) {
      const [row] = await db.insert(cashFlows).values(input).returning();
      return asCashFlow(row);
    },
    async insertTrade(input: NewTrade) {
      const [row] = await db.insert(trades).values(input).returning();
      return asTrade(row);
    },
    async insertTradeAllocation(input: NewTradeAllocation) {
      const [row] = await db.insert(tradeAllocations).values(input).returning();
      return asAllocation(row);
    },
    async insertAllocationSchedule(input: NewAllocationSchedule) {
      const [row] = await db.insert(allocationSchedules).values(input).returning();
      return asSchedule(row);
    },
    async insertAllocationLeg(input: NewAllocationLeg) {
      const [row] = await db.insert(allocationLegs).values(input).returning();
      return asScheduleLeg(row);
    },
    async listCashFlows(bookId: string) {
      const rows = await db.select().from(cashFlows).where(eq(cashFlows.bookId, bookId));
      return rows.map(asCashFlow);
    },
    async listTrades(bookId: string) {
      const rows = await db.select().from(trades).where(eq(trades.bookId, bookId));
      return rows.map(asTrade);
    },
    async listTradeAllocations(bookId: string) {
      const rows = await db
        .select({ allocation: tradeAllocations })
        .from(tradeAllocations)
        .innerJoin(trades, eq(tradeAllocations.tradeId, trades.id))
        .where(eq(trades.bookId, bookId));
      return rows.map((row) => asAllocation(row.allocation));
    },
    async getLedgerAccount(id: string) {
      const [row] = await db
        .select()
        .from(ledgerAccounts)
        .where(eq(ledgerAccounts.id, id));
      return row ? asAccount(row) : null;
    },
    async listMembers(bookId: string) {
      const rows = await db.select().from(members).where(eq(members.bookId, bookId));
      return rows.map(asMember);
    },
    async listLedgerAccounts(bookId: string) {
      const rows = await db.select().from(ledgerAccounts).where(eq(ledgerAccounts.bookId, bookId));
      return rows.map(asAccount);
    },
    async listAllocationSchedules(bookId: string) {
      const scheduleRows = await db
        .select()
        .from(allocationSchedules)
        .where(eq(allocationSchedules.bookId, bookId));
      const ids = scheduleRows.map((row) => row.id);
      const legRows =
        ids.length === 0
          ? []
          : await db.select().from(allocationLegs).where(inArray(allocationLegs.scheduleId, ids));
      return scheduleRows.map((schedule) => ({
        ...asSchedule(schedule),
        legs: legRows.filter((leg) => leg.scheduleId === schedule.id).map(asScheduleLeg),
      }));
    },
    async clearBookEntries(bookId: string, options) {
      const bookTrades = await db.select({ id: trades.id }).from(trades).where(eq(trades.bookId, bookId));
      const tradeIds = bookTrades.map((row) => row.id);
      if (tradeIds.length > 0) {
        await db.delete(tradeAllocations).where(inArray(tradeAllocations.tradeId, tradeIds));
      }
      await db.delete(trades).where(eq(trades.bookId, bookId));
      await db.delete(cashFlows).where(eq(cashFlows.bookId, bookId));
      if (options?.preserveSchedules) {
        return;
      }
      const bookSchedules = await db
        .select({ id: allocationSchedules.id })
        .from(allocationSchedules)
        .where(eq(allocationSchedules.bookId, bookId));
      const scheduleIds = bookSchedules.map((row) => row.id);
      if (scheduleIds.length > 0) {
        await db.delete(allocationLegs).where(inArray(allocationLegs.scheduleId, scheduleIds));
      }
      await db.delete(allocationSchedules).where(eq(allocationSchedules.bookId, bookId));
    },
    checkpoint() {
      return null;
    },
    restore(_snapshot: unknown) {
      void _snapshot;
    },
    async deleteAllocations(ids: string[]) {
      if (ids.length === 0) {
        return;
      }
      await db.delete(tradeAllocations).where(inArray(tradeAllocations.id, ids));
    },
    async deleteTradesIfUnused(bookId: string, tradeIds: string[]) {
      if (tradeIds.length === 0) {
        return;
      }
      const leftover = await db
        .select({ tradeId: tradeAllocations.tradeId })
        .from(tradeAllocations)
        .where(inArray(tradeAllocations.tradeId, tradeIds));
      const stillUsed = new Set(leftover.map((row) => row.tradeId));
      const unused = tradeIds.filter((id) => !stillUsed.has(id));
      if (unused.length === 0) {
        return;
      }
      await db.delete(trades).where(and(eq(trades.bookId, bookId), inArray(trades.id, unused)));
    },
    async deleteCashFlows(bookId: string, ids: string[]) {
      if (ids.length === 0) {
        return;
      }
      await db.delete(cashFlows).where(and(eq(cashFlows.bookId, bookId), inArray(cashFlows.id, ids)));
    },
    async removeUnclaimedMember(bookId: string, memberId: string) {
      const [member] = await db
        .select()
        .from(members)
        .where(and(eq(members.id, memberId), eq(members.bookId, bookId), isNull(members.userId)))
        .limit(1);
      if (!member) {
        return;
      }
      const expires = member.inviteExpiresAt ? new Date(member.inviteExpiresAt).getTime() : 0;
      if (member.inviteSecretHash && (!member.inviteExpiresAt || expires > Date.now())) {
        return;
      }
      const [cash] = await db
        .select({ id: cashFlows.id })
        .from(cashFlows)
        .where(and(eq(cashFlows.bookId, bookId), eq(cashFlows.memberId, memberId)))
        .limit(1);
      if (cash) {
        return;
      }
      const [alloc] = await db
        .select({ id: tradeAllocations.id })
        .from(tradeAllocations)
        .where(eq(tradeAllocations.memberId, memberId))
        .limit(1);
      if (alloc) {
        return;
      }
      const [leg] = await db
        .select({ id: allocationLegs.id })
        .from(allocationLegs)
        .where(eq(allocationLegs.memberId, memberId))
        .limit(1);
      if (leg) {
        return;
      }
      await db
        .delete(ledgerAccounts)
        .where(
          and(eq(ledgerAccounts.bookId, bookId), eq(ledgerAccounts.memberId, memberId), eq(ledgerAccounts.kind, "personal")),
        );
      await db.delete(members).where(and(eq(members.id, memberId), eq(members.bookId, bookId), isNull(members.userId)));
    },
  };
}
