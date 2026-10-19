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

export type AllocationScheduleView = AllocationSchedule & { legs: AllocationLeg[] };

export type ClearBookEntriesOptions = {
  /** Keep allocation schedules/legs while clearing trades and cash. */
  preserveSchedules?: boolean;
};

export type LedgerStore = {
  insertBook(input: NewBook): Promise<Book>;
  insertMember(input: NewMember): Promise<Member>;
  insertLedgerAccount(input: NewLedgerAccount): Promise<LedgerAccount>;
  insertCashFlow(input: NewCashFlow): Promise<CashFlow>;
  insertTrade(input: NewTrade): Promise<Trade>;
  insertTradeAllocation(input: NewTradeAllocation): Promise<TradeAllocation>;
  insertAllocationSchedule(input: NewAllocationSchedule): Promise<AllocationSchedule>;
  insertAllocationLeg(input: NewAllocationLeg): Promise<AllocationLeg>;
  listCashFlows(bookId: string): Promise<CashFlow[]>;
  listTrades(bookId: string): Promise<Trade[]>;
  listTradeAllocations(bookId: string): Promise<TradeAllocation[]>;
  listAllocationSchedules(bookId: string): Promise<AllocationScheduleView[]>;
  listMembers(bookId: string): Promise<Member[]>;
  listLedgerAccounts(bookId: string): Promise<LedgerAccount[]>;
  getLedgerAccount(id: string): Promise<LedgerAccount | null>;
  clearBookEntries(bookId: string, options?: ClearBookEntriesOptions): Promise<void>;
  /**
   * Drop an unclaimed member and their personal account. No-op if the member
   * is claimed (userId set) or still has cash, allocations, or schedule legs.
   */
  removeUnclaimedMember(bookId: string, memberId: string): Promise<void>;
  deleteAllocations(ids: string[]): Promise<void>;
  deleteTradesIfUnused(bookId: string, tradeIds: string[]): Promise<void>;
  deleteCashFlows(bookId: string, ids: string[]): Promise<void>;
  /** Snapshot for in-memory atomic import. Drizzle is a no-op; wrap those writes in a transaction. */
  checkpoint(): unknown;
  restore(snapshot: unknown): void;
};
