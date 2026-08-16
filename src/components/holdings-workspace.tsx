"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";
import { InstrumentKline } from "./instrument-kline";

export type HoldingRow = {
  tradeId: string;
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
  delayLabel,
}: {
  lots: HoldingRow[];
  delayLabel: string;
}) {
  const [selectedId, setSelectedId] = useState(lots[0]?.tradeId ?? null);
  const selected = useMemo(
    () => lots.find((lot) => lot.tradeId === selectedId) ?? lots[0] ?? null,
    [lots, selectedId],
  );

  return (
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
                key={lot.tradeId}
                className={selected?.tradeId === lot.tradeId ? "selected" : undefined}
                onClick={() => setSelectedId(lot.tradeId)}
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
  );
}
