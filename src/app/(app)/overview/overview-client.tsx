"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";
import { InstrumentLabel } from "@/components/instrument-label";
import { Icon } from "@/components/icons";
import { formatQty, formatSharePercent, formatUsd, todayChangeLabel } from "@/lib/format";
import { lotRowKey } from "@/lib/lot-row-key";
import { useCountTo } from "@/lib/use-count-to";

type Filter = "me" | "all" | "joint" | string;

const COPY = {
  title: "總覽",
  nav: "資產淨值",
  cash: "可用資金",
  today: "今日升跌",
  cashSub: "現金，未計持股",
  holdings: "持倉摘要",
  empty: "未有入金，記一筆就可以開始。",
  emptyHold: "呢個視角未有持倉",
  deposit: "入金",
  import: "匯入現有試算表",
  goHoldings: "去持倉",
  step1: "入金",
  step2: "記持股",
  step3: "睇淨值",
  partial: "部分市值",
};

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

function todayUsdFromLots(
  lots: { lastDisplay: string | null; percentChange: string | null; marketValueUsd: string | null }[],
): { usd: number | null; pct: number | null } {
  let delta = 0;
  let base = 0;
  let any = false;
  for (const lot of lots) {
    if (!lot.lastDisplay || !lot.marketValueUsd || !lot.percentChange) continue;
    const pct = Number(lot.percentChange.replace("%", ""));
    const mv = Number(lot.marketValueUsd);
    if (!Number.isFinite(pct) || !Number.isFinite(mv) || pct === -100) continue;
    const prev = mv / (1 + pct / 100);
    delta += mv - prev;
    base += prev;
    any = true;
  }
  if (!any) return { usd: null, pct: null };
  return { usd: delta, pct: base === 0 ? null : (delta / base) * 100 };
}

function formatSignedPct(pct: number): string {
  const body = `${Math.abs(pct).toFixed(2)}%`;
  if (pct > 0) return `+${body}`;
  if (pct < 0) return `-${body}`;
  return body;
}

