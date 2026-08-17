"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultActiveIds, type Bar } from "@/indicators";
import { DelayBadge } from "./delay-badge";
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
  delayLabel,
  lastUpdateLabel,
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
          <div className="page-head">
            <div>
              <h2 className="display">
                <InstrumentLabel ticker={display} name={name} />
              </h2>
              {tags.length > 0 || isEtfProxy ? (
                <div className="chip-row">
                  {tags.map((tag) => (
                    <span key={tag} className="chip">
                      {tag}
                    </span>
                  ))}
                  {isEtfProxy ? <span className="chip">代理</span> : null}
                </div>
              ) : null}
            </div>
            {last ? <DelayBadge label={delayLabel} lastUpdate={lastUpdateLabel} /> : planLimited ? (
              <span className="chip chip-delay">延遲／升級</span>
            ) : null}
          </div>
          <div className="display tabular">{last ?? "—"}</div>
          <div className={changeClass(last ? percentChange : null)}>{last ? (percentChange ?? "—") : "—"}</div>
        </div>
      ) : null}
      <div className="kline-toolbar">
        <button type="button" className="btn btn-ghost" onClick={toggleSize}>
          {enlarged ? "還原" : "放大"}
        </button>
      </div>
      <IndicatorPicker active={active} onToggle={onToggle} />
      <div
        className={enlarged ? "kline-frame kline-frame-open" : "kline-frame"}
        onClick={enlarged || failed ? undefined : toggleSize}
        role={enlarged || failed ? undefined : "button"}
        tabIndex={enlarged || failed ? undefined : 0}
        aria-label={enlarged ? "陰陽燭" : "放大陰陽燭"}
        onKeyDown={
          enlarged || failed
            ? undefined
            : (event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSize();
                }
              }
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
      <p className="muted">
        指數／商品／幣／匯都當 Instrument：K 線。無加倉、減倉、入金。呢啲唔係投資建議，只係整理帳簿同公開資料。
      </p>
    </section>
  );
}
