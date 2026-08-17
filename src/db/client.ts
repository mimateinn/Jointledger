import { createClient, type Client } from "@libsql/client";
import { drizzle as drizzleSqlite } from "drizzle-orm/libsql";
import { drizzle as drizzlePg } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import {
  ensureSqliteDir,
  getDatabaseUrl,
  isPostgresUrl,
} from "./dialect";
import * as pgSchema from "./schema";
import * as sqliteSchema from "./schema.sqlite";

function createPgDb() {
  return drizzlePg(getSql(), { schema: pgSchema });
}

type PgDatabase = ReturnType<typeof createPgDb>;

type SqliteLike = {
  all: (query: unknown) => Promise<unknown>;
  run: (query: unknown) => Promise<unknown>;
  execute?: (query: unknown) => Promise<unknown>;
  transaction: (
    fn: (tx: SqliteLike) => unknown,
    config?: unknown,
  ) => Promise<unknown>;
};

const globalForDb = globalThis as unknown as {
  sql?: ReturnType<typeof postgres>;
  sqlite?: Client;
  sqliteUrl?: string;
};

export function getSql() {
  const url = getDatabaseUrl();
  if (!isPostgresUrl(url)) {
    throw new Error("getSql() 只用於 Postgres");
  }
  if (!globalForDb.sql) {
    globalForDb.sql = postgres(url, { max: 10 });
  }
  return globalForDb.sql;
}

const sqlitePatched = new WeakSet<object>();

/** libsql 無 pg 嘅 execute；transaction 一定要 bind 返 Drizzle instance（要有 session）。 */
function withSqliteExecute(db: SqliteLike): PgDatabase {
  if (sqlitePatched.has(db)) {
    return db as unknown as PgDatabase;
  }
  sqlitePatched.add(db);

  if (typeof db.transaction !== "function") {
    throw new Error("SQLite db.transaction is undefined");
  }

  db.execute = async (query: unknown) => {
    try {
      return await db.all(query);
    } catch {
      await db.run(query);
      return [];
    }
  };

  const transaction = db.transaction.bind(db);
  db.transaction = (fn, config) =>
    transaction((tx) => fn(withSqliteExecute(tx) as unknown as SqliteLike), config);

  return db as unknown as PgDatabase;
}

function getSqliteClient() {
  const url = getDatabaseUrl();
  if (globalForDb.sqlite && globalForDb.sqliteUrl === url) {
    return globalForDb.sqlite;
  }
  globalForDb.sqlite?.close();
  ensureSqliteDir(url);
  const client = createClient({ url });
  void client.execute("PRAGMA foreign_keys = ON");
  globalForDb.sqlite = client;
  globalForDb.sqliteUrl = url;
  return client;
}

export function getDb(): PgDatabase {
  const url = getDatabaseUrl();
  if (isPostgresUrl(url)) {
    return createPgDb();
  }
  return withSqliteExecute(drizzleSqlite(getSqliteClient(), { schema: sqliteSchema }));
}

export function resetDbClients() {
  void globalForDb.sql?.end({ timeout: 0 });
  globalForDb.sql = undefined;
  globalForDb.sqlite?.close();
  globalForDb.sqlite = undefined;
  globalForDb.sqliteUrl = undefined;
}

export type Database = PgDatabase;
