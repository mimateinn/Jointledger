"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultActiveIds, type Bar } from "@/indicators";
import { FailurePanel } from "./failure-panel";
import { IndicatorPicker } from "./indicator-picker";
import { InstrumentLabel } from "./instrument-label";
import { KlineChart } from "./kline-chart";

type OhlcvResponse = {
  display?: string;
  bars?: Bar[];
  status?: string;
  planLimited?: boolean;
};

function changeClass(change: string | null): string {
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

export function InstrumentKline({
  display,
  name,
  last,
  percentChange,
  isEtfProxy,
  planLimited,
  tags = [],
  showHeader = true,
}: {
  display: string;
  name?: string | null;
  last: string | null;
  percentChange: string | null;
  delayLabel: string;
  lastUpdateLabel?: string | null;
  isEtfProxy: boolean;
  planLimited: boolean;
  tags?: string[];
  showHeader?: boolean;
}) {
  const [bars, setBars] = useState<Bar[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [active, setActive] = useState<Set<string>>(() => defaultActiveIds());
  const [enlarged, setEnlarged] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setBars(null);
    setFailed(false);
    fetch(`/api/ohlcv?symbol=${encodeURIComponent(display)}`, { cache: "no-store" })
      .then((res) => {
        if (!res.ok) {
          throw new Error("ohlcv");
        }
        return res.json();
      })
      .then((body: OhlcvResponse) => {
        if (!cancelled) {
          setBars(Array.isArray(body.bars) ? body.bars : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setFailed(true);
          setBars([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [display, reloadKey]);

  const onToggle = useCallback((id: string) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const loaded = bars !== null && !failed;
  const chartBars = useMemo(() => bars ?? [], [bars]);
  const noBars = loaded && chartBars.length === 0;
  const canChart = loaded && !noBars && !failed;

  useEffect(() => {
    if (!enlarged) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setEnlarged(false);
      }
    };
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [enlarged]);

  const toggleSize = useCallback(() => {
    setEnlarged((value) => !value);
  }, []);

  return (
    <section className={enlarged ? "card stack instrument-kline kline-stage-open" : "card stack instrument-kline"}>
      {showHeader ? (
        <div className="instrument-quote">
          <p className="meta muted">
            <InstrumentLabel ticker={display} name={name} />
            {isEtfProxy ? " · 代理" : ""}
            {planLimited ? " · 延遲／升級" : ""}
          </p>
          <div className="instrument-last">
            <div className="display tabular">{last ?? "未有報價"}</div>
            {last && percentChange ? (
              <div className={`title ${changeClass(percentChange)}`}>{percentChange}</div>
            ) : null}
          </div>
          {tags.length > 0 ? (
            <div className="chip-row">
              {tags.map((tag) => (
                <span key={tag} className="chip">
                  {tag}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
      {canChart ? (
        <div className="kline-toolbar">
          <button type="button" className="btn btn-ghost" onClick={toggleSize}>
            {enlarged ? "還原" : "放大"}
          </button>
        </div>
      ) : null}
      <div
        className={
          enlarged
            ? "kline-frame kline-frame-open"
            : noBars || failed
              ? "kline-frame kline-frame-empty"
              : "kline-frame"
        }
        onClick={canChart && !enlarged ? toggleSize : undefined}
        role={canChart && !enlarged ? "button" : undefined}
        tabIndex={canChart && !enlarged ? 0 : undefined}
        aria-label={enlarged ? "陰陽燭" : canChart ? "放大陰陽燭" : "日線"}
        onKeyDown={
          canChart && !enlarged
            ? (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSize();
                }
              }
            : undefined
        }
      >
        {failed ? (
          <FailurePanel sentence="日線暫時載唔到，唔好緊，再試一次就得。" onRetry={() => setReloadKey((n) => n + 1)} />
        ) : !loaded ? (
          <div className="skeleton skeleton-kline" aria-hidden="true" />
        ) : (
          <KlineChart bars={chartBars} active={active} expanded={enlarged} />
        )}
      </div>
      {canChart ? <IndicatorPicker active={active} onToggle={onToggle} /> : null}
    </section>
  );
}
