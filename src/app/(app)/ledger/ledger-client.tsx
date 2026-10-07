"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent } from "react";
import { DateInput } from "@/components/date-input";
import { EmptyPanel } from "@/components/empty-panel";
import { Icon } from "@/components/icons";
import { InstrumentLabel } from "@/components/instrument-label";
import { LedgerEntryDelete } from "@/components/ledger-entry-delete";
import { formatHkd, formatMoney, formatQty, formatRelativeDate, formatUsd } from "@/lib/format";
import { formatLedgerTradeAmount, formatLedgerTradePrice, ledgerRowAmountUsd } from "@/lib/ledger-amount";
import {
  JOINT_MEMBER,
  JOINT_MEMBER_LABEL,
  LEDGER_KIND_LABEL,
  emptyLedgerFilters,
  filterLedgerRows,
  ledgerKindLabel,
  isJointMemberFilter,
  kindsForView,
  ledgerFiltersActive,
  ledgerFiltersToSearch,
  memberForView,
  parseLedgerFilters,
  type FilterableLedgerRow,
  type LedgerFilters,
  type LedgerKind,
  type LedgerMemberOption,
} from "@/lib/ledger-filter";

const COPY = {
  eyebrow: "紀錄",
  title: "流水",
  trades: "買賣",
  cash: "出入金",
  search: "搜尋代碼、名稱或備註",
  filter: "篩選",
  clear: "清除篩選",
  count: (n: number) => `共 ${n} 筆`,
  empty: "未有出入金或買賣。",
  emptyTrades: "未有買賣。",
  emptyCash: "未有出入金。",
  noMatch: "搵唔到符合嘅紀錄",
  member: "成員",
  type: "類型",
  from: "由",
  to: "至",
  all: "全部",
  joint: JOINT_MEMBER_LABEL,
};

type CashRow = FilterableLedgerRow & {
  amountUsd: string;
  amountHkd: string;
  fxRate: string;
};

type TradeRow = FilterableLedgerRow & {
  quantity: string;
  price: string;
  amountUsd: string;
  memberAmounts?: { memberId: string; amountUsd: string }[];
};

