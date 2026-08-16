"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { formatMoney } from "@/lib/format";

type Filter = "me" | "all" | string;

const COST_ONLY = "暫時用買入價，未有市場價";

function holdingsMeta(count: number): string {
  const words = ["零", "一", "兩", "三", "四", "五", "六", "七", "八", "九", "十"];
  if (count >= 1 && count <= 10) {
    return `${words[count]}筆持股`;
  }
  return `${count}筆持股`;
}

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
      return { nav: all.navUsd, cash: all.cashUsd, lots };
    }
    const memberId = filter === "me" ? currentMemberId : filter;
    const row = byMember.find((item) => item.memberId === memberId);
    return {
      nav: row?.navUsd ?? "0",
      cash: row?.cashUsd ?? "0",
      lots: lots.filter((lot) => lot.memberId === memberId),
    };
  }, [filter, all, lots, byMember, currentMemberId]);

  const emptyBook = lots.length === 0 && Number(all.navUsd) === 0 && Number(all.cashUsd) === 0;
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
        {emptyBook ? null : <span className="chip chip-delay">{COST_ONLY}</span>}
      </div>

      {emptyBook ? (
        <>
          <div className="grid grid-metrics">
            <section className="card">
              <div className="meta muted">資產淨值</div>
              <div className="display tabular" style={{ marginTop: 8 }}>
                US$ 0.00
              </div>
              <div className="metric-sub">今日 —</div>
            </section>
            <section className="card">
              <div className="meta muted">可用資金</div>
              <div className="display tabular" style={{ marginTop: 8 }}>
                0
              </div>
              <div className="metric-sub">現金，未計持股</div>
            </section>
          </div>
          <section className="card stack">
            <h2 className="title">未有入金</h2>
            <p className="muted">下一步：記一筆入金。記帳唔係下單。</p>
            <div>
              <Link href="/entry" className="btn btn-primary">
                記一筆入金
              </Link>
            </div>
          </section>
        </>
      ) : (
        <>
          <div className="grid grid-metrics">
            <section className="card">
              <div className="meta muted">資產淨值</div>
              <div className="display tabular" style={{ marginTop: 8 }}>
                US$ {formatMoney(shown.nav)}
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
                {shown.lots.length === 0 ? "未有持倉" : holdingsMeta(shown.lots.length)}
              </span>
            </div>
            {shown.lots.length === 0 ? (
              <p className="empty">未有持倉</p>
            ) : (
              <table className="table">
                <thead>
                  <tr>
                    <th>代碼</th>
                    <th>記落邊個人</th>
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
                      <td className="muted">{COST_ONLY}</td>
                      <td className="tabular">{formatMoney(lot.costUsd)}</td>
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
