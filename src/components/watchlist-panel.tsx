"use client";

import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { ErrorToast } from "./error-toast";
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

export type WatchMutateFn = (prev: WatchState, formData: FormData) => Promise<WatchState>;

const WATCH_COPY = {
  mute: "靜音新聞",
  unmute: "恢復新聞",
  remove: "取消關注",
  failed: "更新失敗",
};

function WatchMuteStatus({ muted }: { muted: boolean }) {
  return <span className="meta muted">{muted ? "已靜音" : "僅關注"}</span>;
}

export function WatchActions({
  row,
  muteAction = muteWatchAction,
  removeAction = removeWatchAction,
  muted: mutedProp,
  onMutedChange,
}: {
  row: WatchRow;
  muteAction?: WatchMutateFn;
  removeAction?: WatchMutateFn;
  muted?: boolean;
  onMutedChange?: (muted: boolean) => void;
}) {
  const controlled = onMutedChange != null;
  const [localMuted, setLocalMuted] = useState(row.muted);
  const muted = controlled ? (mutedProp ?? row.muted) : localMuted;
  const setMuted = onMutedChange ?? setLocalMuted;
  const [mutePending, setMutePending] = useState(false);
  const [removePending, setRemovePending] = useState(false);
  const [muteError, setMuteError] = useState<string | null>(null);
  const muteGen = useRef(0);
  const removeGen = useRef(0);
  const muteInFlight = useRef(false);
  const removeInFlight = useRef(false);

  useEffect(() => {
    if (!controlled) {
      setLocalMuted(row.muted);
    }
  }, [row.muted, controlled]);

  async function onMute() {
    if (muteInFlight.current) {
      return;
    }
    muteInFlight.current = true;
    queueMicrotask(() => {
      muteInFlight.current = false;
    });
    const next = !muted;
    const generation = (muteGen.current += 1);
    setMuteError(null);
    setMuted(next);
    setMutePending(true);
    try {
      const fd = new FormData();
      fd.set("id", row.id);
      fd.set("muted", next ? "1" : "0");
      const result = await muteAction({}, fd);
      if (result.error && generation === muteGen.current) {
        setMuted(!next);
        setMuteError(WATCH_COPY.failed);
      }
    } catch {
      if (generation === muteGen.current) {
        setMuted(!next);
        setMuteError(WATCH_COPY.failed);
      }
    } finally {
      if (generation === muteGen.current) {
        muteInFlight.current = false;
        setMutePending(false);
      }
    }
  }

  async function onRemove() {
    if (removeInFlight.current) {
      return;
    }
    removeInFlight.current = true;
    const generation = (removeGen.current += 1);
    setRemovePending(true);
    try {
      const fd = new FormData();
      fd.set("id", row.id);
      await removeAction({}, fd);
    } catch {
      // pending still clears in finally so an aborted refresh cannot stick
    } finally {
      if (generation === removeGen.current) {
        removeInFlight.current = false;
        setRemovePending(false);
      }
    }
  }

  return (
    <div className="watch-actions">
      <button
        className="btn btn-secondary"
        type="button"
        aria-busy={mutePending || undefined}
        onClick={() => void onMute()}
      >
        {muted ? WATCH_COPY.unmute : WATCH_COPY.mute}
      </button>
      <button className="btn btn-ghost" type="button" disabled={removePending} onClick={() => void onRemove()}>
        {WATCH_COPY.remove}
      </button>
      {muteError ? <ErrorToast message={muteError} label={row.displayCode} onDismiss={() => setMuteError(null)} /> : null}
    </div>
  );
}

function WatchNews({
  row,
  item,
  newsVia,
}: {
  row: WatchRow;
  item?: { headline: string; source?: string; url?: string };
  newsVia: "finnhub" | "rss" | null;
}) {
  if (row.muted || !item) {
    return <span className="muted">—</span>;
  }
  return (
    <div className="watch-news">
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
  );
}