export function LedgerClient({
  cashFlows,
  trades,
  members,
  filters,
}: {
  cashFlows: CashRow[];
  trades: TradeRow[];
  members: LedgerMemberOption[];
  filters: LedgerFilters;
}) {
  const [current, setCurrent] = useState(filters);
  const [draft, setDraft] = useState(filters);
  const searchRef = useRef<HTMLInputElement>(null);
  const allRows = useMemo(() => [...cashFlows, ...trades], [cashFlows, trades]);
  const shown = useMemo(() => filterLedgerRows(allRows, current, members), [allRows, current, members]);
  const active = ledgerFiltersActive(current);
  const emptyBook = cashFlows.length === 0 && trades.length === 0;
  const memberOptions = useMemo(() => {
    if (current.view !== "trades") {
      return members;
    }
    return [...members, { id: JOINT_MEMBER, displayName: COPY.joint }];
  }, [members, current.view]);

  useEffect(() => {
    setCurrent(filters);
    setDraft(filters);
    if (typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("view") === "trades" || !isJointMemberFilter(params.get("member") ?? "")) {
      return;
    }
    const url = `${window.location.pathname}${ledgerFiltersToSearch({ ...filters, member: "" })}`;
    window.history.replaceState(null, "", url);
  }, [filters]);

  useEffect(() => {
    const onPop = () => {
      const next = parseLedgerFilters(new URLSearchParams(window.location.search), members);
      setCurrent(next);
      setDraft(next);
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [members]);

  function commit(next: LedgerFilters, mode: "push" | "replace" = "push") {
    const url = `${window.location.pathname}${ledgerFiltersToSearch(next)}`;
    const same = url === `${window.location.pathname}${window.location.search}`;
    if (same || mode === "replace") {
      window.history.replaceState(null, "", url);
    } else {
      window.history.pushState(null, "", url);
    }
    setCurrent(next);
    setDraft(next);
  }

  function switchView(view: LedgerFilters["view"]) {
    const kept = { q: draft.q, member: draft.member, from: draft.from, to: draft.to };
    const next = {
      ...current,
      view,
      type: "" as const,
      member: memberForView(current.member, view),
    };
    commit(next);
    setDraft({
      ...next,
      q: kept.q,
      from: kept.from,
      to: kept.to,
      member: memberForView(kept.member, view),
    });
  }

  function applyFromForm(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const keep = searchRef.current;
    commit({
      ...current,
      q: String(data.get("q") ?? ""),
      type: (String(data.get("type") ?? "") as LedgerKind | "") || "",
      member: memberForView(String(data.get("member") ?? ""), current.view),
      from: String(data.get("from") ?? ""),
      to: String(data.get("to") ?? ""),
    });
    keep?.focus();
  }

  const kinds = kindsForView(current.view);

  return (
    <div className="page">
      <div className="page-head">
        <div className="page-head-title">
          <p className="page-eyebrow">{COPY.eyebrow}</p>
          <h1 className="page-title">{COPY.title}</h1>
        </div>
        <div className="seg" style={{ "--seg-n": 2, "--seg-i": current.view === "trades" ? 1 : 0 } as CSSProperties}>
          <span className="seg-thumb" aria-hidden />
          <button type="button" aria-pressed={current.view === "cash"} onClick={() => switchView("cash")}>
            {COPY.cash}
          </button>
          <button type="button" aria-pressed={current.view === "trades"} onClick={() => switchView("trades")}>
            {COPY.trades}
          </button>
        </div>
      </div>

      {emptyBook ? (
        <EmptyPanel sentence={COPY.empty} icon="empty-ledger" actionLabel="記一筆" />
      ) : (
        <>
          <div className="card stack">
            <form className="filter-bar" onSubmit={applyFromForm}>
              <div className="field-with-icon">
                <Icon name="search" size={16} />
                <input
                  ref={searchRef}
                  className="input"
                  name="q"
                  value={draft.q}
                  onChange={(event) => setDraft({ ...draft, q: event.target.value })}
                  placeholder={COPY.search}
                  aria-label={COPY.search}
                />
              </div>
              <select
                className="select"
                name="type"
                value={draft.type}
                onChange={(event) => setDraft({ ...draft, type: (event.target.value as LedgerKind | "") || "" })}
                aria-label={COPY.type}
              >
                <option value="">{COPY.all}</option>
                {kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {LEDGER_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
              <select
                className="select"
                name="member"
                value={draft.member}
                onChange={(event) => setDraft({ ...draft, member: event.target.value })}
                aria-label={COPY.member}
              >
                <option value="">{COPY.all}</option>
                {memberOptions.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.displayName}
                  </option>
                ))}
              </select>
              <DateInput
                name="from"
                value={draft.from}
                onChange={(event) => setDraft({ ...draft, from: event.target.value })}
                aria-label={COPY.from}
              />
              <DateInput
                name="to"
                value={draft.to}
                onChange={(event) => setDraft({ ...draft, to: event.target.value })}
                aria-label={COPY.to}
              />
              <button className="btn btn-secondary" type="submit">
                <Icon name="filter" size={16} />
                {COPY.filter}
              </button>
              {active ? (
                <button
                  className="btn btn-ghost"
                  type="button"
                  onClick={() => {
                    commit({ ...emptyLedgerFilters(current.view) });
                    searchRef.current?.focus();
                  }}
                >
                  {COPY.clear}
                </button>
              ) : null}
              <span className="filter-count" aria-live="polite">
                {COPY.count(shown.length)}
              </span>
            </form>
            {active ? (
              <div className="chip-row">
                {current.q ? <span className="chip chip-active">「{current.q}」</span> : null}
                {current.type ? <span className="chip chip-active">{LEDGER_KIND_LABEL[current.type]}</span> : null}
                {current.member ? (
                  <span className="chip chip-active">
                    {memberOptions.find((member) => member.id === current.member)?.displayName ?? current.member}
                  </span>
                ) : null}
                {current.from || current.to ? (
                  <span className="chip chip-active">
                    {current.from || "…"} – {current.to || "…"}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <section className="card card-flush">
            {shown.length === 0 ? (
              <div className="state-panel">
                <Icon name="search" size={24} />
                <h2>{COPY.noMatch}</h2>
                <button className="btn btn-primary" type="button" onClick={() => commit({ ...emptyLedgerFilters(current.view) })}>
                  {COPY.clear}
                </button>
              </div>
            ) : current.view === "cash" ? (
              <CashTable rows={shown as CashRow[]} />
            ) : (
              <TradeTable rows={shown as TradeRow[]} member={current.member} />
            )}
          </section>
        </>
      )}
    </div>
  );
}

function monthLabel(iso: string): string {
  const [y, m] = iso.slice(0, 10).split("-");
  return `${y} 年 ${Number(m)} 月`;
}

function grouped<T extends { occurredOn: string }>(rows: T[]): { month: string; rows: T[] }[] {
  const out: { month: string; rows: T[] }[] = [];
  for (const row of rows) {
    const month = monthLabel(row.occurredOn);
    const last = out.at(-1);
    if (last && last.month === month) {
      last.rows.push(row);
    } else {
      out.push({ month, rows: [row] });
    }
  }
  return out;
}

function CashTable({ rows }: { rows: CashRow[] }) {
  if (rows.length === 0) {
    return <EmptyPanel sentence={COPY.emptyCash} href="/entry?tab=deposit" actionLabel="記入金" icon="empty-ledger" />;
  }
  return (
    <table className="table table-cards">
      <thead>
        <tr>
          <th>日期</th>
          <th>成員</th>
          <th>方向</th>
          <th className="num">HKD</th>
          <th className="num">匯率</th>
          <th className="num">USD</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {grouped(rows).flatMap((group) => [
          <tr className="month-row" key={`m-${group.month}`}>
            <td colSpan={7}>{group.month}</td>
          </tr>,
          ...group.rows.map((row) => (
              <tr key={row.id}>
              <td title={row.occurredOn.slice(0, 10)}>{formatRelativeDate(row.occurredOn)}</td>
              <td className="card-sub">{row.memberName}</td>
              <td className="card-sub">
                <span className="chip">{ledgerKindLabel(row.kind, row.note)}</span>
              </td>
              <td className="num card-meta" data-label="HKD">
                {formatHkd(row.amountHkd)}
              </td>
              <td className="num card-hide" data-label="匯率">
                {formatMoney(row.fxRate, 4)}
              </td>
              <td className="num card-primary" data-label="USD">
                {formatUsd(row.amountUsd)}
              </td>
              <td className="card-action">
                <LedgerEntryDelete id={row.id} kind="cash" label={`${ledgerKindLabel(row.kind, row.note)} ${row.occurredOn.slice(0, 10)}`} />
              </td>
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );
}

function TradeTable({ rows, member }: { rows: TradeRow[]; member: string }) {
  if (rows.length === 0) {
    return <EmptyPanel sentence={COPY.emptyTrades} href="/entry" actionLabel="記買入" icon="empty-ledger" />;
  }
  return (
    <table className="table table-cards">
      <thead>
        <tr>
          <th>日期</th>
          <th>類型</th>
          <th>標的</th>
          <th>邊個倉</th>
          <th className="num">數量</th>
          <th className="num">價格</th>
          <th className="num">金額</th>
          <th>備註</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {grouped(rows).flatMap((group) => [
          <tr className="month-row" key={`m-${group.month}`}>
            <td colSpan={9}>{group.month}</td>
          </tr>,
          ...group.rows.map((row) => {
            const amount = ledgerRowAmountUsd(row, member);
            return (
              <tr key={row.id}>
                <td title={row.occurredOn.slice(0, 10)}>{formatRelativeDate(row.occurredOn)}</td>
                <td className="card-sub" data-label="類型">
                  <span className="chip">{ledgerKindLabel(row.kind, row.note)}</span>
                </td>
                <td className="card-sub">
                  <InstrumentLabel ticker={row.symbol ?? "—"} name={row.name ?? null} />
                </td>
                <td className="card-sub">{row.memberName}</td>
                <td className="num card-meta" data-label="數量">
                  {formatQty(row.quantity)}
                </td>
                <td className="num card-meta" data-label="價格">
                  {formatLedgerTradePrice(row.kind, row.price)}
                </td>
                <td className="num card-primary" data-label="金額">
                  {formatLedgerTradeAmount(row.kind, amount)}
                </td>
                <td className="muted card-meta" data-label="備註">{row.note ?? "—"}</td>
                <td className="card-action">
                  <LedgerEntryDelete
                    id={row.id}
                    kind="trade"
                    label={`${ledgerKindLabel(row.kind, row.note)} ${row.symbol ?? ""}`.trim()}
                  />
                </td>
              </tr>
            );
          }),
        ])}
      </tbody>
    </table>
  );
}
