import { Decimal } from "decimal.js";
import { money } from "./money";
import type { CashFlow, Trade, TradeAllocation } from "./types";

export type BookSnapshot = {
  cashUsd: Decimal;
  openValueUsd: Decimal;
  navUsd: Decimal;
  markedLotCount: number;
  unmarkedLotCount: number;
  partial: boolean;
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

export type LotMarks = Readonly<Record<string, string | null | undefined>>;

/**
 * cash_usd = Σ CashFlow.amount_usd − Σ TradeAllocation.cost_usd ＋ Σ TradeAllocation.proceeds_usd
 * Marked MV = Σ (qty × last) for lots that have a last-good mark.
 * Unmarked lots are excluded from MV (never cost-as-last).
 * NAV = cash_usd + marked MV. If any lot is unmarked, snapshot.partial is true.
 */
export function summarizeLedger(
  cashFlows: Pick<CashFlow, "amountUsd">[],
  allocations: Pick<TradeAllocation, "costUsd" | "proceedsUsd">[],
  openLots: Pick<OpenLot, "costUsd" | "quantity" | "symbol">[],
  marks?: LotMarks,
): BookSnapshot {
  const inflows = cashFlows.reduce((sum, row) => sum.plus(money(row.amountUsd)), new Decimal(0));
  const costs = allocations.reduce((sum, row) => sum.plus(money(row.costUsd)), new Decimal(0));
  const proceeds = allocations.reduce(
    (sum, row) => sum.plus(money(row.proceedsUsd)),
    new Decimal(0),
  );
  const cashUsd = inflows.minus(costs).plus(proceeds);
  let openValueUsd = new Decimal(0);
  let markedLotCount = 0;
  let unmarkedLotCount = 0;
  for (const lot of openLots) {
    const last = marks?.[lot.symbol.trim().toUpperCase()] ?? marks?.[lot.symbol];
    const value = lotMarketValue(lot.quantity, last);
    if (value) {
      openValueUsd = openValueUsd.plus(value);
      markedLotCount += 1;
    } else {
      unmarkedLotCount += 1;
    }
  }
  return {
    cashUsd,
    openValueUsd,
    navUsd: cashUsd.plus(openValueUsd),
    markedLotCount,
    unmarkedLotCount,
    partial: unmarkedLotCount > 0,
  };
}

export function lotMarketValue(quantity: string, last: string | null | undefined): Decimal | null {
  if (last == null || last.trim() === "") {
    return null;
  }
  return money(quantity).times(money(last));
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
