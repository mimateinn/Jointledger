import {
  boolean,
  date,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

const money = (name: string) => numeric(name, { precision: 20, scale: 8 });

export const users = pgTable("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayName: text("display_name").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = pgTable("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const books = pgTable("books", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  tradeCurrency: text("trade_currency").notNull().default("USD"),
  depositCurrency: text("deposit_currency").notNull().default("HKD"),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const members = pgTable("members", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id),
  userId: uuid("user_id").references(() => users.id),
  displayName: text("display_name").notNull(),
  email: text("email"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const ledgerAccounts = pgTable("ledger_accounts", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id),
  memberId: uuid("member_id").references(() => members.id),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const allocationSchedules = pgTable("allocation_schedules", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id),
  effectiveOn: date("effective_on").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const allocationLegs = pgTable("allocation_legs", {
  id: uuid("id").defaultRandom().primaryKey(),
  scheduleId: uuid("schedule_id")
    .notNull()
    .references(() => allocationSchedules.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  percent: money("percent").notNull(),
});

export const cashFlows = pgTable("cash_flows", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  ledgerAccountId: uuid("ledger_account_id")
    .notNull()
    .references(() => ledgerAccounts.id),
  kind: text("kind").notNull(),
  amountHkd: money("amount_hkd").notNull(),
  fxRate: money("fx_rate").notNull(),
  amountUsd: money("amount_usd").notNull(),
  occurredOn: date("occurred_on").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const trades = pgTable("trades", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id")
    .notNull()
    .references(() => books.id),
  ledgerAccountId: uuid("ledger_account_id")
    .notNull()
    .references(() => ledgerAccounts.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  quantity: money("quantity").notNull(),
  price: money("price").notNull(),
  feeUsd: money("fee_usd").notNull().default("0"),
  occurredOn: date("occurred_on").notNull(),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const tradeAllocations = pgTable("trade_allocations", {
  id: uuid("id").defaultRandom().primaryKey(),
  tradeId: uuid("trade_id")
    .notNull()
    .references(() => trades.id),
  memberId: uuid("member_id")
    .notNull()
    .references(() => members.id),
  quantity: money("quantity").notNull(),
  costUsd: money("cost_usd").notNull().default("0"),
  proceedsUsd: money("proceeds_usd").notNull().default("0"),
});

export const instruments = pgTable("instruments", {
  id: uuid("id").defaultRandom().primaryKey(),
  displayCode: text("display_code").notNull().unique(),
  displayName: text("display_name"),
  assetClass: text("asset_class").notNull(),
  market: text("market").notNull(),
  tdSymbol: text("td_symbol").notNull(),
  tdExchange: text("td_exchange"),
  isEtfProxy: boolean("is_etf_proxy").notNull().default(false),
  tapeSlot: integer("tape_slot"),
  planHint: boolean("plan_hint").notNull().default(false),
});

export const quotes = pgTable("quotes", {
  instrumentId: uuid("instrument_id")
    .primaryKey()
    .references(() => instruments.id),
  last: money("last"),
  percentChange: money("percent_change"),
  previousClose: money("previous_close"),
  quotedAt: timestamp("quoted_at", { withTimezone: true }),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  delaySeconds: integer("delay_seconds").notNull().default(900),
  status: text("status").notNull(),
  source: text("source").notNull().default("twelve_data"),
});

export const quoteRefreshState = pgTable("quote_refresh_state", {
  id: text("id").primaryKey(),
  lastPackAt: timestamp("last_pack_at", { withTimezone: true }),
  rateLimitedUntil: timestamp("rate_limited_until", { withTimezone: true }),
  creditUtcDate: text("credit_utc_date"),
  creditsUsed: integer("credits_used").notNull().default(0),
});

/** Daily OHLCV last-good. Key = (td_symbol, exchange, date). */
export const ohlcvBars = pgTable(
  "ohlcv_bars",
  {
    tdSymbol: text("td_symbol").notNull(),
    tdExchange: text("td_exchange").notNull().default(""),
    barDate: date("bar_date").notNull(),
    open: money("open").notNull(),
    high: money("high").notNull(),
    low: money("low").notNull(),
    close: money("close").notNull(),
    volume: money("volume").notNull(),
    fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.tdSymbol, table.tdExchange, table.barDate] })],
);

export const importBatches = pgTable("import_batches", {
  id: uuid("id").defaultRandom().primaryKey(),
  bookId: uuid("book_id").references(() => books.id),
  createdByUserId: uuid("created_by_user_id")
    .notNull()
    .references(() => users.id),
  filename: text("filename").notNull(),
  fileHash: text("file_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  cashFlowCount: integer("cash_flow_count").notNull().default(0),
  tradeCount: integer("trade_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  status: text("status").notNull(),
  mode: text("mode").notNull().default("initial"),
  plan: jsonb("plan"),
  rowLog: jsonb("row_log"),
});

export const watchItems = pgTable(
  "watch_items",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    bookId: uuid("book_id")
      .notNull()
      .references(() => books.id),
    displayCode: text("display_code").notNull(),
    muted: boolean("muted").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [unique("watch_items_book_code").on(table.bookId, table.displayCode)],
);

/** Finnhub news last-good. Key = symbol:AAPL or category:general. Never stores quotes. */
export const newsCache = pgTable("news_cache", {
  cacheKey: text("cache_key").primaryKey(),
  payload: jsonb("payload").notNull(),
  fetchedAt: timestamp("fetched_at", { withTimezone: true }).notNull(),
  status: text("status").notNull(),
});

/** One upstream /time_series attempt per (td_symbol, exchange) per UTC calendar day. */
export const ohlcvFetchState = pgTable(
  "ohlcv_fetch_state",
  {
    tdSymbol: text("td_symbol").notNull(),
    tdExchange: text("td_exchange").notNull().default(""),
    lastFetchUtcDate: text("last_fetch_utc_date"),
    lastStatus: text("last_status").notNull(),
    lastAttemptAt: timestamp("last_attempt_at", { withTimezone: true }),
  },
  (table) => [primaryKey({ columns: [table.tdSymbol, table.tdExchange] })],
);
