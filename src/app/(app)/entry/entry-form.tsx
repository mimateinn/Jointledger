"use client";

import { useActionState, useMemo, useState } from "react";
import { createBookkeepingAction, createBuyAction, createDepositAction, type EntryState } from "@/app/actions/entry";
import { SubmitButton } from "@/components/submit-button";
import { deriveAmountUsd } from "@/ledger/create-cash-flow";
import { formatUsd } from "@/lib/format";

const initial: EntryState = {};
const TABS = ["入金", "買入", "賣出", "出金", "調整"] as const;
type Tab = (typeof TABS)[number];
type BookkeepingKind = "adjustment" | "split";

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
  const [depositState, depositAction] = useActionState(createDepositAction, initial);
  const [buyState, buyAction] = useActionState(createBuyAction, initial);
  const [bookState, bookAction] = useActionState(createBookkeepingAction, initial);
  const [bookKind, setBookKind] = useState<BookkeepingKind>("adjustment");
  const [hkd, setHkd] = useState("");
  const [fx, setFx] = useState("");
  const [symbol, setSymbol] = useState("");
  const [qty, setQty] = useState("");
  const [price, setPrice] = useState("");

  const usd = useMemo(() => {
    try {
      if (!hkd || !fx) return "";
      return formatUsd(deriveAmountUsd(hkd, fx));
    } catch {
      return "";
    }
  }, [hkd, fx]);

  return (
    <div className="stack">
      <h1 className="title">記一筆</h1>
      {depositState.ok || buyState.ok || bookState.ok ? (
        <p className="ok" role="status">
          {depositState.ok ?? buyState.ok ?? bookState.ok}
        </p>
      ) : (
        <p className="muted">空表都可以用。可以先入金，或者直接加持倉。</p>
      )}

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
            <label htmlFor="memberId">邊個倉</label>
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
            <SubmitButton pendingLabel="儲存中">記入</SubmitButton>
            <p className="meta muted">記帳唔係下單。唔會連接任何券商。</p>
          </div>
        </form>
      ) : null}

      {tab === "買入" ? (
        <form key="buy" className="card form-grid" action={buyAction}>
          <div className="field">
            <label htmlFor="ledgerAccountId">邊個倉</label>
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
            <SubmitButton pendingLabel="儲存中">記入</SubmitButton>
            <p className="meta muted">記帳唔係下單。唔會連接任何券商。</p>
          </div>
        </form>
      ) : null}

      {tab === "調整" ? (
        <form key="bookkeeping" className="card form-grid" action={bookAction}>
          <div className="field">
            <label htmlFor="bookKind">種類</label>
            <select
              className="select"
              id="bookKind"
              name="kind"
              value={bookKind}
              onChange={(e) => setBookKind(e.target.value as BookkeepingKind)}
            >
              <option value="adjustment">人手調整</option>
              <option value="split">拆股</option>
            </select>
          </div>
          <div className="field">
            <label htmlFor="ledgerAccountIdAdj">邊個倉</label>
            <select
              className="select"
              id="ledgerAccountIdAdj"
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
            <label htmlFor="occurredOnAdj">日期</label>
            <input
              className="input"
              id="occurredOnAdj"
              name="occurredOn"
              type="date"
              required
              defaultValue={today}
            />
          </div>
          {bookKind === "split" ? (
            <>
              <div className="field">
                <label htmlFor="symbolSplit">代碼</label>
                <input className="input" id="symbolSplit" name="symbol" required placeholder="NVDA" autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="newShares">新股</label>
                <input className="input" id="newShares" name="newShares" inputMode="decimal" required placeholder="2" autoComplete="off" />
                <p className="meta muted">2 對 1 就填新股 2、舊股 1。只改股數，成本不變。</p>
              </div>
              <div className="field">
                <label htmlFor="oldShares">舊股</label>
                <input className="input" id="oldShares" name="oldShares" inputMode="decimal" required placeholder="1" autoComplete="off" />
              </div>
            </>
          ) : (
            <>
              <div className="field">
                <label htmlFor="noteAdj">備註</label>
                <input className="input" id="noteAdj" name="note" required placeholder="例如湊整" autoComplete="off" />
              </div>
              <div className="field">
                <label htmlFor="amountUsdAdj">美金</label>
                <input className="input" id="amountUsdAdj" name="amountUsd" inputMode="decimal" placeholder="可空，負數扣現金" autoComplete="off" />
                <p className="meta muted">人手記一筆。唔係入金、亦唔係買賣。</p>
              </div>
            </>
          )}
          {bookState.error ? <p className="alert">{bookState.error}</p> : null}
          {bookState.ok ? <p className="ok">{bookState.ok}</p> : null}
          <div className="submit-row">
            <SubmitButton pendingLabel="儲存中">記入</SubmitButton>
            <p className="meta muted">記帳唔係下單。唔會連接任何券商。</p>
          </div>
        </form>
      ) : null}
    </div>
  );
}
