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

function withSqliteExecute(db: object): PgDatabase {
  return new Proxy(db, {
    get(target, prop, receiver) {
      const source = target as Record<PropertyKey, unknown>;
      if (prop === "execute" && typeof source.execute !== "function") {
        return async (query: unknown) => {
          const all = source.all as (q: unknown) => Promise<unknown>;
          const run = source.run as (q: unknown) => Promise<unknown>;
          try {
            return await all(query);
          } catch {
            await run(query);
            return [];
          }
        };
      }
      if (prop === "transaction") {
        const transaction = source.transaction as (
          fn: (tx: object) => unknown,
        ) => Promise<unknown>;
        return (fn: (tx: PgDatabase) => unknown) =>
          transaction((tx) => fn(withSqliteExecute(tx)));
      }
      const value = Reflect.get(target, prop, receiver);
      if (typeof value === "function") {
        return (...args: unknown[]) => value.apply(target, args);
      }
      return value;
    },
  }) as PgDatabase;
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
