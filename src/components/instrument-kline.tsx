"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { defaultActiveIds, type Bar } from "@/indicators";
import { DelayBadge } from "./delay-badge";
import { IndicatorPicker } from "./indicator-picker";
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
  const [active, setActive] = useState<Set<string>>(() => defaultActiveIds());

  useEffect(() => {
    let cancelled = false;
    setBars(null);
    fetch(`/api/ohlcv?symbol=${encodeURIComponent(display)}`, { cache: "no-store" })
      .then((res) => (res.ok ? res.json() : { bars: [] }))
      .then((body: OhlcvResponse) => {
        if (!cancelled) {
          setBars(Array.isArray(body.bars) ? body.bars : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBars([]);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [display]);

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

  const loaded = bars !== null;
  const chartBars = useMemo(() => bars ?? [], [bars]);

  return (
    <section className="card stack instrument-kline">
      {showHeader ? (
        <div className="instrument-quote">
          <div className="page-head">
            <div>
              <h2 className="display">{display}</h2>
              {name ? <p className="muted">{name}</p> : null}
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
      <IndicatorPicker active={active} onToggle={onToggle} />
      {!loaded ? <div className="kline-empty muted">載入日線…</div> : <KlineChart bars={chartBars} active={active} />}
      <p className="muted">
        指數／商品／幣／匯都當 Instrument：K 線。無加倉、減倉、入金。呢啲唔係投資建議，只係整理帳簿同公開資料。
      </p>
    </section>
  );
}
