import { createDrizzleStore } from "@/db/drizzle-store";
import { filterByMember, lotMarketValue, openLotsFromTrades, summarizeLedger } from "@/ledger";
import { moneyString } from "@/ledger/money";
import type { SessionUser } from "@/auth/session";
import { loadMarksForLots, type QuoteView } from "@/quotes";
import { getCurrentMembership } from "./current-book";

function snapJson(snap: ReturnType<typeof summarizeLedger>) {
  return {
    cashUsd: moneyString(snap.cashUsd),
    openValueUsd: moneyString(snap.openValueUsd),
    navUsd: moneyString(snap.navUsd),
    partial: snap.partial,
    markedLotCount: snap.markedLotCount,
    unmarkedLotCount: snap.unmarkedLotCount,
  };
}

export async function listOpenLotSymbols(user: SessionUser): Promise<string[]> {
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return [];
  }
  const store = createDrizzleStore();
  const trades = await store.listTrades(ctx.book.id);
  const allocations = await store.listTradeAllocations(ctx.book.id);
  return [...new Set(openLotsFromTrades(trades, allocations).map((lot) => lot.symbol))];
}

export async function loadBookView(user: SessionUser) {
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return null;
  }
  const store = createDrizzleStore();
  const cashFlows = await store.listCashFlows(ctx.book.id);
  const trades = await store.listTrades(ctx.book.id);
  const allocations = await store.listTradeAllocations(ctx.book.id);
  const lots = openLotsFromTrades(trades, allocations);
  const { marks, views } = await loadMarksForLots(lots.map((lot) => lot.symbol), {
    refresh: "background",
  }).catch(() => ({
    marks: {} as Record<string, string | null>,
    views: {} as Record<string, QuoteView>,
  }));

  const all = summarizeLedger(cashFlows, allocations, lots, marks);
  const jointAccountIds = new Set(
    ctx.accounts.filter((account) => account.kind === "joint").map((account) => account.id),
  );
  const jointTradeIds = new Set(
    trades.filter((trade) => jointAccountIds.has(trade.ledgerAccountId)).map((trade) => trade.id),
  );
  const joint = summarizeLedger(
    cashFlows.filter((row) => jointAccountIds.has(row.ledgerAccountId)),
    allocations.filter((row) => jointTradeIds.has(row.tradeId)),
    lots.filter((lot) => jointAccountIds.has(lot.ledgerAccountId)),
    marks,
  );
  const byMember = ctx.members.map((member) => {
    const memberFlows = filterByMember(cashFlows, member.id);
    const memberAlloc = filterByMember(allocations, member.id);
    const memberLots = filterByMember(lots, member.id);
    const snap = summarizeLedger(memberFlows, memberAlloc, memberLots, marks);
    return { member, ...snap, lots: memberLots };
  });

  const decoratedLots = lots.map((lot) => {
    const last = marks[lot.symbol] ?? null;
    const mv = lotMarketValue(lot.quantity, last);
    const view = views[lot.symbol];
    return {
      ...lot,
      last,
      lastDisplay: view?.last ?? null,
      percentChange: view?.percentChange ?? null,
      marketValueUsd: mv ? moneyString(mv) : null,
      planLimited: view?.planLimited ?? false,
    };
  });

  return {
    ...ctx,
    cashFlows,
    trades,
    allocations,
    lots: decoratedLots,
    quoteViews: views,
    all: snapJson(all),
    joint: snapJson(joint),
    byMember: byMember.map((row) => ({
      member: row.member,
      cashUsd: moneyString(row.cashUsd),
      openValueUsd: moneyString(row.openValueUsd),
      navUsd: moneyString(row.navUsd),
      partial: row.partial,
      lots: row.lots,
    })),
  };
}
