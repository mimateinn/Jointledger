import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { newsCache } from "@/db/tables";
import { resolveWatchSymbol } from "@/quotes/symbol-map";
import { categoryCacheKey, loadCategoryNews, loadSymbolNews, symbolCacheKey } from "./source";
import type { NewsCategory, NewsItem } from "./types";

const TTL_MS = 15 * 60 * 1000;
const flights = new Map<string, Promise<NewsItem[]>>();

type CacheRow = {
  items: NewsItem[];
  status: string;
};

function readPayload(value: unknown): NewsItem[] {
  if (!value || typeof value !== "object") {
    return [];
  }
  const items = (value as CacheRow).items;
  return Array.isArray(items) ? items : [];
}

async function loadCache(cacheKey: string): Promise<NewsItem[] | null> {
  const db = getDb();
  const [row] = await db.select().from(newsCache).where(eq(newsCache.cacheKey, cacheKey)).limit(1);
  if (!row) {
    return null;
  }
  if (Date.now() - row.fetchedAt.getTime() >= TTL_MS) {
    return null;
  }
  return readPayload(row.payload);
}

async function saveCache(cacheKey: string, items: NewsItem[], status: string): Promise<void> {
  const db = getDb();
  await db
    .insert(newsCache)
    .values({ cacheKey, payload: { items }, fetchedAt: new Date(), status })
    .onConflictDoUpdate({
      target: newsCache.cacheKey,
      set: { payload: { items }, fetchedAt: new Date(), status },
    });
}

async function singleFlight(cacheKey: string, load: () => Promise<NewsItem[]>): Promise<NewsItem[]> {
  const cached = await loadCache(cacheKey).catch(() => null);
  if (cached) {
    return cached;
  }
  const inflight = flights.get(cacheKey);
  if (inflight) {
    return inflight;
  }
  const pending = (async () => {
    try {
      const items = await load();
      await saveCache(cacheKey, items, "ok").catch(() => undefined);
      return items;
    } catch {
      await saveCache(cacheKey, [], "upstream").catch(() => undefined);
      return [];
    } finally {
      flights.delete(cacheKey);
    }
  })();
  flights.set(cacheKey, pending);
  return pending;
}

export async function newsForSymbol(display: string, muted: boolean): Promise<NewsItem[]> {
  if (muted) {
    return [];
  }
  const resolved = resolveWatchSymbol(display);
  if (!resolved) {
    return [];
  }
  return singleFlight(symbolCacheKey(resolved), () => loadSymbolNews(resolved));
}

export async function newsForCategory(category: NewsCategory): Promise<NewsItem[]> {
  return singleFlight(categoryCacheKey(category), () => loadCategoryNews(category));
}

export async function newsMapForWatch(
  items: { displayCode: string; muted: boolean }[],
): Promise<Record<string, NewsItem[]>> {
  const out: Record<string, NewsItem[]> = {};
  await Promise.all(
    items.map(async (item) => {
      out[item.displayCode] = await newsForSymbol(item.displayCode, item.muted);
    }),
  );
  return out;
}
