import { AsyncLocalStorage } from "node:async_hooks";
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

type SqliteTxScope = { id: symbol };

const sqliteTxContext = new AsyncLocalStorage<SqliteTxScope>();
let activeSqliteTxId: symbol | null = null;

export const SQLITE_TX_EXECUTE_ERROR =
  "getDb() execute inside an open SQLite transaction is not supported";
export const SQLITE_TX_TIMEOUT_ERROR = "SQLite transaction exceeded the maximum duration";
export const SQLITE_TX_MAX_MS = 15_000;

let sqliteTxMaxMs = SQLITE_TX_MAX_MS;

export function setSqliteTxMaxMs(ms: number = SQLITE_TX_MAX_MS) {
  sqliteTxMaxMs = ms;
}

function isInActiveSqliteTx(): boolean {
  const store = sqliteTxContext.getStore();
  return Boolean(store && activeSqliteTxId === store.id);
}

/** libsql 無 pg 嘅 execute；transaction 一定要 bind 返 Drizzle instance（要有 session）。 */
function withSqliteExecute(db: object, role: "root" | "tx" = "root"): PgDatabase {
  if (sqlitePatched.has(db)) {
    return db as unknown as PgDatabase;
  }
  sqlitePatched.add(db);

  const sqlite = db as SqliteLike;
  if (typeof sqlite.transaction !== "function") {
    throw new Error("SQLite db.transaction is undefined");
  }

  const all = sqlite.all.bind(sqlite);
  const run = sqlite.run.bind(sqlite);
  function rejectRootExecuteInTx() {
    if (role === "root" && isInActiveSqliteTx()) {
      throw new Error(SQLITE_TX_EXECUTE_ERROR);
    }
  }
  sqlite.all = (query) => {
    rejectRootExecuteInTx();
    return all(query);
  };
  sqlite.run = (query) => {
    rejectRootExecuteInTx();
    return run(query);
  };
  sqlite.execute = async (query: unknown) => {
    rejectRootExecuteInTx();
    try {
      return await all(query);
    } catch {
      await run(query);
      return [];
    }
  };

  const transaction = sqlite.transaction.bind(sqlite);
  sqlite.transaction = (fn, config) => {
    if (isInActiveSqliteTx()) {
      return Promise.reject(new Error("nested SQLite transaction is not supported"));
    }
    return transaction((tx) => {
      const id = Symbol("sqlite-tx");
      activeSqliteTxId = id;
      let timeoutId: ReturnType<typeof setTimeout> | undefined;
      const timeout = new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error(SQLITE_TX_TIMEOUT_ERROR));
        }, sqliteTxMaxMs);
      });
      const work = sqliteTxContext.run({ id }, () =>
        Promise.resolve(fn(withSqliteExecute(tx as object, "tx") as unknown as SqliteLike)),
      );
      return Promise.race([work, timeout]).finally(() => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        if (activeSqliteTxId === id) {
          activeSqliteTxId = null;
        }
      });
    }, config);
  };

  return sqlite as unknown as PgDatabase;
}

export const SQLITE_BUSY_TIMEOUT_MS = 5000;

async function applySqliteConnectionPragmas(execute: Client["execute"]) {
  await execute("PRAGMA journal_mode = WAL");
  await execute("PRAGMA foreign_keys = ON");
  await execute(`PRAGMA busy_timeout = ${SQLITE_BUSY_TIMEOUT_MS}`);
}

/**
 * After SQLITE_BUSY / SQLITE_LOCKED, libsql native 0.5.29 (under
 * @libsql/client 0.15.15) does not reset the failed statement. That
 * statement stays active on the handle: later writes return ok but
 * never commit, and they keep the write lock. A later COMMIT then
 * gets BUSY and rolls back. ROLLBACK after a failed BEGIN is dead
 * (inTx is already false). Discard the handle (reconnect + PRAGMAs)
 * on any execute/batch/BEGIN/COMMIT error before reuse.
 *
 * Concurrent (non-nested) transactions and plain executes wait on this
 * queue from BEGIN until COMMIT/ROLLBACK. True re-entrant nesting is
 * detected with AsyncLocalStorage on drizzle db.transaction and throws.
 * Do not run network or other slow async work inside a tx callback.
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

  async function discardHandle() {
    if (!reconnect) {
      return;
    }
    await reconnect();
    await applySqliteConnectionPragmas(execute);
  }

  async function runOrDiscard<T>(work: () => Promise<T>): Promise<T> {
    try {
      return await work();
    } catch (error) {
      try {
        await discardHandle();
      } catch {
        // still surface the original error
      }
      throw error;
    }
  }

  tail = applySqliteConnectionPragmas(execute);

  function rejectForeignTxCall() {
    if (isInActiveSqliteTx()) {
      throw new Error(SQLITE_TX_EXECUTE_ERROR);
    }
  }

  client.execute = ((stmt: Parameters<Client["execute"]>[0], args?: Parameters<Client["execute"]>[1]) => {
    rejectForeignTxCall();
    return enqueue(() => runOrDiscard(() => execute(stmt, args)));
  }) as Client["execute"];
  if (batch) {
    client.batch = ((stmts: Parameters<Client["batch"]>[0], mode?: Parameters<Client["batch"]>[1]) => {
      rejectForeignTxCall();
      return enqueue(() => runOrDiscard(() => batch(stmts, mode)));
    }) as Client["batch"];
  }
  client.transaction = ((...args: unknown[]) => {
    rejectForeignTxCall();
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
        const tx = await runOrDiscard(() =>
          (transaction as (...inner: unknown[]) => ReturnType<Client["transaction"]>)(...args),
        );
        try {
          await applySqliteConnectionPragmas(execute);
        } catch (error) {
          try {
            await tx.rollback();
          } catch {
            // already closed
          }
          try {
            await discardHandle();
          } catch {
            // still surface the original error
          }
          throw error;
        }
        const commit = tx.commit.bind(tx);
        const rollback = tx.rollback.bind(tx);
        const closeTx = (tx as { close?: () => void }).close?.bind(tx);
        let settled = false;
        let commitError: unknown;
        const watchdog = setTimeout(() => {
          void finish(rollback, "rollback").catch(() => undefined);
        }, sqliteTxMaxMs);
        const finish = async (op: () => ReturnType<typeof commit>, kind: "commit" | "rollback") => {
          if (settled && kind === "rollback") {
            if (commitError) {
              throw commitError;
            }
            return undefined as Awaited<ReturnType<typeof commit>>;
          }
          try {
            return await op();
          } catch (error) {
            if (kind === "commit") {
              commitError = error;
            }
            try {
              closeTx?.();
            } catch {
              // tx handle already closed
            }
            try {
              await discardHandle();
            } catch {
              // still surface the original error
            }
            throw kind === "rollback" && commitError ? commitError : error;
          } finally {
            settled = true;
            clearTimeout(watchdog);
            release();
          }
        };
        tx.commit = () => finish(commit, "commit");
        tx.rollback = () => finish(rollback, "rollback");
        if (closeTx) {
          (tx as { close: () => void }).close = () => {
            try {
              return closeTx();
            } finally {
              settled = true;
              clearTimeout(watchdog);
              release();
            }
          };
        }
        return tx;
      } catch (error) {
        try {
          await discardHandle();
        } catch {
          // still surface the original error
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

export function getSqliteClient() {
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
  activeSqliteTxId = null;
  setSqliteTxMaxMs();
}

export type Database = PgDatabase;
