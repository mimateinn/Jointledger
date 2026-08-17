import { isPostgresUrl } from "./dialect";
import * as pg from "./schema";
import * as sqlite from "./schema.sqlite";

const active = isPostgresUrl(process.env.DATABASE_URL ?? "") ? pg : sqlite;

export const users = active.users as typeof pg.users;
export const sessions = active.sessions as typeof pg.sessions;
export const books = active.books as typeof pg.books;
export const members = active.members as typeof pg.members;
export const ledgerAccounts = active.ledgerAccounts as typeof pg.ledgerAccounts;
export const allocationSchedules = active.allocationSchedules as typeof pg.allocationSchedules;
export const allocationLegs = active.allocationLegs as typeof pg.allocationLegs;
export const cashFlows = active.cashFlows as typeof pg.cashFlows;
export const trades = active.trades as typeof pg.trades;
export const tradeAllocations = active.tradeAllocations as typeof pg.tradeAllocations;
export const instruments = active.instruments as typeof pg.instruments;
export const quotes = active.quotes as typeof pg.quotes;
export const quoteRefreshState = active.quoteRefreshState as typeof pg.quoteRefreshState;
export const ohlcvBars = active.ohlcvBars as typeof pg.ohlcvBars;
export const importBatches = active.importBatches as typeof pg.importBatches;
export const watchItems = active.watchItems as typeof pg.watchItems;
export const newsCache = active.newsCache as typeof pg.newsCache;
export const ohlcvFetchState = active.ohlcvFetchState as typeof pg.ohlcvFetchState;
