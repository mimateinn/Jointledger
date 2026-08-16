import { eq } from "drizzle-orm";
import type { LedgerStore } from "@/ledger";
import type {
  Book,
  CashFlow,
  LedgerAccount,
  Member,
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
  books,
  cashFlows,
  ledgerAccounts,
  members,
  tradeAllocations,
  trades,
} from "./schema";

type Executor = Pick<Database, "insert" | "select">;

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
  return {
    id: row.id,
    bookId: row.bookId,
    userId: row.userId,
    displayName: row.displayName,
    email: row.email,
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
  };
}
