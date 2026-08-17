import { and, eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { watchItems } from "@/db/schema";
import { WATCH_CAP } from "./constants";

export type WatchItem = {
  id: string;
  bookId: string;
  displayCode: string;
  muted: boolean;
};

export async function listWatchItems(bookId: string): Promise<WatchItem[]> {
  const db = getDb();
  const rows = await db.select().from(watchItems).where(eq(watchItems.bookId, bookId));
  return rows
    .map((row) => ({
      id: row.id,
      bookId: row.bookId,
      displayCode: row.displayCode,
      muted: row.muted,
    }))
    .sort((a, b) => a.displayCode.localeCompare(b.displayCode));
}

export async function addWatchItem(bookId: string, displayCode: string): Promise<WatchItem> {
  const db = getDb();
  const existing = await listWatchItems(bookId);
  if (existing.some((row) => row.displayCode === displayCode)) {
    throw new Error("已經關注");
  }
  if (existing.length >= WATCH_CAP) {
    throw new Error(`關注最多 ${WATCH_CAP} 個`);
  }
  const [row] = await db
    .insert(watchItems)
    .values({ bookId, displayCode, muted: false })
    .returning();
  return { id: row.id, bookId: row.bookId, displayCode: row.displayCode, muted: row.muted };
}

export async function removeWatchItem(bookId: string, id: string): Promise<void> {
  const db = getDb();
  await db.delete(watchItems).where(and(eq(watchItems.id, id), eq(watchItems.bookId, bookId)));
}

export async function setWatchMuted(bookId: string, id: string, muted: boolean): Promise<void> {
  const db = getDb();
  await db
    .update(watchItems)
    .set({ muted })
    .where(and(eq(watchItems.id, id), eq(watchItems.bookId, bookId)));
}
