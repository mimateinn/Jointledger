import { isNorthAmericaWatch, type WatchResolve } from "@/quotes/symbol-map";
import { fetchCompanyNews, fetchMarketNews, finnhubKey } from "./finnhub";
import { fetchRssMarket, fetchRssTicker } from "./rss";
import type { NewsCategory, NewsItem, NewsVia } from "./types";

export function newsVia(): NewsVia {
  return finnhubKey() ? "finnhub" : "rss";
}

/** Finnhub and RSS are exclusive. Key present → Finnhub only (no RSS on 429/fail). */
export async function loadSymbolNews(resolved: WatchResolve): Promise<NewsItem[]> {
  if (newsVia() === "finnhub") {
    if (resolved.assetClass === "crypto") {
      return fetchMarketNews("crypto");
    }
    if (resolved.assetClass === "fx") {
      return fetchMarketNews("forex");
    }
    if (!isNorthAmericaWatch(resolved)) {
      return [];
    }
    return fetchCompanyNews(resolved.display);
  }
  return fetchRssTicker(resolved.display);
}

export async function loadCategoryNews(category: NewsCategory): Promise<NewsItem[]> {
  if (newsVia() === "finnhub") {
    return fetchMarketNews(category);
  }
  return fetchRssMarket(category);
}

export function symbolCacheKey(resolved: WatchResolve): string {
  if (newsVia() === "rss") {
    return `rss:symbol:${resolved.display}`;
  }
  if (resolved.assetClass === "crypto") {
    return "category:crypto";
  }
  if (resolved.assetClass === "fx") {
    return "category:forex";
  }
  return `symbol:${resolved.display}`;
}

export function categoryCacheKey(category: NewsCategory): string {
  return newsVia() === "rss" ? `rss:category:${category}` : `category:${category}`;
}
