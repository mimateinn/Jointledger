"use client";

import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";

type Filter = "me" | "all" | "joint" | string;

export function OverviewClient({
  currentMemberId,
  members,
  accounts,
  all,
  byMember,
  lots,
}: {
  currentMemberId: string;
  members: { id: string; displayName: string }[];
  accounts: { id: string; memberId: string | null; name: string; kind: string }[];
  all: { cashUsd: string; navUsd: string };
  byMember: { memberId: string; displayName: string; cashUsd: string; navUsd: string }[];
  lots: {
    tradeId: string;
    memberId: string;
    ledgerAccountId: string;
    symbol: string;
    quantity: string;
    costUsd: string;
  }[];
}) {
  const [filter, setFilter] = useState<Filter>("all");

  const chips = [
    { id: "me", label: "我" },
    { id: "all", label: "全體" },
    ...members.map((m) => ({ id: m.id, label: m.displayName })),
    { id: "joint", label: "聯名" },
  ];

  const shown = useMemo(() => {
    if (filter === "all") {
      return { nav: all.navUsd, cash: all.cashUsd, lots };
    }
    if (filter === "joint") {
      const jointLots = lots.filter((lot) => {
        const account = accounts.find((a) => a.id === lot.ledgerAccountId);
        return account?.kind === "joint";
      });
      return { nav: "0", cash: "0", lots: jointLots };
    }
    const memberId = filter === "me" ? currentMemberId : filter;
    const row = byMember.find((item) => item.memberId === memberId);
    return {
      nav: row?.navUsd ?? "0",
      cash: row?.cashUsd ?? "0",
      lots: lots.filter((lot) => lot.memberId === memberId),
    };
  }, [filter, all, lots, accounts, byMember, currentMemberId]);

  const accountName = (id: string) => accounts.find((a) => a.id === id)?.name ?? "—";

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
        <span className="chip chip-delay">未有現價</span>
      </div>

      <div className="grid grid-metrics">
        <section className="card">
          <div className="meta muted">全體資產</div>
          <div className="display tabular" style={{ marginTop: 8 }}>
            US$ {formatMoney(filter === "all" ? all.navUsd : shown.nav)}
          </div>
        </section>
        {byMember.map((row) => (
          <section className="card" key={row.memberId}>
            <div className="meta muted">{row.displayName}</div>
            <div className="display tabular" style={{ marginTop: 8 }}>
              {formatMoney(row.navUsd)}
            </div>
            <div className="metric-sub">
              可用 {formatMoney(row.cashUsd)} · 現金，未計持倉
            </div>
          </section>
        ))}
      </div>

      <section className="card">
        <div className="row" style={{ marginBottom: 16 }}>
          <h2 className="title">持倉摘要</h2>
          <span className="meta muted">
            {shown.lots.length === 0 ? "未有持倉" : `${shown.lots.length} 筆未平倉`}
          </span>
        </div>
        {shown.lots.length === 0 ? (
          <p className="empty">未有持倉</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>代碼</th>
                <th>帳簿</th>
                <th>數量</th>
                <th>現價</th>
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              {shown.lots.map((lot) => (
                <tr key={lot.tradeId}>
                  <td>{lot.symbol}</td>
                  <td>
                    <span className="chip">{accountName(lot.ledgerAccountId)}</span>
                  </td>
                  <td className="tabular">{formatMoney(lot.quantity, 4)}</td>
                  <td className="muted">未有現價</td>
                  <td className="tabular">{formatMoney(lot.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
