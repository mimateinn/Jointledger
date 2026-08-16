export type AccountKind = "personal" | "joint";
export type CashFlowKind = "deposit" | "withdrawal";
export type TradeSide = "buy" | "sell";

export type Book = {
  id: string;
  name: string;
  tradeCurrency: string;
  depositCurrency: string;
  createdByUserId: string;
};

export type Member = {
  id: string;
  bookId: string;
  userId: string | null;
  displayName: string;
  email: string | null;
};

export type LedgerAccount = {
  id: string;
  bookId: string;
  memberId: string | null;
  kind: AccountKind;
  name: string;
};

export type CashFlow = {
  id: string;
  bookId: string;
  memberId: string;
  ledgerAccountId: string;
  kind: CashFlowKind;
  amountHkd: string;
  fxRate: string;
  amountUsd: string;
  occurredOn: string;
};

export type Trade = {
  id: string;
  bookId: string;
  ledgerAccountId: string;
  symbol: string;
  side: TradeSide;
  quantity: string;
  price: string;
  feeUsd: string;
  occurredOn: string;
  note: string | null;
};

export type TradeAllocation = {
  id: string;
  tradeId: string;
  memberId: string;
  quantity: string;
  costUsd: string;
  proceedsUsd: string;
};

export type NewBook = {
  name: string;
  tradeCurrency: string;
  depositCurrency: string;
  createdByUserId: string;
};

export type NewMember = {
  bookId: string;
  userId: string | null;
  displayName: string;
  email: string | null;
};

export type NewLedgerAccount = {
  bookId: string;
  memberId: string | null;
  kind: AccountKind;
  name: string;
};

export type NewCashFlow = {
  bookId: string;
  memberId: string;
  ledgerAccountId: string;
  kind: CashFlowKind;
  amountHkd: string;
  fxRate: string;
  amountUsd: string;
  occurredOn: string;
};

export type NewTrade = {
  bookId: string;
  ledgerAccountId: string;
  symbol: string;
  side: TradeSide;
  quantity: string;
  price: string;
  feeUsd: string;
  occurredOn: string;
  note: string | null;
};

export type NewTradeAllocation = {
  tradeId: string;
  memberId: string;
  quantity: string;
  costUsd: string;
  proceedsUsd: string;
};

export type CreateBookInput = {
  name: string;
  createdByUserId: string;
  creatorDisplayName: string;
  creatorEmail?: string | null;
  tradeCurrency?: string;
  depositCurrency?: string;
};

export type AddMemberInput = {
  bookId: string;
  displayName: string;
  email?: string | null;
  userId?: string | null;
};

export type CreateCashFlowInput = {
  bookId: string;
  memberId: string;
  ledgerAccountId: string;
  kind?: CashFlowKind;
  amountHkd: string;
  fxRate: string;
  occurredOn: string;
};

export type CreateTradeInput = {
  bookId: string;
  ledgerAccountId: string;
  memberId: string;
  symbol: string;
  quantity: string;
  price: string;
  occurredOn: string;
  note?: string | null;
  side?: TradeSide;
};
