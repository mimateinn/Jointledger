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
  all: (query: unknown) => unknown;
  run: (query: unknown) => unknown;
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
function withSqliteExecute(db: object): PgDatabase {
  if (sqlitePatched.has(db)) {
    return db as unknown as PgDatabase;
  }
  sqlitePatched.add(db);

  const sqlite = db as SqliteLike;
  if (typeof sqlite.transaction !== "function") {
    throw new Error("SQLite db.transaction is undefined");
  }

  sqlite.execute = async (query: unknown) => {
    try {
      return await sqlite.all(query);
    } catch {
      await sqlite.run(query);
      return [];
    }
  };

  const transaction = sqlite.transaction.bind(sqlite);
  sqlite.transaction = (fn, config) =>
    transaction((tx) => fn(withSqliteExecute(tx as object) as unknown as SqliteLike), config);

  return sqlite as unknown as PgDatabase;
}

export const SQLITE_BUSY_TIMEOUT_MS = 5000;

async function applySqliteConnectionPragmas(execute: Client["execute"]) {
  await execute("PRAGMA journal_mode = WAL");
  await execute("PRAGMA foreign_keys = ON");
  await execute(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
}

function getSqliteClient() {
  const url = getDatabaseUrl();
  if (globalForDb.sqlite && globalForDb.sqliteUrl === url) {
    return globalForDb.sqlite;
  }
  globalForDb.sqlite?.close();
  ensureSqliteDir(url);
  const client = createClient({ url });
  const execute = client.execute.bind(client);
  const batch = client.batch?.bind(client);
  const transaction = client.transaction.bind(client);
  const reconnect = client.reconnect?.bind(client);

  // libsql 0.15 nulls the underlying connection after transaction() and
  // lazily opens a new one without the previous PRAGMAs. Re-apply on every
  // new connection, including the one created after transaction()/reconnect().
  let prepare = applySqliteConnectionPragmas(execute);

  client.execute = ((stmt: Parameters<Client["execute"]>[0], args?: Parameters<Client["execute"]>[1]) =>
    prepare.then(() => execute(stmt, args))) as Client["execute"];
  if (batch) {
    client.batch = ((stmts: Parameters<Client["batch"]>[0], mode?: Parameters<Client["batch"]>[1]) =>
      prepare.then(() => batch(stmts, mode))) as Client["batch"];
  }
  client.transaction = (async (...args: unknown[]) => {
    await prepare;
    const tx = await (transaction as (...inner: unknown[]) => ReturnType<Client["transaction"]>)(...args);
    prepare = applySqliteConnectionPragmas(execute);
    return tx;
  }) as Client["transaction"];
  if (reconnect) {
    client.reconnect = (async () => {
      await reconnect();
      prepare = applySqliteConnectionPragmas(execute);
      await prepare;
    }) as Client["reconnect"];
  }

  globalForDb.sqlite = client;
  globalForDb.sqliteUrl = url;
  return client;
}

export async function reconnectSqliteClient() {
  const client = getSqliteClient();
  await client.reconnect();
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
