"use client";

import { useActionState, useMemo, useState } from "react";
import { createBuyAction, createDepositAction, type EntryState } from "@/app/actions/entry";
import { deriveAmountUsd } from "@/ledger/create-cash-flow";
import { deriveCostUsd } from "@/ledger/create-trade";
import { formatMoney } from "@/lib/format";

const initial: EntryState = {};

export function EntryForm({
  members,
  accounts,
  defaultMemberId,
  defaultAccountId,
  today,
}: {
  members: { id: string; displayName: string }[];
  accounts: { id: string; name: string; kind: string }[];
  defaultMemberId: string;
  defaultAccountId: string;
  today: string;
}) {
  const [tab, setTab] = useState<"deposit" | "buy">("deposit");
  const [depositState, depositAction, depositPending] = useActionState(createDepositAction, initial);
  const [buyState, buyAction, buyPending] = useActionState(createBuyAction, initial);
  const [hkd, setHkd] = useState("");
  const [fx, setFx] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  const usd = useMemo(() => {
    try {
      if (!hkd || !fx) return "";
      return formatMoney(deriveAmountUsd(hkd, fx));
    } catch {
      return "";
    }
  }, [hkd, fx]);

  const cost = useMemo(() => {
    try {
      if (!qty || !price) return "";
      return formatMoney(deriveCostUsd(qty, price));
    } catch {
      return "";
    }
  }, [qty, price]);

  return (
    <div className="stack">
      <div>
        <h1 className="display">記一筆</h1>
        <p className="muted" style={{ marginTop: 12 }}>
          記帳唔係下單。
        </p>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={tab === "deposit" ? "chip chip-active" : "chip"}
          onClick={() => setTab("deposit")}
        >
          入金
        </button>
        <button
          type="button"
          className={tab === "buy" ? "chip chip-active" : "chip"}
          onClick={() => setTab("buy")}
        >
          加倉
        </button>
      </div>

      {tab === "deposit" ? (
        <form className="card form-grid" action={depositAction}>
          <div className="field">
            <label htmlFor="memberId">邊個</label>
            <select className="select" id="memberId" name="memberId" defaultValue={defaultMemberId}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="amountHkd">港元金額</label>
            <input
              className="input"
              id="amountHkd"
              name="amountHkd"
              inputMode="decimal"
              required
              value={hkd}
              onChange={(e) => setHkd(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="fxRate">匯率（HKD / USD）</label>
            <input
              className="input"
              id="fxRate"
              name="fxRate"
              inputMode="decimal"
              required
              placeholder="例如 7.82 或示範用 1"
              value={fx}
              onChange={(e) => setFx(e.target.value)}
            />
          </div>
          <p className="meta muted">USD {usd || "—"}（寫入時一併存）</p>
          <div className="field">
            <label htmlFor="occurredOn">日期</label>
            <input className="input" id="occurredOn" name="occurredOn" type="date" required defaultValue={today} />
          </div>
          {depositState.error ? <p className="alert">{depositState.error}</p> : null}
          {depositState.ok ? <p className="ok">{depositState.ok}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={depositPending}>
            記入入金
          </button>
        </form>
      ) : (
        <form className="card form-grid" action={buyAction}>
          <div className="field">
            <label htmlFor="ledgerAccountId">帳簿</label>
            <select
              className="select"
              id="ledgerAccountId"
              name="ledgerAccountId"
              defaultValue={defaultAccountId}
            >
              {accounts.map((account) => (
                <option key={account.id} value={account.id}>
                  {account.name}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="symbol">代碼</label>
            <input className="input" id="symbol" name="symbol" required placeholder="NVDA" />
          </div>
          <div className="field">
            <label htmlFor="quantity">數量</label>
            <input
              className="input"
              id="quantity"
              name="quantity"
              inputMode="decimal"
              required
              value={qty}
              onChange={(e) => setQty(e.target.value)}
            />
          </div>
          <div className="field">
            <label htmlFor="price">價格（USD）</label>
            <input
              className="input"
              id="price"
              name="price"
              inputMode="decimal"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
            />
          </div>
          <p className="meta muted">成本 USD {cost || "—"} · 手續費 0</p>
          <div className="field">
            <label htmlFor="occurredOnBuy">日期</label>
            <input
              className="input"
              id="occurredOnBuy"
              name="occurredOn"
              type="date"
              required
              defaultValue={today}
            />
          </div>
          <div className="field">
            <label htmlFor="note">備註（可選）</label>
            <input className="input" id="note" name="note" />
          </div>
          {buyState.error ? <p className="alert">{buyState.error}</p> : null}
          {buyState.ok ? <p className="ok">{buyState.ok}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={buyPending}>
            記入加倉
          </button>
        </form>
      )}
    </div>
  );
}
