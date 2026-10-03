"use client";

import { useMemo, useTransition, type CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { EmptyPanel } from "@/components/empty-panel";
import { Icon } from "@/components/icons";
import { InstrumentLabel } from "@/components/instrument-label";
import { formatHkd, formatMoney, formatQty, formatRelativeDate, formatUsd, tradeSideLabel } from "@/lib/format";
import {
  LEDGER_KIND_LABEL,
  emptyLedgerFilters,
  filterLedgerRows,
  kindsForView,
  ledgerFiltersActive,
  ledgerFiltersToSearch,
  type FilterableLedgerRow,
  type LedgerFilters,
  type LedgerKind,
} from "@/lib/ledger-filter";

const COPY = {
  title: "流水",
  trades: "買賣",
  cash: "出入金",
  search: "搜尋標的、備註或標籤",
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
};

type CashRow = FilterableLedgerRow & {
  amountUsd: string;
  amountHkd: string;
  fxRate: string;
};

type TradeRow = FilterableLedgerRow & {
  quantity: string;
  price: string;
};

export function LedgerClient({
  cashFlows,
  trades,
  members,
  filters,
}: {
  cashFlows: CashRow[];
  trades: TradeRow[];
  members: string[];
  filters: LedgerFilters;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const allRows = useMemo(() => [...cashFlows, ...trades], [cashFlows, trades]);
  const shown = useMemo(() => filterLedgerRows(allRows, filters), [allRows, filters]);
  const active = ledgerFiltersActive(filters);
  const emptyBook = cashFlows.length === 0 && trades.length === 0;

  function replace(next: LedgerFilters) {
    start(() => {
      router.replace(`${pathname}${ledgerFiltersToSearch(next)}`, { scroll: false });
    });
  }

  function patch(part: Partial<LedgerFilters>) {
    replace({ ...filters, ...part });
  }

  const kinds = kindsForView(filters.view);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{COPY.title}</h1>
        <div className="seg" style={{ "--seg-n": 2, "--seg-i": filters.view === "trades" ? 0 : 1 } as CSSProperties}>
          <span className="seg-thumb" aria-hidden />
          <button type="button" aria-pressed={filters.view === "trades"} onClick={() => patch({ view: "trades", type: "" })}>
            {COPY.trades}
          </button>
          <button type="button" aria-pressed={filters.view === "cash"} onClick={() => patch({ view: "cash", type: "" })}>
            {COPY.cash}
          </button>
        </div>
      </div>

      {emptyBook ? (
        <EmptyPanel sentence={COPY.empty} icon="empty-ledger" actionLabel="記一筆" />
      ) : (
        <>
          <div className="card stack">
            <form
              className="filter-bar"
              onSubmit={(event) => {
                event.preventDefault();
                const data = new FormData(event.currentTarget);
                patch({
                  q: String(data.get("q") ?? ""),
                  type: (String(data.get("type") ?? "") as LedgerKind | "") || "",
                  member: String(data.get("member") ?? ""),
                  from: String(data.get("from") ?? ""),
                  to: String(data.get("to") ?? ""),
                });
              }}
            >
              <div className="field-with-icon" style={{ flex: "1 1 200px" }}>
                <Icon name="search" size={16} />
                <input
                  className="input"
                  name="q"
                  defaultValue={filters.q}
                  placeholder={COPY.search}
                  aria-label={COPY.search}
                />
              </div>
              <select className="select" name="type" defaultValue={filters.type} aria-label={COPY.type}>
                <option value="">{COPY.all}</option>
                {kinds.map((kind) => (
                  <option key={kind} value={kind}>
                    {LEDGER_KIND_LABEL[kind]}
                  </option>
                ))}
              </select>
              <select className="select" name="member" defaultValue={filters.member} aria-label={COPY.member}>
                <option value="">{COPY.all}</option>
                {members.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
              <input className="input" type="date" name="from" defaultValue={filters.from} aria-label={COPY.from} />
              <input className="input" type="date" name="to" defaultValue={filters.to} aria-label={COPY.to} />
              <button className="btn btn-secondary" type="submit">
                <Icon name="filter" size={16} />
                {COPY.filter}
              </button>
              {active ? (
                <button className="btn btn-ghost" type="button" onClick={() => replace({ ...emptyLedgerFilters(filters.view) })}>
                  {COPY.clear}
                </button>
              ) : null}
              <span className="filter-count" aria-live="polite">
                {COPY.count(shown.length)}
              </span>
            </form>
            {active ? (
              <div className="chip-row">
                {filters.q ? <span className="chip chip-active">「{filters.q}」</span> : null}
                {filters.type ? <span className="chip chip-active">{LEDGER_KIND_LABEL[filters.type]}</span> : null}
                {filters.member ? <span className="chip chip-active">{filters.member}</span> : null}
                {filters.from || filters.to ? (
                  <span className="chip chip-active">
                    {filters.from || "…"} – {filters.to || "…"}
                  </span>
                ) : null}
              </div>
            ) : null}
          </div>

          <section className={`card card-flush ${pending ? "is-entering" : ""}`}>
            {shown.length === 0 ? (
              <div className="state-panel">
                <Icon name="search" size={24} />
                <h2>{COPY.noMatch}</h2>
                <button className="btn btn-primary" type="button" onClick={() => replace({ ...emptyLedgerFilters(filters.view) })}>
                  {COPY.clear}
                </button>
              </div>
            ) : filters.view === "cash" ? (
              <CashTable rows={shown as CashRow[]} />
            ) : (
              <TradeTable rows={shown as TradeRow[]} />
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
        </tr>
      </thead>
      <tbody>
        {grouped(rows).flatMap((group) => [
          <tr className="month-row" key={`m-${group.month}`}>
            <td colSpan={6}>{group.month}</td>
          </tr>,
          ...group.rows.map((row) => (
            <tr key={row.id}>
              <td title={row.occurredOn.slice(0, 10)}>{formatRelativeDate(row.occurredOn)}</td>
              <td>{row.memberName}</td>
              <td>
                <span className="chip">{LEDGER_KIND_LABEL[row.kind]}</span>
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
            </tr>
          )),
        ])}
      </tbody>
    </table>
  );
}

function TradeTable({ rows }: { rows: TradeRow[] }) {
  if (rows.length === 0) {
    return <EmptyPanel sentence={COPY.emptyTrades} href="/entry" actionLabel="記買入" icon="empty-ledger" />;
  }
  return (
    <table className="table table-cards">
      <thead>
        <tr>
          <th>日期</th>
          <th>標的</th>
          <th>邊個倉</th>
          <th className="num">數量</th>
          <th className="num">價格</th>
          <th className="num">金額</th>
          <th>備註</th>
        </tr>
      </thead>
      <tbody>
        {grouped(rows).flatMap((group) => [
          <tr className="month-row" key={`m-${group.month}`}>
            <td colSpan={7}>{group.month}</td>
          </tr>,
          ...group.rows.map((row) => {
            const amount = Number(row.quantity) * Number(row.price);
            return (
              <tr key={row.id}>
                <td title={row.occurredOn.slice(0, 10)}>{formatRelativeDate(row.occurredOn)}</td>
                <td>
                    <InstrumentLabel ticker={row.symbol ?? "—"} name={row.name ?? null} />
                    <span className="sr-only">{tradeSideLabel(row.kind)}</span>
                  </td>
                  <td>{row.memberName}</td>
                <td className="num card-meta" data-label="數量">
                  {formatQty(row.quantity)}
                </td>
                <td className="num card-meta" data-label="價格">
                  {formatUsd(row.price)}
                </td>
                <td className="num card-primary" data-label="金額">
                  {Number.isFinite(amount) ? formatUsd(amount.toFixed(2)) : "—"}
                </td>
                <td className="muted">{row.note ?? "—"}</td>
              </tr>
            );
          }),
        ])}
      </tbody>
    </table>
  );
}
