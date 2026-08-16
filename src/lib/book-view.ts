import { createDrizzleStore } from "@/db/drizzle-store";
import { filterByMember, openLotsFromTrades, summarizeLedger } from "@/ledger";
import { moneyString } from "@/ledger/money";
import type { SessionUser } from "@/auth/session";
import { getCurrentMembership } from "./current-book";

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

  const all = summarizeLedger(cashFlows, allocations, lots);
  const byMember = ctx.members.map((member) => {
    const memberFlows = filterByMember(cashFlows, member.id);
    const memberAlloc = filterByMember(allocations, member.id);
    const memberLots = filterByMember(lots, member.id);
    const snap = summarizeLedger(memberFlows, memberAlloc, memberLots);
    return { member, ...snap, lots: memberLots };
  });

  return {
    ...ctx,
    cashFlows,
    trades,
    allocations,
    lots,
    all: {
      cashUsd: moneyString(all.cashUsd),
      openValueUsd: moneyString(all.openValueUsd),
      navUsd: moneyString(all.navUsd),
    },
    byMember: byMember.map((row) => ({
      member: row.member,
      cashUsd: moneyString(row.cashUsd),
      openValueUsd: moneyString(row.openValueUsd),
      navUsd: moneyString(row.navUsd),
      lots: row.lots,
    })),
  };
}
