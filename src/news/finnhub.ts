import type { NewsCategory, NewsItem } from "./types";

const COMPANY_NEWS = "https://finnhub.io/api/v1/company-news";
const MARKET_NEWS = "https://finnhub.io/api/v1/news";

export function finnhubKey(): string {
  return (process.env.FINNHUB_API_KEY ?? "").trim();
}

function asItems(payload: unknown): NewsItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const item = row as Record<string, unknown>;
      const headline = typeof item.headline === "string" ? item.headline : "";
      if (!headline) {
        return null;
      }
      return {
        headline,
        datetime: typeof item.datetime === "number" ? item.datetime : 0,
        source: typeof item.source === "string" ? item.source : "",
        url: typeof item.url === "string" ? item.url : "",
      };
    })
    .filter((row): row is NewsItem => row !== null)
    .slice(0, 8);
}

async function getJson(url: string): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(url, { cache: "no-store" });
  if (response.status === 429) {
    return { ok: false, status: 429, body: null };
  }
  if (!response.ok) {
    return { ok: false, status: response.status, body: null };
  }
  return { ok: true, status: response.status, body: await response.json() };
}

export async function fetchCompanyNews(symbol: string, now = new Date()): Promise<NewsItem[]> {
  const key = finnhubKey();
  if (!key) {
    return [];
  }
  const to = now.toISOString().slice(0, 10);
  const from = new Date(now.getTime() - 14 * 86_400_000).toISOString().slice(0, 10);
  const url = `${COMPANY_NEWS}?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(key)}`;
  const result = await getJson(url);
  if (!result.ok) {
    return [];
  }
  return asItems(result.body);
}

export async function fetchMarketNews(category: NewsCategory): Promise<NewsItem[]> {
  const key = finnhubKey();
  if (!key) {
    return [];
  }
  const url = `${MARKET_NEWS}?category=${encodeURIComponent(category)}&token=${encodeURIComponent(key)}`;
  const result = await getJson(url);
  if (!result.ok) {
    return [];
  }
  return asItems(result.body);
}
