import { filterByMember, openLotsFromTrades, summarizeLedger, type LotMarks, type OpenLot } from "@/ledger/summary";
import { moneyString } from "@/ledger/money";
import type { CashFlow, Trade, TradeAllocation } from "@/ledger/types";
import { addDays } from "./dates";

export type DatedLedger = {
  cashFlows: CashFlow[];
  trades: Trade[];
  allocations: TradeAllocation[];
};

export function entriesAsOf(ledger: DatedLedger, asOf: string): DatedLedger {
  const trades = ledger.trades.filter((row) => row.occurredOn <= asOf);
  const tradeIds = new Set(trades.map((row) => row.id));
  return {
    cashFlows: ledger.cashFlows.filter((row) => row.occurredOn <= asOf),
    trades,
    allocations: ledger.allocations.filter((row) => tradeIds.has(row.tradeId)),
  };
}

/** NAV immediately before the window: activity on periodStart is inside the window. */
export function startAsOf(periodStart: string): string {
  return addDays(periodStart, -1);
}

export function snapshotAt(
  ledger: DatedLedger,
  asOf: string,
  marks: LotMarks,
  memberId?: string | null,
) {
  const sliced = entriesAsOf(ledger, asOf);
  const lots = openLotsFromTrades(sliced.trades, sliced.allocations);
  const cashFlows = memberId ? filterByMember(sliced.cashFlows, memberId) : sliced.cashFlows;
  const allocations = memberId ? filterByMember(sliced.allocations, memberId) : sliced.allocations;
  const memberLots = memberId ? filterByMember(lots, memberId) : lots;
  const snap = summarizeLedger(cashFlows, allocations, memberLots, marks);
  return {
    ...snap,
    lots: memberLots,
    navUsd: moneyString(snap.navUsd),
    cashUsd: moneyString(snap.cashUsd),
    openValueUsd: moneyString(snap.openValueUsd),
  };
}

export function externalFlowsInWindow(
  cashFlows: CashFlow[],
  periodStart: string,
  periodEnd: string,
  memberId?: string | null,
): { occurredOn: string; amountUsd: string }[] {
  const rows = memberId ? filterByMember(cashFlows, memberId) : cashFlows;
  return rows
    .filter((row) => row.occurredOn >= periodStart && row.occurredOn <= periodEnd)
    .map((row) => ({ occurredOn: row.occurredOn, amountUsd: row.amountUsd }));
}

export function unmarkedSymbols(lots: OpenLot[], marks: LotMarks): string[] {
  return lots
    .filter((lot) => {
      const last = marks[lot.symbol.trim().toUpperCase()] ?? marks[lot.symbol];
      return last == null || String(last).trim() === "";
    })
    .map((lot) => lot.symbol);
}
