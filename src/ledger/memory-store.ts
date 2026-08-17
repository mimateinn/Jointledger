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
    async clearBookEntries(bookId: string) {
      const tradeIds = new Set(trades.filter((row) => row.bookId === bookId).map((row) => row.id));
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
    },
  };
}
