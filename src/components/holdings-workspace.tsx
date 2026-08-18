"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatQty, formatUsd } from "@/lib/format";
import { lotRowKey } from "@/lib/lot-row-key";
import { EmptyPanel } from "./empty-panel";
import { HoldingDelete } from "./holding-delete";
import { InstrumentKline } from "./instrument-kline";
import { InstrumentLabel } from "./instrument-label";
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
  closed?: boolean;
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

const NO_MARK = "暫時用買入價，未有市場價";

export function HoldingsWorkspace({
  lots,
  closedLots,
  watchItems,
  delayLabel,
  partialNav = false,
}: {
  lots: HoldingRow[];
  closedLots: HoldingRow[];
  watchItems: WatchRow[];
  delayLabel: string;
  partialNav?: boolean;
}) {
  const [tab, setTab] = useState<"holdings" | "watch">("holdings");
  const openLots = lots.filter((lot) => !lot.closed);
  const [selectedId, setSelectedId] = useState(openLots[0] ? lotRowKey(openLots[0]) : null);
  const selected = useMemo(
    () => openLots.find((lot) => lotRowKey(lot) === selectedId) ?? openLots[0] ?? null,
    [openLots, selectedId],
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
      {tab === "watch" ? <WatchlistPanel items={watchItems} /> : null}
      {tab === "holdings" && openLots.length === 0 && closedLots.length === 0 ? (
        <EmptyPanel sentence="未有持倉，記一筆就可以加倉。" actionLabel="加持倉" />
      ) : null}
      {tab === "holdings" && partialNav && openLots.length > 0 ? (
        <p className="meta muted">部分市值 · 未有標記嘅持股唔計入 NAV</p>
      ) : null}
      {tab === "holdings" && openLots.length > 0 ? (
        <div className="holdings-split">
          <section className="card">
            <table className="table">
              <thead>
                <tr>
                  <th>標的</th>
                  <th>數量</th>
                  <th>現價</th>
                  <th>今日</th>
                  <th>市值</th>
                  <th>成本</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openLots.map((lot) => (
                  <tr
                    key={lotRowKey(lot)}
                    className={selected && lotRowKey(selected) === lotRowKey(lot) ? "selected" : undefined}
                    onClick={() => setSelectedId(lotRowKey(lot))}
                  >
                    <td>
                      <Link href={`/instrument/${encodeURIComponent(lot.symbol)}`}>
                        <InstrumentLabel ticker={lot.symbol} name={lot.name} />
                      </Link>
                    </td>
                    <td className="tabular">{formatQty(lot.quantity)}</td>
                    <td className="tabular">{lot.lastDisplay ?? NO_MARK}</td>
                    <td className={`tabular ${lot.lastDisplay ? changeClass(lot.percentChange) : "muted"}`}>
                      {lot.lastDisplay ? (lot.percentChange ?? "—") : ""}
                    </td>
                    <td className="tabular">
                      {lot.lastDisplay
                        ? lot.marketValueUsd
                          ? formatUsd(lot.marketValueUsd)
                          : "—"
                        : formatUsd(lot.costUsd)}
                    </td>
                    <td className="tabular">{formatUsd(lot.costUsd)}</td>
                    <td>
                      <HoldingDelete tradeId={lot.tradeId} memberId={lot.memberId} symbol={lot.symbol} />
                    </td>
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
      {tab === "holdings" && closedLots.length > 0 ? (
        <section className="card">
          <h2 className="title">已平倉</h2>
          <table className="table">
            <thead>
              <tr>
                <th>標的</th>
                <th>數量</th>
                <th>成本</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {closedLots.map((lot) => (
                <tr key={lotRowKey(lot)}>
                  <td>
                    <InstrumentLabel ticker={lot.symbol} name={lot.name} />
                  </td>
                  <td className="tabular">{formatQty(lot.quantity)}</td>
                  <td className="tabular">{formatUsd(lot.costUsd)}</td>
                  <td>
                    <HoldingDelete
                      tradeId={lot.tradeId}
                      memberId={lot.memberId}
                      symbol={lot.symbol}
                      closed
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : null}
    </div>
  );
}