function WatchCard({
  row,
  item,
  newsVia,
  interactive,
}: {
  row: WatchRow;
  item?: { headline: string; source?: string; url?: string };
  newsVia: "finnhub" | "rss" | null;
  interactive: boolean;
}) {
  const [muted, setMuted] = useState(row.muted);
  useEffect(() => {
    setMuted(row.muted);
  }, [row.muted]);
  return (
    <li className="watch-card">
      <div className="watch-card-head">
        <InstrumentLabel ticker={row.displayCode} name={row.name} />
        <div className="watch-card-quote">
          <div className="tabular">{row.lastDisplay ?? "未有報價"}</div>
          <div className={`meta tabular ${changeClass(row.lastDisplay ? row.percentChange : null)}`}>
            {row.lastDisplay ? (row.percentChange ?? "—") : "—"}
          </div>
        </div>
      </div>
      <div className="watch-card-meta">
        <span className="chip">{row.marketLabel}</span>
        <WatchMuteStatus muted={muted} />
      </div>
      <div className="watch-card-news">
        <span className="meta muted">最新新聞</span>
        <WatchNews row={{ ...row, muted }} item={item} newsVia={newsVia} />
      </div>
      {interactive ? (
        <WatchActions row={row} muted={muted} onMutedChange={setMuted} />
      ) : (
        <div className="watch-actions watch-actions-slot" aria-hidden="true" />
      )}
    </li>
  );
}

function WatchTableRow({
  row,
  item,
  newsVia,
  interactive,
}: {
  row: WatchRow;
  item?: { headline: string; source?: string; url?: string };
  newsVia: "finnhub" | "rss" | null;
  interactive: boolean;
}) {
  const [muted, setMuted] = useState(row.muted);
  useEffect(() => {
    setMuted(row.muted);
  }, [row.muted]);
  return (
    <tr>
      <td>
        <InstrumentLabel ticker={row.displayCode} name={row.name} />
      </td>
      <td><span className="chip">{row.marketLabel}</span></td>
      <td className="tabular">{row.lastDisplay ?? "未有報價"}</td>
      <td className={`tabular ${changeClass(row.lastDisplay ? row.percentChange : null)}`}>
        {row.lastDisplay ? (row.percentChange ?? "—") : "—"}
      </td>
      <td className="meta">
        <WatchNews row={{ ...row, muted }} item={item} newsVia={newsVia} />
      </td>
      <td>
        <WatchMuteStatus muted={muted} />
      </td>
      <td>
        {interactive ? (
          <WatchActions row={row} muted={muted} onMutedChange={setMuted} />
        ) : (
          <div className="watch-actions watch-actions-slot" aria-hidden="true" />
        )}
      </td>
    </tr>
  );
}

function useWatchLayout(): "table" | "list" | null {
  const [layout, setLayout] = useState<"table" | "list" | null>(null);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 800px)");
    const sync = () => setLayout(mq.matches ? "list" : "table");
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return layout;
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
  const layout = useWatchLayout();

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
          <p className="field-hint">輸入代碼或公司名，例如 0700.HK 或 TSLA。</p>
        {hits[0] ? (
          <div className="row">
            <div>
              <strong>{hits[0].display}</strong> {hits[0].displayName ?? ""}{" "}
              <span className="muted">{hits[0].marketLabel}</span>
              {pendingSearch ? <span className="muted"> · …</span> : null}
            </div>
            <button className="btn btn-secondary" type="submit" disabled={addPending}>
              {addPending ? "儲存中" : "加入關注"}
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
        <>
        <ul className="watch-list">
          {visible.map((row) => (
            <WatchCard
              key={`list-${row.id}`}
              row={row}
              item={news[row.displayCode]?.[0]}
              newsVia={newsVia}
              interactive={layout === "list"}
            />
          ))}
        </ul>
        <div className="table-scroll watch-table">
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
            {visible.map((row) => (
              <WatchTableRow
                key={`table-${row.id}`}
                row={row}
                item={news[row.displayCode]?.[0]}
                newsVia={newsVia}
                interactive={layout === "table"}
              />
            ))}
          </tbody>
        </table>
        </div>
        </>
      )}
    </section>
  );
}
