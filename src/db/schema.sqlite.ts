import {
  integer,
  primaryKey,
  sqliteTable,
  text,
  unique,
} from "drizzle-orm/sqlite-core";

/** 金額用 text 存小數，唔用 real／JS float。 */
const money = (name: string) => text(name);

const id = () => text("id").$defaultFn(() => crypto.randomUUID()).primaryKey();

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .$defaultFn(() => new Date())
    .notNull();

export const users = sqliteTable("users", {
  id: id(),
  displayName: text("display_name").notNull().unique(),
  email: text("email").unique(),
  passwordHash: text("password_hash"),
  createdAt: createdAt(),
});

export const sessions = sqliteTable("sessions", {
  id: id(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export const books = sqliteTable("books", {
  id: id(),
  name: text("name").notNull(),
  tradeCurrency: text("trade_currency").notNull().default("USD"),
  depositCurrency: text("deposit_currency").notNull().default("HKD"),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: createdAt(),
});

export const members = sqliteTable("members", {
  id: id(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  userId: text("user_id").references(() => users.id),
  displayName: text("display_name").notNull(),
  email: text("email"),
  /** argon2id of a single-use invite secret. Never store plaintext. */
  inviteSecretHash: text("invite_secret_hash"),
  inviteExpiresAt: integer("invite_expires_at", { mode: "timestamp_ms" }),
  createdAt: createdAt(),
});

export const ledgerAccounts = sqliteTable("ledger_accounts", {
  id: id(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  memberId: text("member_id").references(() => members.id),
  kind: text("kind").notNull(),
  name: text("name").notNull(),
  createdAt: createdAt(),
});

export const allocationSchedules = sqliteTable("allocation_schedules", {
  id: id(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  effectiveOn: text("effective_on").notNull(),
  createdAt: createdAt(),
});

export const allocationLegs = sqliteTable("allocation_legs", {
  id: id(),
  scheduleId: text("schedule_id")
    .notNull()
    .references(() => allocationSchedules.id),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  percent: money("percent").notNull(),
});

export const cashFlows = sqliteTable("cash_flows", {
  id: id(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  ledgerAccountId: text("ledger_account_id")
    .notNull()
    .references(() => ledgerAccounts.id),
  kind: text("kind").notNull(),
  amountHkd: money("amount_hkd").notNull(),
  fxRate: money("fx_rate").notNull(),
  amountUsd: money("amount_usd").notNull(),
  occurredOn: text("occurred_on").notNull(),
  createdAt: createdAt(),
});

export const trades = sqliteTable("trades", {
  id: id(),
  bookId: text("book_id")
    .notNull()
    .references(() => books.id),
  ledgerAccountId: text("ledger_account_id")
    .notNull()
    .references(() => ledgerAccounts.id),
  symbol: text("symbol").notNull(),
  side: text("side").notNull(),
  quantity: money("quantity").notNull(),
  price: money("price").notNull(),
  feeUsd: money("fee_usd").notNull().default("0"),
  occurredOn: text("occurred_on").notNull(),
  note: text("note"),
  createdAt: createdAt(),
});

export const tradeAllocations = sqliteTable("trade_allocations", {
  id: id(),
  tradeId: text("trade_id")
    .notNull()
    .references(() => trades.id),
  memberId: text("member_id")
    .notNull()
    .references(() => members.id),
  quantity: money("quantity").notNull(),
  costUsd: money("cost_usd").notNull().default("0"),
  proceedsUsd: money("proceeds_usd").notNull().default("0"),
});

export const instruments = sqliteTable("instruments", {
  id: id(),
  displayCode: text("display_code").notNull().unique(),
  displayName: text("display_name"),
  assetClass: text("asset_class").notNull(),
  market: text("market").notNull(),
  tdSymbol: text("td_symbol").notNull(),
  tdExchange: text("td_exchange"),
  isEtfProxy: integer("is_etf_proxy", { mode: "boolean" }).notNull().default(false),
  tapeSlot: integer("tape_slot"),
  planHint: integer("plan_hint", { mode: "boolean" }).notNull().default(false),
});

export const quotes = sqliteTable("quotes", {
  instrumentId: text("instrument_id")
    .primaryKey()
    .references(() => instruments.id),
  last: money("last"),
  percentChange: money("percent_change"),
  previousClose: money("previous_close"),
  quotedAt: integer("quoted_at", { mode: "timestamp_ms" }),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  delaySeconds: integer("delay_seconds").notNull().default(900),
  status: text("status").notNull(),
  source: text("source").notNull().default("twelve_data"),
});

export const quoteRefreshState = sqliteTable("quote_refresh_state", {
  id: text("id").primaryKey(),
  lastPackAt: integer("last_pack_at", { mode: "timestamp_ms" }),
  rateLimitedUntil: integer("rate_limited_until", { mode: "timestamp_ms" }),
  creditUtcDate: text("credit_utc_date"),
  creditsUsed: integer("credits_used").notNull().default(0),
});

/** Daily OHLCV last-good. Key = (td_symbol, exchange, date). */
export const ohlcvBars = sqliteTable(
  "ohlcv_bars",
  {
    tdSymbol: text("td_symbol").notNull(),
    tdExchange: text("td_exchange").notNull().default(""),
    barDate: text("bar_date").notNull(),
    open: money("open").notNull(),
    high: money("high").notNull(),
    low: money("low").notNull(),
    close: money("close").notNull(),
    volume: money("volume").notNull(),
    fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.tdSymbol, table.tdExchange, table.barDate] })],
);

export const importBatches = sqliteTable("import_batches", {
  id: id(),
  bookId: text("book_id").references(() => books.id),
  createdByUserId: text("created_by_user_id")
    .notNull()
    .references(() => users.id),
  filename: text("filename").notNull(),
  fileHash: text("file_hash").notNull(),
  createdAt: createdAt(),
  cashFlowCount: integer("cash_flow_count").notNull().default(0),
  tradeCount: integer("trade_count").notNull().default(0),
  warningCount: integer("warning_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  status: text("status").notNull(),
  mode: text("mode").notNull().default("initial"),
  plan: text("plan", { mode: "json" }),
  rowLog: text("row_log", { mode: "json" }),
});

export const watchItems = sqliteTable(
  "watch_items",
  {
    id: id(),
    bookId: text("book_id")
      .notNull()
      .references(() => books.id),
    displayCode: text("display_code").notNull(),
    muted: integer("muted", { mode: "boolean" }).notNull().default(false),
    createdAt: createdAt(),
  },
  (table) => [unique("watch_items_book_code").on(table.bookId, table.displayCode)],
);

/** News last-good (Finnhub or Google News RSS). Key = symbol:AAPL, rss:symbol:AAPL, or category:general. Never stores quotes. */
export const newsCache = sqliteTable("news_cache", {
  cacheKey: text("cache_key").primaryKey(),
  payload: text("payload", { mode: "json" }).notNull(),
  fetchedAt: integer("fetched_at", { mode: "timestamp_ms" }).notNull(),
  status: text("status").notNull(),
});

/** One upstream /time_series attempt per (td_symbol, exchange) per UTC calendar day. */
export const ohlcvFetchState = sqliteTable(
  "ohlcv_fetch_state",
  {
    tdSymbol: text("td_symbol").notNull(),
    tdExchange: text("td_exchange").notNull().default(""),
    lastFetchUtcDate: text("last_fetch_utc_date"),
    lastStatus: text("last_status").notNull(),
    lastAttemptAt: integer("last_attempt_at", { mode: "timestamp_ms" }),
  },
  (table) => [primaryKey({ columns: [table.tdSymbol, table.tdExchange] })],
);
