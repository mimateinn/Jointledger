import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    throw new Error("DATABASE_URL is not set");
  }
  return url;
}

/** `postgres://` / `postgresql://` → 現有 Postgres 路徑；其餘（含 `file:`）→ SQLite。 */
export function isPostgresUrl(url: string): boolean {
  return url.startsWith("postgres://") || url.startsWith("postgresql://");
}

export function usesPostgres(): boolean {
  return isPostgresUrl(getDatabaseUrl());
}

export function sqliteFilePath(url: string): string {
  return url.startsWith("file:") ? url.slice("file:".length) : url;
}

export function ensureSqliteDir(url: string): void {
  const dir = dirname(sqliteFilePath(url));
  if (dir && dir !== ".") {
    mkdirSync(dir, { recursive: true });
  }
}
