"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { AllocationChart } from "./allocation-chart";
import { EmptyPanel } from "./empty-panel";
import { HoldingDelete } from "./holding-delete";
import { Icon } from "./icons";
import { InstrumentKline } from "./instrument-kline";
import { InstrumentLabel } from "./instrument-label";
import { WatchlistPanel, type WatchRow } from "./watchlist-panel";
import { formatQty, formatSharePercent, formatUsd } from "@/lib/format";
import { buildAllocation, type AllocDimension } from "@/lib/holdings-allocation";
import { lotRowKey } from "@/lib/lot-row-key";

export type HoldingRow = {
  tradeId: string;
  memberId: string | null;
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
  splitLabel?: string | null;
  closed?: boolean;
  joint?: boolean;
  sharePercent?: string | null;
  memberLabel?: string;
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
const COPY = {
  eyebrow: "倉位",
  holdings: "持倉",
  watch: "關注",
  alloc: "分佈",
  empty: "未有持倉，記一筆就可以加倉。",
  closed: "已平倉",
  byMarket: "按市場",
  byCcy: "按幣種",
  byMember: "按成員",
  missing: (n: number) => `${n} 隻暫時用買入價，未有市場價`,
};

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
  const [tab, setTab] = useState<"holdings" | "watch" | "alloc">("holdings");
  const openLots = lots.filter((lot) => !lot.closed);
  const [selectedId, setSelectedId] = useState(openLots[0] ? lotRowKey(openLots[0]) : null);
  const selected = useMemo(
    () => openLots.find((lot) => lotRowKey(lot) === selectedId) ?? openLots[0] ?? null,
    [openLots, selectedId],
  );
  const [dimension, setDimension] = useState<AllocDimension>("market");
  const alloc = useMemo(() => buildAllocation(openLots, dimension), [openLots, dimension]);
  const missing = openLots.filter((lot) => !lot.lastDisplay).length;

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-title">
          <p className="page-eyebrow">{COPY.eyebrow}</p>
          <h1 className="page-title">{COPY.holdings}</h1>
        </div>
      </div>
      <div className="tabs-line">
        <button type="button" className={tab === "holdings" ? "tab tab-active" : "tab"} onClick={() => setTab("holdings")}>
          {COPY.holdings}
        </button>
        <button type="button" className={tab === "watch" ? "tab tab-active" : "tab"} onClick={() => setTab("watch")}>
          {COPY.watch}
        </button>
        <button type="button" className={tab === "alloc" ? "tab tab-active" : "tab"} onClick={() => setTab("alloc")}>
          {COPY.alloc}
        </button>
      </div>
      {tab === "watch" ? <WatchlistPanel items={watchItems} /> : null}
      {tab === "holdings" && openLots.length === 0 && closedLots.length === 0 ? (
        <EmptyPanel sentence={COPY.empty} actionLabel="加持倉" icon="empty-holdings" title="未有持倉" />
      ) : null}
      {tab === "holdings" && partialNav && openLots.length > 0 ? (
        <p className="meta muted">部分市值 · 未有標記嘅持股唔計入 NAV</p>
      ) : null}
      {tab === "holdings" && missing > 0 ? (
        <div className="banner">
          <Icon name="info" />
          {COPY.missing(missing)}
        </div>
      ) : null}
      {tab === "holdings" && openLots.length > 0 ? (
        <div className="grid-12">
          <section className="card card-flush col-5">
            <table className="table table-cards">
              <thead>
                <tr>
                  <th>標的</th>
                  <th className="num">數量</th>
                  <th className="num">現價</th>
                  <th className="num">市值</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {openLots.map((lot) => (
                  <tr
                    key={lotRowKey(lot)}
                    className={selected && lotRowKey(selected) === lotRowKey(lot) ? "selected row-entry" : "row-entry"}
                    onClick={() => setSelectedId(lotRowKey(lot))}
                  >
                    <td>
                      <Link href={`/instrument/${encodeURIComponent(lot.symbol)}`}>
                        <InstrumentLabel ticker={lot.symbol} name={lot.name} />
                      </Link>
                      <div className="meta muted">
                        {lot.memberLabel ?? "—"}
                        {lot.joint && lot.sharePercent ? ` ${formatSharePercent(lot.sharePercent)}` : ""}
                        {!lot.lastDisplay ? ` · ${NO_MARK}` : ""}
                      </div>
                    </td>
                    <td className="num card-meta" data-label="數量">
                      {formatQty(lot.quantity)}
                      {lot.splitLabel ? <span className="meta muted"> 拆股 {lot.splitLabel}</span> : null}
                    </td>
                    <td className="num card-meta" data-label="現價">
                      {lot.lastDisplay ?? "—"}
                      {lot.lastDisplay ? (
                        <span className={`meta ${changeClass(lot.percentChange)}`}> {lot.percentChange ?? "—"}</span>
                      ) : null}
                    </td>
                    <td className="num card-primary" data-label="市值">
                      {lot.lastDisplay
                        ? lot.marketValueUsd
                          ? formatUsd(lot.marketValueUsd)
                          : "—"
                        : formatUsd(lot.costUsd)}
                    </td>
                    <td className="card-action">
                      <HoldingDelete tradeId={lot.tradeId} memberId={lot.memberId} symbol={lot.symbol} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
          {selected ? (
            <div className="col-7 sticky-kline holdings-kline">
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
            </div>
          ) : null}
        </div>
      ) : null}
      {tab === "holdings" && closedLots.length > 0 ? (
        <details className="card">
          <summary className="card-title">
            {COPY.closed}（{closedLots.length}）
          </summary>
          <table className="table">
            <thead>
              <tr>
                <th>標的</th>
                <th className="num">數量</th>
                <th className="num">成本</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {closedLots.map((lot) => (
                <tr key={lotRowKey(lot)}>
                  <td>
                    <InstrumentLabel ticker={lot.symbol} name={lot.name} />
                  </td>
                  <td className="num">{formatQty(lot.quantity)}</td>
                  <td className="num">{formatUsd(lot.costUsd)}</td>
                  <td>
                    <HoldingDelete tradeId={lot.tradeId} memberId={lot.memberId} symbol={lot.symbol} closed />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      ) : null}
      {tab === "alloc" ? (
        openLots.length === 0 ? (
          <EmptyPanel sentence={COPY.empty} actionLabel="記一筆" icon="empty-holdings" title="未有持倉" />
        ) : (
          <div className="grid-12">
            <section className="card col-5">
              <div className="seg" style={{ "--seg-n": 3, "--seg-i": dimension === "market" ? 0 : dimension === "currency" ? 1 : 2 } as CSSProperties}>
                <span className="seg-thumb" aria-hidden />
                <button type="button" aria-pressed={dimension === "market"} onClick={() => setDimension("market")}>
                  {COPY.byMarket}
                </button>
                <button type="button" aria-pressed={dimension === "currency"} onClick={() => setDimension("currency")}>
                  {COPY.byCcy}
                </button>
                <button type="button" aria-pressed={dimension === "member"} onClick={() => setDimension("member")}>
                  {COPY.byMember}
                </button>
              </div>
              <AllocationChart
                result={alloc}
                title={dimension === "market" ? COPY.byMarket : dimension === "currency" ? COPY.byCcy : COPY.byMember}
              />
            </section>
            <section className="card card-flush col-7">
              <table className="table">
                <thead>
                  <tr>
                    <th>分組</th>
                    <th className="num">市值</th>
                    <th className="num">佔比</th>
                  </tr>
                </thead>
                <tbody>
                  {alloc.slices.map((slice) => (
                    <tr key={slice.key}>
                      <td>{slice.label}</td>
                      <td className="num">{formatUsd(slice.value.toFixed(2))}</td>
                      <td className="num">{slice.pct.toFixed(1)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          </div>
        )
      ) : null}
    </div>
  );
}
