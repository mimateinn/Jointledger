import type { LedgerStore } from "./store";
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
} {
  const books: Book[] = [];
  const members: Member[] = [];
  const accounts: LedgerAccount[] = [];
  const cashFlows: CashFlow[] = [];
  const trades: Trade[] = [];
  const allocations: TradeAllocation[] = [];

  return {
    books,
    members,
    accounts,
    cashFlows,
    trades,
    allocations,
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
  };
}
