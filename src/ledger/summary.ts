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
  const events = allocations
    .map((allocation) => {
      const trade = byTrade.get(allocation.tradeId);
      return trade ? { allocation, trade } : null;
    })
    .filter((row): row is { allocation: TradeAllocation; trade: Trade } => row !== null)
    .sort((a, b) => {
      const byDate = a.trade.occurredOn.localeCompare(b.trade.occurredOn);
      if (byDate !== 0) {
        return byDate;
      }
      if (a.trade.side === b.trade.side) {
        return 0;
      }
      return a.trade.side === "buy" ? -1 : 1;
    });

  type LiveLot = OpenLot & { remainingQty: Decimal; remainingCost: Decimal };
  const open: LiveLot[] = [];

  for (const { allocation, trade } of events) {
    if (trade.side === "buy") {
      const qty = money(allocation.quantity);
      const cost = money(allocation.costUsd);
      if (!qty.gt(0) || !cost.gt(0)) {
        continue;
      }
      open.push({
        tradeId: trade.id,
        memberId: allocation.memberId,
        ledgerAccountId: trade.ledgerAccountId,
        symbol: trade.symbol,
        quantity: allocation.quantity,
        costUsd: allocation.costUsd,
        occurredOn: trade.occurredOn,
        remainingQty: qty,
        remainingCost: cost,
      });
      continue;
    }

    let toClose = money(allocation.quantity);
    for (const lot of open) {
      if (toClose.lte(0)) {
        break;
      }
      if (lot.memberId !== allocation.memberId || lot.symbol !== trade.symbol) {
        continue;
      }
      if (lot.remainingQty.lte(0)) {
        continue;
      }
      const take = Decimal.min(lot.remainingQty, toClose);
      const costTake = lot.remainingCost.mul(take).div(lot.remainingQty);
      lot.remainingQty = lot.remainingQty.minus(take);
      lot.remainingCost = lot.remainingCost.minus(costTake);
      toClose = toClose.minus(take);
    }
  }

  return open
    .filter((lot) => lot.remainingQty.gt(0))
    .map((lot) => ({
      tradeId: lot.tradeId,
      memberId: lot.memberId,
      ledgerAccountId: lot.ledgerAccountId,
      symbol: lot.symbol,
      quantity: lot.remainingQty.toFixed(8),
      costUsd: lot.remainingCost.toFixed(8),
      occurredOn: lot.occurredOn,
    }));
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
