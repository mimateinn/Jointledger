import type { NewsCategory, NewsItem } from "./types";

const HL = "zh-HK";
const GL = "HK";
const CEID = "HK:zh-Hant";
const LIMIT = 8;

function withLocale(url: URL): string {
  url.searchParams.set("hl", HL);
  url.searchParams.set("gl", GL);
  url.searchParams.set("ceid", CEID);
  return url.toString();
}

export function rssTickerQuery(ticker: string): string {
  return `${ticker} when:7d`;
}

export function googleNewsSearchUrl(query: string): string {
  const url = new URL("https://news.google.com/rss/search");
  url.searchParams.set("q", query);
  return withLocale(url);
}

export function rssTickerUrl(ticker: string): string {
  return googleNewsSearchUrl(rssTickerQuery(ticker));
}

export function rssMarketUrl(category: NewsCategory): string {
  if (category === "general") {
    return withLocale(new URL("https://news.google.com/rss/headlines/section/topic/BUSINESS"));
  }
  if (category === "forex") {
    return googleNewsSearchUrl("外匯 when:7d");
  }
  return googleNewsSearchUrl("加密貨幣 when:7d");
}

function decodeXml(value: string): string {
  return value
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function tagText(xml: string, name: string): string {
  const match = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i"));
  return match ? decodeXml(match[1].trim()) : "";
}

function toDatetime(pubDate: string): number {
  if (!pubDate) {
    return 0;
  }
  const ms = Date.parse(pubDate);
  return Number.isFinite(ms) ? Math.floor(ms / 1000) : 0;
}

export function parseRssItems(xml: string): NewsItem[] {
  if (!xml || (!xml.includes("<rss") && !xml.includes("<channel") && !xml.includes("<item"))) {
    return [];
  }
  const blocks = xml.match(/<item\b[^>]*>[\s\S]*?<\/item>/gi) ?? [];
  const items: NewsItem[] = [];
  for (const block of blocks) {
    const rawTitle = tagText(block, "title");
    const source = tagText(block, "source");
    const headline =
      source && rawTitle.endsWith(` - ${source}`) ? rawTitle.slice(0, -` - ${source}`.length).trim() : rawTitle;
    if (!headline) {
      continue;
    }
    items.push({
      headline,
      datetime: toDatetime(tagText(block, "pubDate")),
      source,
      url: tagText(block, "link"),
    });
    if (items.length >= LIMIT) {
      break;
    }
  }
  return items;
}

async function getRss(url: string): Promise<NewsItem[]> {
  try {
    const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
    if (!response.ok) {
      return [];
    }
    const type = response.headers.get("content-type") ?? "";
    if (type.includes("text/html") && !type.includes("xml")) {
      return [];
    }
    const text = await response.text();
    if (text.includes("<html") && !text.includes("<rss") && !text.includes("<item")) {
      return [];
    }
    return parseRssItems(text);
  } catch {
    return [];
  }
}

export async function fetchRssTicker(ticker: string): Promise<NewsItem[]> {
  return getRss(rssTickerUrl(ticker));
}

export async function fetchRssMarket(category: NewsCategory): Promise<NewsItem[]> {
  return getRss(rssMarketUrl(category));
}