export function OverviewClient({
  currentMemberId,
  members,
  accounts,
  all,
  joint,
  byMember,
  lots,
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
    memberId: string | null;
    ledgerAccountId: string;
    symbol: string;
    name: string | null;
    quantity: string;
    splitLabel: string | null;
    costUsd: string;
    lastDisplay: string | null;
    percentChange: string | null;
    marketValueUsd: string | null;
    joint?: boolean;
    sharePercent?: string | null;
    memberLabel?: string;
  }[];
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
  const today = todayUsdFromLots(shown.lots);
  const nav = useCountTo(shown.nav, formatUsd);
  const cash = useCountTo(shown.cash, formatUsd);

  return (
    <div className="page">
      <div className="page-head">
        <h1 className="page-title">{COPY.title}</h1>
        <div className="chip-row chip-scroll">
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

      {emptyBook ? (
        <section className="card state-panel">
          <Icon name="empty-ledger" className="icon-ill" />
          <h2>{COPY.empty.replace("。", "")}</h2>
          <p>{COPY.empty}</p>
          <ol className="step-row">
            <li>
              <span className="step-dot" />
              {COPY.step1}
            </li>
            <li>
              <span className="step-dot" />
              {COPY.step2}
            </li>
            <li>
              <span className="step-dot" />
              {COPY.step3}
            </li>
          </ol>
          <div className="display tabular">US$ 0.00</div>
          <div className="state-actions">
            <Link href="/entry?tab=deposit" prefetch className="btn btn-primary">
              入金
            </Link>
            <Link href="/first-use" prefetch className="btn btn-ghost">
              {COPY.import}
            </Link>
          </div>
        </section>
      ) : (
        <>
          <div className="grid-12">
            <section className="card metric-card col-4">
              <div className="meta muted">{COPY.nav}</div>
              {shown.nav == null ? (
                <div className="skeleton skeleton-metric metric-value" />
              ) : (
                <div className={`display tabular metric-value num-lock num-flash ${nav.flash ? `is-${nav.flash}` : ""}`}>
                  {nav.text}
                </div>
              )}
              <p className="meta muted metric-sub">
                {asOfLabel}
                {shown.partial ? ` · ${COPY.partial}` : ""}
              </p>
            </section>
            <section className="card metric-card col-4">
              <div className="meta muted">{COPY.cash}</div>
              {shown.cash == null ? (
                <div className="skeleton skeleton-metric metric-value" />
              ) : (
                <div className={`display tabular metric-value num-lock num-flash ${cash.flash ? `is-${cash.flash}` : ""}`}>
                  {cash.text}
                </div>
              )}
              <p className="meta muted metric-sub">{COPY.cashSub}</p>
            </section>
            <section className="card metric-card col-4">
              <div className="meta muted">{COPY.today}</div>
              <div className={`display tabular metric-value ${today.usd == null ? "muted" : today.usd < 0 ? "down" : today.usd > 0 ? "up" : "muted"}`}>
                {today.usd == null ? "—" : formatUsd(today.usd.toFixed(2))}
              </div>
              <p className={`meta metric-sub ${today.pct == null ? "muted" : today.pct < 0 ? "down" : today.pct > 0 ? "up" : "muted"}`}>
                {today.pct == null ? "—" : formatSignedPct(today.pct)}
              </p>
            </section>
          </div>

          <section className="card card-flush">
            <div className="card-head" style={{ padding: "var(--card-pad) var(--card-pad) 0" }}>
              <h2 className="card-title">{COPY.holdings}</h2>
              <span className="meta muted">
                {shown.lots.length === 0 ? COPY.emptyHold : holdingsMeta(shown.lots.length)}
                {" · "}
                <Link href="/holdings" className="btn btn-ghost">
                  {COPY.goHoldings}
                  <Icon name="arrow-up-right" size={16} />
                </Link>
              </span>
            </div>
            {shown.lots.length === 0 ? (
              <div className="state-panel">
                <p>{COPY.emptyHold}</p>
                <Link href="/entry" className="btn btn-primary">
                  記一筆
                </Link>
              </div>
            ) : (
              <table className="table table-cards">
                <thead>
                  <tr>
                    <th>標的</th>
                    <th>邊個倉</th>
                    <th className="num">數量</th>
                    <th className="num">現價</th>
                    <th className="num">今日</th>
                    <th className="num">市值</th>
                    <th className="num">成本</th>
                  </tr>
                </thead>
                <tbody className="list-enter">
                  {shown.lots.map((lot, index) => (
                    <tr key={lotRowKey(lot)} className="row-entry" style={{ "--i": index } as CSSProperties}>
                      <td>
                        <Link href={`/instrument/${encodeURIComponent(lot.symbol)}`} aria-label={`查看 ${lot.symbol}`}>
                          <InstrumentLabel ticker={lot.symbol} name={lot.name} />
                        </Link>
                      </td>
                      <td>
                        <span className="chip">{lot.memberLabel ?? accountName(lot.ledgerAccountId)}</span>
                        {lot.joint && lot.sharePercent ? (
                          <span className="meta muted"> {formatSharePercent(lot.sharePercent)}</span>
                        ) : null}
                      </td>
                      <td className="num" data-label="數量">
                        {formatQty(lot.quantity)}
                        {lot.splitLabel ? <span className="meta muted"> 拆股 {lot.splitLabel}</span> : null}
                      </td>
                      <td className="num" data-label="現價">
                        {lot.lastDisplay ?? "—"}
                      </td>
                      <td className={`num ${lot.lastDisplay ? changeClass(lot.percentChange) : "muted"}`} data-label="今日">
                        {todayChangeLabel(lot.lastDisplay, lot.percentChange)}
                      </td>
                      <td className="num card-primary" data-label="市值">
                        {lot.lastDisplay
                          ? lot.marketValueUsd
                            ? formatUsd(lot.marketValueUsd)
                            : "—"
                          : formatUsd(lot.costUsd)}
                      </td>
                      <td className="num card-meta" data-label="成本">
                        {formatUsd(lot.costUsd)}
                      </td>
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
