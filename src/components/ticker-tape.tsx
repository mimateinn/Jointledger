"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export type TapeItem = {
  display: string;
  name: string | null;
  last: string | null;
  percentChange: string | null;
  delayLabel: string;
  lastUpdateLabel: string | null;
  isEtfProxy: boolean;
  planLimited: boolean;
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

function TapeCell({ item }: { item: TapeItem }) {
  const href = `/instrument/${encodeURIComponent(item.display)}`;
  return (
    <Link href={href} prefetch className="tape-cell">
      <span className="tape-symbol">{item.display}</span>
      {item.name ? <span className="tape-name">{item.name}</span> : null}
      {item.isEtfProxy ? <span className="tape-proxy">代理</span> : null}
      <span className="tape-last tabular">{item.last ?? "—"}</span>
      {item.last ? (
        <span className={`tape-chg tabular ${changeClass(item.percentChange)}`}>
          {item.percentChange ?? "—"}
        </span>
      ) : item.planLimited ? (
        <span className="tape-proxy">延遲／升級</span>
      ) : (
        <span className="muted">—</span>
      )}
    </Link>
  );
}

export function TickerTape({
  items,
  fx,
  delayLabel,
}: {
  items: TapeItem[];
  fx: TapeItem | null;
  delayLabel: string;
}) {
  const [tape, setTape] = useState({ items, fx, delayLabel });

  useEffect(() => {
    setTape({ items, fx, delayLabel });
  }, [items, fx, delayLabel]);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/quotes")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { items?: TapeItem[]; fx?: TapeItem | null; delayLabel?: string } | null) => {
        if (!cancelled && data?.items) {
          setTape({
            items: data.items,
            fx: data.fx ?? null,
            delayLabel: data.delayLabel ?? delayLabel,
          });
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [delayLabel]);

  const loop = [...tape.items, ...tape.items];
  return (
    <div className="tape" aria-label="市場行情">
      <div className="tape-viewport">
        <div className="tape-track">
          {loop.map((item, index) => (
            <TapeCell key={`${item.display}-${index}`} item={item} />
          ))}
        </div>
      </div>
      <div className="tape-pin">
        {tape.fx ? (
          <Link href={`/instrument/${encodeURIComponent(tape.fx.display)}`} prefetch className="tape-fx">
            <span>{tape.fx.display}</span>
            <span className="tabular">{tape.fx.last ?? "—"}</span>
          </Link>
        ) : null}
        <span className="chip chip-delay" title={tape.fx?.lastUpdateLabel ?? undefined}>
          {tape.delayLabel}
        </span>
      </div>
    </div>
  );
}
