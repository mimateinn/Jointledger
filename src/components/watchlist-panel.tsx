"use client";

import { useActionState, useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { FailurePanel } from "./failure-panel";
import { InstrumentLabel } from "./instrument-label";
import {
  addWatchAction,
  muteWatchAction,
  removeWatchAction,
  searchWatchAction,
  type WatchSearchHit,
  type WatchState,
} from "@/app/actions/watchlist";
import { WATCH_CAP } from "@/watchlist/constants";

export type WatchRow = {
  id: string;
  displayCode: string;
  muted: boolean;
  market: string;
  marketLabel: string;
  lastDisplay: string | null;
  percentChange: string | null;
  name: string | null;
};

const initial: WatchState = {};

const FILTERS = [
  { key: "all", label: "全部" },
  { key: "US", label: "美" },
  { key: "HK", label: "港" },
  { key: "JP", label: "日" },
  { key: "KR", label: "韓" },
  { key: "CN", label: "中" },
  { key: "EU", label: "歐" },
  { key: "UK", label: "英" },
  { key: "COM", label: "商品" },
  { key: "CRYPTO", label: "加密" },
  { key: "FX", label: "外匯" },
] as const;

function changeClass(change: string | null): string | undefined {
  if (!change) {
    return "muted";
  }
  if (change.startsWith("+")) {
    return "up";
  }
  if (change.startsWith("-")) {
    return "down";
  }
  return "muted";
}

export function WatchlistPanel({ items }: { items: WatchRow[] }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<WatchSearchHit[]>([]);
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [news, setNews] = useState<Record<string, { headline: string; source?: string; url?: string }[]>>({});
  const [newsVia, setNewsVia] = useState<"finnhub" | "rss" | null>(null);
  const [newsFailed, setNewsFailed] = useState(false);
  const [newsReload, setNewsReload] = useState(0);
  const [pendingSearch, startSearch] = useTransition();
  const [addState, addAction, addPending] = useActionState(addWatchAction, initial);
  const [, removeAction, removePending] = useActionState(removeWatchAction, initial);
  const [, muteAction, mutePending] = useActionState(muteWatchAction, initial);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const handle = window.setTimeout(() => {
      startSearch(async () => {
        setHits(await searchWatchAction(q));
      });
    }, 200);
    return () => window.clearTimeout(handle);
  }, [query]);

  useEffect(() => {
    const symbols = items.map((row) => row.displayCode).join(",");
    if (!symbols) {
      return;
    }
    let cancelled = false;
    setNewsFailed(false);
    fetch(`/api/news?symbols=${encodeURIComponent(symbols)}`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("news");
        }
        return res.json();
      })
      .then((body: { items?: Record<string, { headline: string; source?: string; url?: string }[]>; via?: "finnhub" | "rss" }) => {
        if (!cancelled) {
          setNews(body.items ?? {});
          setNewsVia(body.via ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setNewsFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [items, newsReload]);

  const visible = items.filter((row) => filter === "all" || row.market === filter);

  return (
    <section className="card stack">
      {items.length > 0 ? (
        <div className="row">
          <div className="meta muted">
            {items.length} / {WATCH_CAP}
          </div>
          {newsVia === "rss" ? <div className="chip">公開新聞</div> : null}
        </div>
      ) : null}
      {items.length > 0 ? (
        <div className="chip-row">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={filter === item.key ? "chip chip-active" : "chip"}
              onClick={() => setFilter(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      <form className="form-grid" action={addAction}>
        <div className="field">
          <label htmlFor="symbol">顯示碼</label>
          <input
            className="input"
            id="symbol"
            name="symbol"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="XAU · 0700.HK · TSLA"
            autoComplete="off"
          />
        </div>
        <p className="meta muted">顯示碼: 0700.HK · 7203.T · 005930.KS · 600519.SS。查價唔用 Yahoo 後綴當 API key。</p>
        {hits[0] ? (
          <div className="row">
            <div>
              <strong>{hits[0].display}</strong> {hits[0].displayName ?? ""}{" "}
              <span className="muted">{hits[0].marketLabel}</span>
              {pendingSearch ? <span className="muted"> · …</span> : null}
            </div>
            <button className="btn btn-secondary" type="submit" disabled={addPending}>
              {addPending ? "儲存中" : "+關注"}
            </button>
          </div>
        ) : query.trim() ? (
          <p className="muted">唔識呢個代碼，未加入。</p>
        ) : null}
        {addState.error ? <p className="alert">{addState.error}</p> : null}
        {addState.ok ? <p className="ok">{addState.ok}</p> : null}
      </form>
      {items.length === 0 ? (
        <p className="body">
          未有關注，加入代碼或先去加持倉。{" "}
          <Link href="/entry" prefetch className="btn btn-primary">
            加持倉
          </Link>
        </p>
      ) : null}
      {newsFailed ? (
        <FailurePanel sentence="新聞暫時載唔到，唔好緊，再試一次就得。" onRetry={() => setNewsReload((n) => n + 1)} />
      ) : null}
      {items.length === 0 ? null : visible.length === 0 ? (
        <p className="empty">呢個市場未有關注。</p>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>標的</th>
              <th>市場</th>
              <th>現價</th>
              <th>今日</th>
              <th>最新新聞</th>
              <th>狀態</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => {
              const item = news[row.displayCode]?.[0];
              return (
              <tr key={row.id}>
                <td>
                  <InstrumentLabel ticker={row.displayCode} name={row.name} />
                </td>
                <td>{row.marketLabel}</td>
                <td className="tabular">{row.lastDisplay ?? "—"}</td>
                <td className={`tabular ${changeClass(row.lastDisplay ? row.percentChange : null)}`}>
                  {row.lastDisplay ? (row.percentChange ?? "—") : "—"}
                </td>
                <td className="meta">
                  {row.muted || !item ? (
                    "—"
                  ) : (
                    <div>
                      {item.url ? (
                        <a href={item.url} target="_blank" rel="noopener noreferrer">
                          {item.headline}
                        </a>
                      ) : (
                        item.headline
                      )}
                      {newsVia === "rss" ? (
                        <div className="muted">公開新聞{item.source ? ` · ${item.source}` : ""}</div>
                      ) : item.source ? (
                        <div className="muted">{item.source}</div>
                      ) : null}
                    </div>
                  )}
                </td>
                <td className="meta muted">{row.muted ? "已靜音" : "僅關注"}</td>
                <td>
                  <div className="submit-row">
                    <form action={muteAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <input type="hidden" name="muted" value={row.muted ? "0" : "1"} />
                      <button className="btn btn-ghost" type="submit" disabled={mutePending}>
                        {row.muted ? "恢復新聞" : "靜音新聞"}
                      </button>
                    </form>
                    <form action={removeAction}>
                      <input type="hidden" name="id" value={row.id} />
                      <button className="btn btn-ghost" type="submit" disabled={removePending}>
                        取消關注
                      </button>
                    </form>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
}

