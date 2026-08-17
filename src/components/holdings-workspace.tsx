"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { lotRowKey } from "@/lib/lot-row-key";
import { InstrumentKline } from "./instrument-kline";
import { WatchlistPanel, type WatchRow } from "./watchlist-panel";

export type HoldingRow = {
  tradeId: string;
  memberId: string;
  symbol: string;
  quantity: string;
  lastDisplay: string | null;
  percentChange: string | null;
  marketValueUsd: string | null;
  costUsd: string;
  planLimited: boolean;
  isEtfProxy: boolean;
  delayLabel: string;
  lastUpdateLabel: string | null;
  name: string | null;
  tags: string[];
};

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

export function HoldingsWorkspace({
  lots,
  watchItems,
  delayLabel,
}: {
  lots: HoldingRow[];
  watchItems: WatchRow[];
  delayLabel: string;
}) {
  const [tab, setTab] = useState<"holdings" | "watch">("holdings");
  const [selectedId, setSelectedId] = useState(lots[0] ? lotRowKey(lots[0]) : null);
  const selected = useMemo(
    () => lots.find((lot) => lotRowKey(lot) === selectedId) ?? lots[0] ?? null,
    [lots, selectedId],
  );

  return (
    <div className="stack">
      <div className="tabs-line">
        <button
          type="button"
          className={tab === "holdings" ? "tab tab-active" : "tab"}
          onClick={() => setTab("holdings")}
        >
          持倉
        </button>
        <button
          type="button"
          className={tab === "watch" ? "tab tab-active" : "tab"}
          onClick={() => setTab("watch")}
        >
          關注
        </button>
      </div>
      {tab === "watch" ? <WatchlistPanel items={watchItems} delayLabel={delayLabel} /> : null}
      {tab === "holdings" && lots.length === 0 ? (
        <section className="card">
          <p className="empty">未有持倉</p>
        </section>
      ) : null}
      {tab === "holdings" && lots.length > 0 ? (
    <div className="holdings-split">
      <section className="card">
        <table className="table">
          <thead>
            <tr>
              <th>代碼</th>
              <th>數量</th>
              <th>現價</th>
              <th>今日</th>
              <th>市值</th>
              <th>成本</th>
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr
                key={lotRowKey(lot)}
                className={selected && lotRowKey(selected) === lotRowKey(lot) ? "selected" : undefined}
                onClick={() => setSelectedId(lotRowKey(lot))}
              >
                <td>
                  <Link href={`/instrument/${encodeURIComponent(lot.symbol)}`}>{lot.symbol}</Link>
                </td>
                <td className="tabular">{formatMoney(lot.quantity, 4)}</td>
                <td className="tabular">{lot.lastDisplay ?? "—"}</td>
                <td className={`tabular ${changeClass(lot.percentChange)}`}>
                  {lot.lastDisplay ? (lot.percentChange ?? "—") : "—"}
                </td>
                <td className="tabular">{lot.marketValueUsd ? formatMoney(lot.marketValueUsd) : "—"}</td>
                <td className="tabular">{formatMoney(lot.costUsd)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {selected ? (
        <InstrumentKline
          display={selected.symbol}
          name={selected.name}
          last={selected.lastDisplay}
          percentChange={selected.percentChange}
          delayLabel={selected.lastDisplay ? delayLabel : selected.delayLabel}
          lastUpdateLabel={selected.lastUpdateLabel}
          isEtfProxy={selected.isEtfProxy}
          planLimited={selected.planLimited}
          tags={selected.tags}
        />
      ) : null}
    </div>
      ) : null}
    </div>
  );
}
