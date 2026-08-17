import { afterEach, describe, expect, it, vi } from "vitest";
import { newsForSymbol } from "./service";
import { loadCategoryNews, loadSymbolNews, newsVia } from "./source";
import { resolveWatchSymbol } from "@/quotes/symbol-map";

const originalKey = process.env.FINNHUB_API_KEY;

afterEach(() => {
  process.env.FINNHUB_API_KEY = originalKey;
  vi.unstubAllGlobals();
});

function aapl() {
  const resolved = resolveWatchSymbol("AAPL");
  if (!resolved) {
    throw new Error("AAPL should resolve");
  }
  return resolved;
}

describe("news source exclusivity", () => {
  it("有 key：只打 Finnhub；429／失敗唔改行 RSS", async () => {
    process.env.FINNHUB_API_KEY = "test-key";
    expect(newsVia()).toBe("finnhub");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("news.google.com")) {
        throw new Error("must not call RSS when Finnhub key is set");
      }
      return new Response(null, { status: 429 });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadSymbolNews(aapl())).resolves.toEqual([]);
    await expect(loadCategoryNews("general")).resolves.toEqual([]);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.length).toBeGreaterThan(0);
    expect(urls.every((url) => url.includes("finnhub.io"))).toBe(true);
    expect(urls.every((url) => !url.includes("news.google.com"))).toBe(true);
    expect(urls.some((url) => url.includes("company-news"))).toBe(true);
    expect(urls.some((url) => url.includes("/news?category="))).toBe(true);
    expect(urls.every((url) => !url.includes("/quote"))).toBe(true);
  });

  it("無 key（trim 後空）：只打 Google News RSS，唔打 Finnhub", async () => {
    process.env.FINNHUB_API_KEY = "   ";
    expect(newsVia()).toBe("rss");
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("finnhub.io")) {
        throw new Error("must not call Finnhub when key is empty");
      }
      expect(url).toContain("news.google.com/rss");
      expect(url).toContain("zh-HK");
      if (url.includes("search")) {
        expect(decodeURIComponent(url)).toContain("when:7d");
      }
      return new Response("<rss><channel></channel></rss>", {
        headers: { "content-type": "application/rss+xml" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(loadSymbolNews(aapl())).resolves.toEqual([]);
    await expect(loadCategoryNews("general")).resolves.toEqual([]);

    const urls = fetchMock.mock.calls.map((call) => String(call[0]));
    expect(urls.every((url) => url.includes("news.google.com/rss"))).toBe(true);
    expect(urls.every((url) => !url.includes("finnhub.io"))).toBe(true);
    expect(urls.some((url) => decodeURIComponent(url).includes("AAPL") && decodeURIComponent(url).includes("when:7d"))).toBe(
      true,
    );
  });

  it("靜音唔拉、唔回個股新聞", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    process.env.FINNHUB_API_KEY = "test-key";
    await expect(newsForSymbol("AAPL", true)).resolves.toEqual([]);
    process.env.FINNHUB_API_KEY = "";
    await expect(newsForSymbol("AAPL", true)).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
