import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchRssMarket,
  fetchRssTicker,
  googleNewsSearchUrl,
  parseRssItems,
  rssMarketUrl,
  rssTickerQuery,
  rssTickerUrl,
} from "./rss";

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>AAPL when:7d - Google News</title>
    <item>
      <title>Apple 業績勝預期 - 路透社</title>
      <link>https://news.google.com/rss/articles/CBMiEXAMPLE</link>
      <pubDate>Mon, 17 Aug 2026 06:00:00 GMT</pubDate>
      <description>唔好用呢段</description>
      <source url="https://www.reuters.com">路透社</source>
    </item>
    <item>
      <title><![CDATA[Second headline]]></title>
      <link>https://example.com/story</link>
      <pubDate>Sun, 16 Aug 2026 12:00:00 GMT</pubDate>
      <source>彭博</source>
    </item>
  </channel>
</rss>`;

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("Google News RSS query", () => {
  it("個股 query 含 ticker + when:7d，locale 優先 zh-HK", () => {
    expect(rssTickerQuery("AAPL")).toBe("AAPL when:7d");
    expect(rssTickerQuery("0700.HK")).toBe("0700.HK when:7d");
    const url = rssTickerUrl("AAPL");
    expect(url.startsWith("https://news.google.com/rss/search?")).toBe(true);
    const parsed = new URL(url);
    expect(parsed.searchParams.get("q")).toBe("AAPL when:7d");
    expect(parsed.searchParams.get("hl")).toBe("zh-HK");
    expect(parsed.searchParams.get("gl")).toBe("HK");
    expect(parsed.searchParams.get("ceid")).toBe("HK:zh-Hant");
  });

  it("大市用財經 topic 或市場 search，同樣 zh-HK", () => {
    const general = new URL(rssMarketUrl("general"));
    expect(general.pathname).toBe("/rss/headlines/section/topic/BUSINESS");
    expect(general.searchParams.get("hl")).toBe("zh-HK");
    const forex = new URL(rssMarketUrl("forex"));
    expect(forex.searchParams.get("q")).toBe("外匯 when:7d");
    const search = new URL(googleNewsSearchUrl("市場 when:7d"));
    expect(search.searchParams.get("hl")).toBe("zh-HK");
  });
});

describe("parseRssItems", () => {
  it("只取標題、出版社、連結、時間", () => {
    const items = parseRssItems(SAMPLE);
    expect(items).toHaveLength(2);
    expect(items[0]).toEqual({
      headline: "Apple 業績勝預期",
      datetime: Math.floor(Date.parse("Mon, 17 Aug 2026 06:00:00 GMT") / 1000),
      source: "路透社",
      url: "https://news.google.com/rss/articles/CBMiEXAMPLE",
    });
    expect(items[1]?.headline).toBe("Second headline");
    expect(items[1]?.source).toBe("彭博");
    expect(JSON.stringify(items)).not.toContain("唔好用呢段");
  });

  it("空 feed／HTML／垃圾輸入 → 空列表", () => {
    expect(parseRssItems("")).toEqual([]);
    expect(parseRssItems("<rss><channel></channel></rss>")).toEqual([]);
    expect(parseRssItems("<html><body>blocked</body></html>")).toEqual([]);
    expect(parseRssItems("not xml")).toEqual([]);
  });
});

describe("fetchRss failure", () => {
  it("失敗／被擋 → 空列表，唔崩潰", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Promise.reject(new Error("blocked"))));
    await expect(fetchRssTicker("AAPL")).resolves.toEqual([]);

    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 403 })));
    await expect(fetchRssMarket("general")).resolves.toEqual([]);

    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("<html>captcha</html>", { headers: { "content-type": "text/html" } })),
    );
    await expect(fetchRssTicker("TSLA")).resolves.toEqual([]);
  });
});
