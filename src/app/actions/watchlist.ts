"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/session";
import { getCurrentMembership } from "@/lib/current-book";
import { resolveWatchSymbol, searchWatchSymbols } from "@/quotes/symbol-map";
import { addWatchItem, listWatchItems, removeWatchItem, setWatchMuted } from "@/watchlist/repo";

export type WatchSearchHit = {
  display: string;
  displayName: string | null;
  market: string;
  marketLabel: string;
};

export type WatchState = { error?: string; ok?: string };

async function requireBook() {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    throw new Error("未有記帳表");
  }
  return ctx;
}

export async function searchWatchAction(query: string): Promise<WatchSearchHit[]> {
  await requireBook();
  return searchWatchSymbols(query).map((row) => ({
    display: row.display,
    displayName: row.displayName,
    market: row.market,
    marketLabel: row.marketLabel,
  }));
}

export async function addWatchAction(_prev: WatchState, formData: FormData): Promise<WatchState> {
  try {
    const ctx = await requireBook();
    const raw = String(formData.get("symbol") ?? "");
    const resolved = resolveWatchSymbol(raw);
    if (!resolved) {
      return { error: "唔識呢個代碼，未加入。" };
    }
    await addWatchItem(ctx.book.id, resolved.display);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "加入失敗" };
  }
  revalidatePath("/holdings");
  return { ok: "已關注" };
}

export async function removeWatchAction(_prev: WatchState, formData: FormData): Promise<WatchState> {
  try {
    const ctx = await requireBook();
    await removeWatchItem(ctx.book.id, String(formData.get("id") ?? ""));
  } catch (error) {
    return { error: error instanceof Error ? error.message : "取消失敗" };
  }
  revalidatePath("/holdings");
  return { ok: "已取消關注" };
}

export async function muteWatchAction(_prev: WatchState, formData: FormData): Promise<WatchState> {
  try {
    const ctx = await requireBook();
    const muted = String(formData.get("muted") ?? "") === "1";
    await setWatchMuted(ctx.book.id, String(formData.get("id") ?? ""), muted);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "更新失敗" };
  }
  revalidatePath("/holdings");
  return { ok: mutedLabel(String(formData.get("muted") ?? "") === "1") };
}

function mutedLabel(muted: boolean): string {
  return muted ? "已靜音新聞" : "已恢復新聞";
}

export async function currentWatchCount(bookId: string): Promise<number> {
  return (await listWatchItems(bookId)).length;
}
