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

/**
 * libsql 0.15.15 `Sqlite3Client` keeps one live handle in `#db`.
 * `transaction()` runs `BEGIN IMMEDIATE` on that handle and only then
 * sets `#db = null` so the next `#getDb()` opens another connection.
 * A failed BEGIN leaves `#db` pointing at the same handle and does not
 * ROLLBACK. The 6b2f451 wrapper gated work with a shared `prepare`
 * promise (not a mutex), so a plain UPDATE could run on that handle
 * between BEGIN and `#db = null` (or after a busy BEGIN) and later be
 * rolled back by pack-lock / ledger-tx — success in JS, nothing committed.
 *
 * All client-level execute/batch/transaction/reconnect calls are
 * serialised, and the mutex stays held until that transaction COMMITs
 * or ROLLBACKs. BEGIN errors always ROLLBACK that same handle before
 * reuse. Post-transaction PRAGMAs run on the new handle while the
 * mutex is held.
 */
function serializeSqliteClient(client: Client) {
  const execute = client.execute.bind(client);
  const batch = client.batch?.bind(client);
  const transaction = client.transaction.bind(client);
  const reconnect = client.reconnect?.bind(client);

  let tail: Promise<unknown> = Promise.resolve();
  function enqueue<T>(fn: () => Promise<T>): Promise<T> {
    const run = tail.then(fn, fn);
    tail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  tail = applySqliteConnectionPragmas(execute);

  client.execute = ((stmt: Parameters<Client["execute"]>[0], args?: Parameters<Client["execute"]>[1]) =>
    enqueue(() => execute(stmt, args))) as Client["execute"];
  if (batch) {
    client.batch = ((stmts: Parameters<Client["batch"]>[0], mode?: Parameters<Client["batch"]>[1]) =>
      enqueue(() => batch(stmts, mode))) as Client["batch"];
  }
  client.transaction = ((...args: unknown[]) => {
    let released = false;
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = () => {
        if (released) {
          return;
        }
        released = true;
        resolve();
      };
    });
    const run = async () => {
      try {
        const tx = await (transaction as (...inner: unknown[]) => ReturnType<Client["transaction"]>)(...args);
        try {
          await applySqliteConnectionPragmas(execute);
        } catch (error) {
          try {
            await tx.rollback();
          } catch {
            // already closed
          }
          throw error;
        }
        const commit = tx.commit.bind(tx);
        const rollback = tx.rollback.bind(tx);
        const finish = async (op: () => ReturnType<typeof commit>) => {
          try {
            return await op();
          } finally {
            release();
          }
        };
        tx.commit = () => finish(commit);
        tx.rollback = () => finish(rollback);
        const close = tx.close?.bind(tx);
        if (close) {
          tx.close = () => {
            try {
              return close();
            } finally {
              release();
            }
          };
        }
        return tx;
      } catch (error) {
        try {
          await execute("ROLLBACK");
        } catch {
          // not in a transaction
        }
        release();
        throw error;
      }
    };
    const started = tail.then(run, run);
    tail = started.then(
      () => held,
      () => held,
    );
    return started;
  }) as Client["transaction"];
  if (reconnect) {
    client.reconnect = (() =>
      enqueue(async () => {
        await reconnect();
        await applySqliteConnectionPragmas(execute);
      })) as Client["reconnect"];
  }
}

function getSqliteClient() {
  const url = getDatabaseUrl();
  if (globalForDb.sqlite && globalForDb.sqliteUrl === url) {
    return globalForDb.sqlite;
  }
  globalForDb.sqlite?.close();
  ensureSqliteDir(url);
  const client = createClient({ url });
  serializeSqliteClient(client);
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
