import type { LedgerStore } from "./store";
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
} from "./types";

function id(): string {
  return crypto.randomUUID();
}

export function createMemoryStore(): LedgerStore & {
  books: Book[];
  members: Member[];
  accounts: LedgerAccount[];
  cashFlows: CashFlow[];
  trades: Trade[];
  allocations: TradeAllocation[];
  schedules: AllocationSchedule[];
  scheduleLegs: AllocationLeg[];
} {
  const books: Book[] = [];
  const members: Member[] = [];
  const accounts: LedgerAccount[] = [];
  const cashFlows: CashFlow[] = [];
  const trades: Trade[] = [];
  const allocations: TradeAllocation[] = [];
  const schedules: AllocationSchedule[] = [];
  const scheduleLegs: AllocationLeg[] = [];

  type MemorySnapshot = {
    books: Book[];
    members: Member[];
    accounts: LedgerAccount[];
    cashFlows: CashFlow[];
    trades: Trade[];
    allocations: TradeAllocation[];
    schedules: AllocationSchedule[];
    scheduleLegs: AllocationLeg[];
  };

  function replaceAll<T>(target: T[], next: readonly T[]): void {
    target.splice(0, target.length, ...next.map((row) => ({ ...row })));
  }

  return {
    books,
    members,
    accounts,
    cashFlows,
    trades,
    allocations,
    schedules,
    scheduleLegs,
    async insertBook(input: NewBook) {
      const book: Book = { id: id(), ...input };
      books.push(book);
      return book;
    },
    async insertMember(input: NewMember) {
      const member: Member = { id: id(), ...input };
      members.push(member);
      return member;
    },
    async insertLedgerAccount(input: NewLedgerAccount) {
      const account: LedgerAccount = { id: id(), ...input };
      accounts.push(account);
      return account;
    },
    async insertCashFlow(input: NewCashFlow) {
      const row: CashFlow = { id: id(), ...input };
      cashFlows.push(row);
      return row;
    },
    async insertTrade(input: NewTrade) {
      const row: Trade = { id: id(), ...input };
      trades.push(row);
      return row;
    },
    async insertTradeAllocation(input: NewTradeAllocation) {
      const row: TradeAllocation = { id: id(), ...input };
      allocations.push(row);
      return row;
    },
    async insertAllocationSchedule(input: NewAllocationSchedule) {
      const row: AllocationSchedule = { id: id(), ...input };
      schedules.push(row);
      return row;
    },
    async insertAllocationLeg(input: NewAllocationLeg) {
      const row: AllocationLeg = { id: id(), ...input };
      scheduleLegs.push(row);
      return row;
    },
    async listCashFlows(bookId: string) {
      return cashFlows.filter((row) => row.bookId === bookId);
    },
    async listTrades(bookId: string) {
      return trades.filter((row) => row.bookId === bookId);
    },
    async listTradeAllocations(bookId: string) {
      const tradeIds = new Set(trades.filter((row) => row.bookId === bookId).map((row) => row.id));
      return allocations.filter((row) => tradeIds.has(row.tradeId));
    },
    async getLedgerAccount(accountId: string) {
      return accounts.find((row) => row.id === accountId) ?? null;
    },
    async listAllocationSchedules(bookId: string) {
      return schedules
        .filter((row) => row.bookId === bookId)
        .map((schedule) => ({
          ...schedule,
          legs: scheduleLegs.filter((leg) => leg.scheduleId === schedule.id),
        }));
    },
    async listMembers(bookId: string) {
      return members.filter((row) => row.bookId === bookId);
    },
    async listLedgerAccounts(bookId: string) {
      return accounts.filter((row) => row.bookId === bookId);
    },
    async removeUnclaimedMember(bookId: string, memberId: string) {
      const member = members.find((row) => row.id === memberId && row.bookId === bookId);
      if (!member || member.userId) {
        return;
      }
      if (cashFlows.some((row) => row.memberId === memberId)) {
        return;
      }
      if (allocations.some((row) => row.memberId === memberId)) {
        return;
      }
      if (scheduleLegs.some((row) => row.memberId === memberId)) {
        return;
      }
      for (let i = accounts.length - 1; i >= 0; i -= 1) {
        if (accounts[i].bookId === bookId && accounts[i].memberId === memberId && accounts[i].kind === "personal") {
          accounts.splice(i, 1);
        }
      }
      const index = members.findIndex((row) => row.id === memberId);
      if (index >= 0) {
        members.splice(index, 1);
      }
    },
    async clearBookEntries(bookId: string, options) {
      const tradeIds = new Set(trades.filter((row) => row.bookId === bookId).map((row) => row.id));
      const scheduleIds = new Set(schedules.filter((row) => row.bookId === bookId).map((row) => row.id));
      for (let i = allocations.length - 1; i >= 0; i -= 1) {
        if (tradeIds.has(allocations[i].tradeId)) {
          allocations.splice(i, 1);
        }
      }
      for (let i = trades.length - 1; i >= 0; i -= 1) {
        if (trades[i].bookId === bookId) {
          trades.splice(i, 1);
        }
      }
      for (let i = cashFlows.length - 1; i >= 0; i -= 1) {
        if (cashFlows[i].bookId === bookId) {
          cashFlows.splice(i, 1);
        }
      }
      if (options?.preserveSchedules) {
        return;
      }
      for (let i = scheduleLegs.length - 1; i >= 0; i -= 1) {
        if (scheduleIds.has(scheduleLegs[i].scheduleId)) {
          scheduleLegs.splice(i, 1);
        }
      }
      for (let i = schedules.length - 1; i >= 0; i -= 1) {
        if (schedules[i].bookId === bookId) {
          schedules.splice(i, 1);
        }
      }
    },
    checkpoint() {
      return structuredClone({
        books,
        members,
        accounts,
        cashFlows,
        trades,
        allocations,
        schedules,
        scheduleLegs,
      }) satisfies MemorySnapshot;
    },
    restore(snapshot: unknown) {
      const next = snapshot as MemorySnapshot;
      replaceAll(books, next.books);
      replaceAll(members, next.members);
      replaceAll(accounts, next.accounts);
      replaceAll(cashFlows, next.cashFlows);
      replaceAll(trades, next.trades);
      replaceAll(allocations, next.allocations);
      replaceAll(schedules, next.schedules);
      replaceAll(scheduleLegs, next.scheduleLegs);
    },
    async deleteAllocations(ids: string[]) {
      const remove = new Set(ids);
      for (let i = allocations.length - 1; i >= 0; i -= 1) {
        if (remove.has(allocations[i].id)) {
          allocations.splice(i, 1);
        }
      }
    },
    async deleteTradesIfUnused(bookId: string, tradeIds: string[]) {
      const unused = new Set(tradeIds);
      for (const row of allocations) {
        unused.delete(row.tradeId);
      }
      for (let i = trades.length - 1; i >= 0; i -= 1) {
        if (trades[i].bookId === bookId && unused.has(trades[i].id)) {
          trades.splice(i, 1);
        }
      }
    },
    async deleteCashFlows(bookId: string, ids: string[]) {
      const remove = new Set(ids);
      for (let i = cashFlows.length - 1; i >= 0; i -= 1) {
        if (cashFlows[i].bookId === bookId && remove.has(cashFlows[i].id)) {
          cashFlows.splice(i, 1);
        }
      }
    },
  };
}
