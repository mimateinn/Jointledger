import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth/session";
import { getCurrentMembership } from "@/lib/current-book";
import { newsForCategory, newsForSymbol } from "@/news/service";
import { newsVia } from "@/news/source";
import type { NewsCategory } from "@/news/types";
import { listWatchItems } from "@/watchlist/repo";

export const dynamic = "force-dynamic";

const CATEGORIES = new Set<NewsCategory>(["general", "forex", "crypto"]);

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return NextResponse.json({ items: {} });
  }

  const url = new URL(request.url);
  const category = url.searchParams.get("category");
  if (category && CATEGORIES.has(category as NewsCategory)) {
    const items = await newsForCategory(category as NewsCategory).catch(() => []);
    return NextResponse.json({ items, via: newsVia() });
  }

  const watched = await listWatchItems(ctx.book.id);
  const muted = new Set(watched.filter((row) => row.muted).map((row) => row.displayCode));
  const requested = (url.searchParams.get("symbols") ?? "")
    .split(",")
    .map((row) => row.trim())
    .filter(Boolean);
  const symbols = requested.length > 0 ? requested : watched.map((row) => row.displayCode);
  const items: Record<string, Awaited<ReturnType<typeof newsForSymbol>>> = {};
  await Promise.all(
    symbols.map(async (symbol) => {
      items[symbol] = await newsForSymbol(symbol, muted.has(symbol)).catch(() => []);
    }),
  );
  return NextResponse.json({ items, via: newsVia() });
}
