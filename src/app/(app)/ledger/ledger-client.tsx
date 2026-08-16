"use client";

import { useState } from "react";
import { formatMoney } from "@/lib/format";

export function LedgerClient({
  cashFlows,
  trades,
}: {
  cashFlows: {
    id: string;
    memberName: string;
    amountUsd: string;
    amountHkd: string;
    fxRate: string;
    occurredOn: string;
  }[];
  trades: {
    id: string;
    symbol: string;
    quantity: string;
    price: string;
    occurredOn: string;
    note: string | null;
  }[];
}) {
  const [tab, setTab] = useState<"cash" | "trades">("cash");

  return (
    <div className="stack">
      <h1 className="display">流水</h1>
      <div className="tabs">
        <button
          type="button"
          className={tab === "cash" ? "chip chip-active" : "chip"}
          onClick={() => setTab("cash")}
        >
          出入金
        </button>
        <button
          type="button"
          className={tab === "trades" ? "chip chip-active" : "chip"}
          onClick={() => setTab("trades")}
        >
          買賣
        </button>
      </div>
      <section className="card">
        {tab === "cash" ? (
          cashFlows.length === 0 ? (
            <p className="empty">未有出入金</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>日期</th>
                  <th>成員</th>
                  <th>HKD</th>
                  <th>匯率</th>
                  <th>USD</th>
                </tr>
              </thead>
              <tbody>
                {cashFlows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.occurredOn}</td>
                    <td>{row.memberName}</td>
                    <td className="tabular">{formatMoney(row.amountHkd)}</td>
                    <td className="tabular">{formatMoney(row.fxRate, 4)}</td>
                    <td className="tabular">{formatMoney(row.amountUsd)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : trades.length === 0 ? (
          <p className="empty">未有買賣</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>日期</th>
                <th>代碼</th>
                <th>數量</th>
                <th>價格</th>
                <th>備註</th>
              </tr>
            </thead>
            <tbody>
              {trades.map((row) => (
                <tr key={row.id}>
                  <td>{row.occurredOn}</td>
                  <td>{row.symbol}</td>
                  <td className="tabular">{formatMoney(row.quantity, 4)}</td>
                  <td className="tabular">{formatMoney(row.price)}</td>
                  <td className="muted">{row.note ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
