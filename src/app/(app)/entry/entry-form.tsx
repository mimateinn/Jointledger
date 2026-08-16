"use client";

import { useActionState, useMemo, useState } from "react";
import { createBuyAction, createDepositAction, type EntryState } from "@/app/actions/entry";
import { deriveAmountUsd } from "@/ledger/create-cash-flow";
import { formatMoney } from "@/lib/format";

const initial: EntryState = {};
const TABS = ["入金", "買入", "賣出", "出金"] as const;
type Tab = (typeof TABS)[number];

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
  const [tab, setTab] = useState<Tab>("入金");
  const [depositState, depositAction, depositPending] = useActionState(createDepositAction, initial);
  const [buyState, buyAction, buyPending] = useActionState(createBuyAction, initial);
  const [hkd, setHkd] = useState("");
  const [fx, setFx] = useState("");
  const [symbol, setSymbol] = useState("");
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

  return (
    <div className="stack">
      <h1 className="display">記一筆</h1>

      <div className="tabs-line">
        {TABS.map((item) => (
          <button
            key={item}
            type="button"
            className={tab === item ? "tab tab-active" : "tab"}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>

      {tab === "入金" ? (
        <form key="deposit" className="card form-grid" action={depositAction}>
          <div className="field">
            <label htmlFor="memberId">記落邊個人</label>
            <select className="select" id="memberId" name="memberId" defaultValue={defaultMemberId}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.displayName}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="occurredOn">日期</label>
            <input className="input" id="occurredOn" name="occurredOn" type="date" required defaultValue={today} />
          </div>
          <div className="field">
            <label htmlFor="amountHkd">港幣</label>
            <input
              className="input"
              id="amountHkd"
              name="amountHkd"
              inputMode="decimal"
              required
              value={hkd}
              onChange={(e) => setHkd(e.target.value)}
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="fxRate">匯率</label>
            <input
              className="input"
              id="fxRate"
              name="fxRate"
              inputMode="decimal"
              required
              placeholder="7.82"
              value={fx}
              onChange={(e) => setFx(e.target.value)}
              autoComplete="off"
            />
            <p className="meta muted">港紙兌美金，例如 7.82。填 1 即當美金入帳。</p>
          </div>
          <div className="field">
            <label htmlFor="amountUsd">美金</label>
            <input className="input" id="amountUsd" readOnly value={usd} tabIndex={-1} />
            <p className="meta muted">會一齊存做美金。</p>
          </div>
          {depositState.error ? <p className="alert">{depositState.error}</p> : null}
          {depositState.ok ? <p className="ok">{depositState.ok}</p> : null}
          <div className="submit-row">
            <button className="btn btn-primary" type="submit" disabled={depositPending}>
              記入
            </button>
            <p className="meta muted">記帳唔係下單。唔會連接任何券商。</p>
          </div>
        </form>
      ) : null}

      {tab === "買入" ? (
        <form key="buy" className="card form-grid" action={buyAction}>
          <div className="field">
            <label htmlFor="ledgerAccountId">記落邊個人</label>
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
            <label htmlFor="symbol">代碼</label>
            <input
              className="input"
              id="symbol"
              name="symbol"
              required
              placeholder="NVDA"
              value={symbol}
              onChange={(e) => setSymbol(e.target.value)}
              autoComplete="off"
            />
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
              autoComplete="off"
            />
          </div>
          <div className="field">
            <label htmlFor="price">價格</label>
            <input
              className="input"
              id="price"
              name="price"
              inputMode="decimal"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              autoComplete="off"
            />
          </div>
          {buyState.error ? <p className="alert">{buyState.error}</p> : null}
          {buyState.ok ? <p className="ok">{buyState.ok}</p> : null}
          <div className="submit-row">
            <button className="btn btn-primary" type="submit" disabled={buyPending}>
              記入
            </button>
            <p className="meta muted">記帳唔係下單。唔會連接任何券商。</p>
          </div>
        </form>
      ) : null}
    </div>
  );
}
