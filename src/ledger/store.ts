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

export type LedgerStore = {
  insertBook(input: NewBook): Promise<Book>;
  insertMember(input: NewMember): Promise<Member>;
  insertLedgerAccount(input: NewLedgerAccount): Promise<LedgerAccount>;
  insertCashFlow(input: NewCashFlow): Promise<CashFlow>;
  insertTrade(input: NewTrade): Promise<Trade>;
  insertTradeAllocation(input: NewTradeAllocation): Promise<TradeAllocation>;
  listCashFlows(bookId: string): Promise<CashFlow[]>;
  listTrades(bookId: string): Promise<Trade[]>;
  listTradeAllocations(bookId: string): Promise<TradeAllocation[]>;
  getLedgerAccount(id: string): Promise<LedgerAccount | null>;
};
