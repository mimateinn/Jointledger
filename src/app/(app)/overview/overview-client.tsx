"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DelayBadge } from "@/components/delay-badge";
import { InstrumentLabel } from "@/components/instrument-label";
import { formatMoney, formatUsd } from "@/lib/format";
import { lotRowKey } from "@/lib/lot-row-key";

type Filter = "me" | "all" | "joint" | string;

function holdingsMeta(count: number): string {
  const words = ["零", "一", "兩", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (count >= 1 && count <= 10) {
    return `${words[count]}筆持股`;
  }
  return `${count}筆持股`;
}

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

export function OverviewClient({
  currentMemberId,
  members,
  accounts,
  all,
  joint,
  byMember,
  lots,
  delayLabel,
  asOfLabel,
}: {
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  accounts: { id: string; memberId: string | null; name: string; kind: string }[];
  all: { cashUsd: string; navUsd: string; partial: boolean };
  joint: { cashUsd: string; navUsd: string; partial: boolean };
  byMember: { memberId: string; displayName: string; cashUsd: string; navUsd: string; partial: boolean }[];
  lots: {
    tradeId: string;
    memberId: string;
    ledgerAccountId: string;
    symbol: string;
    name: string | null;
    quantity: string;
    costUsd: string;
    lastDisplay: string | null;
    percentChange: string | null;
    marketValueUsd: string | null;
  }[];
  delayLabel: string;
  asOfLabel: string;
}) {
  const [filter, setFilter] = useState<Filter>("me");
  const jointOpened = accounts.some((account) => account.kind === "joint");

  const chips = [
    { id: "me", label: "我" },
    { id: "all", label: "全體" },
    ...members.map((m) => ({ id: m.id, label: m.displayName })),
    ...(jointOpened ? [{ id: "joint", label: "聯名" }] : []),
  ];

  const shown = useMemo(() => {
    if (filter === "all") {
      return { nav: all.navUsd, cash: all.cashUsd, lots, partial: all.partial };
    }
    if (filter === "joint") {
      return {
        nav: joint.navUsd,
        cash: joint.cashUsd,
        lots: lots.filter((lot) => accounts.find((account) => account.id === lot.ledgerAccountId)?.kind === "joint"),
        partial: joint.partial,
      };
    }
    const memberId = filter === "me" ? currentMemberId : filter;
    const row = byMember.find((item) => item.memberId === memberId);
    if (!row) {
      return { nav: null, cash: null, lots: [] as typeof lots, partial: false };
    }
    return {
      nav: row.navUsd,
      cash: row.cashUsd,
      lots: lots.filter((lot) => lot.memberId === memberId),
      partial: row.partial,
    };
  }, [filter, all, joint, lots, byMember, currentMemberId, accounts]);

  const emptyBook = lots.length === 0 && Number(all.navUsd) === 0 && Number(all.cashUsd) === 0;
  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";
  const showPrices = !emptyBook && (lots.some((lot) => lot.lastDisplay) || lots.length > 0);

  return (
    <div>
      <div className="page-head">
        <div>
          <h1 className="display">總覽</h1>
          <div className="chip-row">
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={filter === chip.id ? "chip chip-active" : "chip"}
                onClick={() => setFilter(chip.id)}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>
        {showPrices ? <DelayBadge label={delayLabel} /> : null}
      </div>

      {emptyBook ? (
        <section className="card stack">
          <div className="meta muted">資產淨值</div>
          <div className="display tabular">US$ 0.00</div>
          <p className="meta muted">{asOfLabel}</p>
          <p className="body">未有入金，記一筆就可以開始。</p>
          <div>
            <Link href="/entry" prefetch className="btn btn-primary">
              入金
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="grid grid-metrics">
            <section className="card">
              <div className="meta muted">資產淨值</div>
              {shown.nav == null ? (
                <div className="skeleton skeleton-nav" style={{ marginTop: 8 }} />
              ) : (
                <div className="display tabular" style={{ marginTop: 8 }}>
                  {formatUsd(shown.nav)}
                </div>
              )}
              <p className="meta muted">{asOfLabel}</p>
              {shown.partial ? <div className="metric-sub">部分市值</div> : null}
            </section>
            {byMember.map((row) => (
              <section className="card" key={row.memberId}>
                <div className="meta muted">{row.displayName}</div>
                <div className="display tabular" style={{ marginTop: 8 }}>
                  {formatUsd(row.navUsd)}
                </div>
                <div className="metric-sub">
                  可用 {formatUsd(row.cashUsd)} · 現金，未計持倉
                  {row.partial ? " · 部分市值" : ""}
                </div>
              </section>
            ))}
          </div>

          <section className="card">
            <div className="row" style={{ marginBottom: 16 }}>
              <h2 className="title">持倉摘要</h2>
              <span className="meta muted">
                {shown.lots.length === 0 ? "未有持倉" : holdingsMeta(shown.lots.length)}
              </span>
            </div>
            {shown.lots.length === 0 ? (
              <p className="empty">未有持倉</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>標的</th>
                    <th>記落邊個人</th>
                    <th>數量</th>
                    <th>現價</th>
                    <th>今日</th>
                    <th>市值</th>
                    <th>成本</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.lots.map((lot) => (
                    <tr key={lotRowKey(lot)}>
                      <td>
                        <Link href={`/instrument/${encodeURIComponent(lot.symbol)}`}>
                          <InstrumentLabel ticker={lot.symbol} name={lot.name} />
                        </Link>
                      </td>
                      <td>
                        <span className="chip">{accountName(lot.ledgerAccountId)}</span>
                      </td>
                      <td className="tabular">{formatMoney(lot.quantity, 4)}</td>
                      <td className="tabular">{lot.lastDisplay ?? "—"}</td>
                      <td className={`tabular ${changeClass(lot.percentChange)}`}>
                        {lot.lastDisplay ? (lot.percentChange ?? "—") : "—"}
                      </td>
                      <td className="tabular">
                        {lot.marketValueUsd ? formatUsd(lot.marketValueUsd) : "—"}
                      </td>
                      <td className="tabular">{formatUsd(lot.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        </>
      )}
    </div>
  );
}
