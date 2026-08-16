import { Decimal } from "decimal.js";
import { money } from "./money";
import type { CashFlow, Trade, TradeAllocation } from "./types";

export type BookSnapshot = {
  cashUsd: Decimal;
  openValueUsd: Decimal;
  navUsd: Decimal;
};

export type OpenLot = {
  tradeId: string;
  memberId: string;
  ledgerAccountId: string;
  symbol: string;
  quantity: string;
  costUsd: string;
  occurredOn: string;
};

/**
 * cash_usd = Σ CashFlow.amount_usd − Σ TradeAllocation.cost_usd ＋ Σ TradeAllocation.proceeds_usd
 * Open lots are valued at cost in M1 (no market quotes).
 * NAV = cash_usd + open position value
 */
export function summarizeLedger(
  cashFlows: Pick<CashFlow, "amountUsd">[],
  allocations: Pick<TradeAllocation, "costUsd" | "proceedsUsd">[],
  openLots: Pick<OpenLot, "costUsd">[],
): BookSnapshot {
  const inflows = cashFlows.reduce((sum, row) => sum.plus(money(row.amountUsd)), new Decimal(0));
  const costs = allocations.reduce((sum, row) => sum.plus(money(row.costUsd)), new Decimal(0));
  const proceeds = allocations.reduce(
    (sum, row) => sum.plus(money(row.proceedsUsd)),
    new Decimal(0),
  );
  const cashUsd = inflows.minus(costs).plus(proceeds);
  const openValueUsd = openLots.reduce((sum, lot) => sum.plus(money(lot.costUsd)), new Decimal(0));
  return {
    cashUsd,
    openValueUsd,
    navUsd: cashUsd.plus(openValueUsd),
  };
}

export function openLotsFromTrades(
  trades: Trade[],
  allocations: TradeAllocation[],
): OpenLot[] {
  const byTrade = new Map(trades.map((trade) => [trade.id, trade]));
  return allocations.flatMap((allocation) => {
    const trade = byTrade.get(allocation.tradeId);
    if (!trade) {
      return [];
    }
    const hasCost = money(allocation.costUsd).gt(0);
    const hasClose = money(allocation.proceedsUsd).gt(0);
    if (!hasCost || hasClose) {
      return [];
    }
    return [
      {
        tradeId: trade.id,
        memberId: allocation.memberId,
        ledgerAccountId: trade.ledgerAccountId,
        symbol: trade.symbol,
        quantity: allocation.quantity,
        costUsd: allocation.costUsd,
        occurredOn: trade.occurredOn,
      },
    ];
  });
}

export function filterByMember<T extends { memberId: string }>(
  rows: T[],
  memberId: string | null,
): T[] {
  if (!memberId) {
    return rows;
  }
  return rows.filter((row) => row.memberId === memberId);
}
