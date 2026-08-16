import { date, numeric, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

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
