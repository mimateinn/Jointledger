import { sql } from "drizzle-orm";
import { isPostgresUrl } from "./dialect";

function postgresNow(): boolean {
  return isPostgresUrl(process.env.DATABASE_URL ?? "");
}

export function xactLockSql(key: number) {
  if (postgresNow()) {
    return sql`select pg_advisory_xact_lock(${key})`;
  }
  return sql`select 1`;
}

export function tryXactLockSql(key: number) {
  if (postgresNow()) {
    return sql`select pg_try_advisory_xact_lock(${key}) as locked`;
  }
  return sql`select 1 as locked`;
}
