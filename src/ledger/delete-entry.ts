import { Decimal } from "decimal.js";
import { money } from "./money";
import type { LedgerStore } from "./store";
import type { Trade, TradeAllocation } from "./types";

export type DeleteEntryKind = "cash" | "trade";

export type DeleteEntryInput = {
  bookId: string;
  kind: DeleteEntryKind;
  id: string;
};

export const DELETE_BLOCKED_BY_LATER =
  "之後仲有呢隻嘅賣出／拆股／調整，要先刪或處理嗰啲先可以刪呢筆。";

/** Read-only FIFO / existence check. Does not write. */
export async function checkDeleteEntry(store: LedgerStore, input: DeleteEntryInput): Promise<void> {
  if (input.kind === "cash") {
    const flows = await store.listCashFlows(input.bookId);
    if (!flows.some((row) => row.id === input.id)) {
      throw new Error("搵唔到呢筆記錄");
    }
    return;
  }

  const trades = await store.listTrades(input.bookId);
  if (!trades.some((row) => row.id === input.id)) {
    throw new Error("搵唔到呢筆記錄");
  }
  const allocations = await store.listTradeAllocations(input.bookId);
  assertSafeToRemoveTrade(trades, allocations, input.id);
}

/**
 * Remove one ledger row. Cash is whatever the remaining rows say — never rewritten.
 * Callers must keep the 8s undo window so the user can still restore.
 */
export async function deleteEntry(store: LedgerStore, input: DeleteEntryInput): Promise<void> {
  await checkDeleteEntry(store, input);
  if (input.kind === "cash") {
    await store.deleteCashFlows(input.bookId, [input.id]);
    return;
  }
  const allocations = await store.listTradeAllocations(input.bookId);
  const remove = allocations.filter((row) => row.tradeId === input.id);
  await store.deleteAllocations(remove.map((row) => row.id));
  await store.deleteTradesIfUnused(input.bookId, [input.id]);
}

function instrumentKey(symbol: string): string {
  return symbol.trim().toUpperCase();
}

function isRealSymbol(symbol: string): boolean {
  const key = instrumentKey(symbol);
  return key !== "" && key !== "—" && key !== "-";
}

function sideRank(side: Trade["side"]): number {
  if (side === "buy") {
    return 0;
  }
  if (side === "split") {
    return 1;
  }
  if (side === "adjustment") {
    return 2;
  }
  return 3;
}

function remainingEvents(trades: Trade[], allocations: TradeAllocation[], exceptTradeId: string) {
  const byTrade = new Map(trades.filter((row) => row.id !== exceptTradeId).map((row) => [row.id, row]));
  return allocations
    .filter((row) => row.tradeId !== exceptTradeId)
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
      return sideRank(a.trade.side) - sideRank(b.trade.side);
    });
}

/** True when a remaining sell/split/adjustment of this instrument would lack position. */
export function removalLeavesLaterShort(
  trades: Trade[],
  allocations: TradeAllocation[],
  tradeId: string,
): boolean {
  const target = trades.find((row) => row.id === tradeId);
  if (!target || !isRealSymbol(target.symbol)) {
    return false;
  }
  const symbol = instrumentKey(target.symbol);
  type Live = { memberId: string; remainingQty: Decimal };
  const open: Live[] = [];
  const appliedSplits = new Set<string>();

  for (const { allocation, trade } of remainingEvents(trades, allocations, tradeId)) {
    if (instrumentKey(trade.symbol) !== symbol) {
      continue;
    }
    if (trade.side === "buy") {
      const qty = money(allocation.quantity);
      if (qty.gt(0)) {
        open.push({ memberId: allocation.memberId, remainingQty: qty });
      }
      continue;
    }
    if (trade.side === "split") {
      if (appliedSplits.has(trade.id)) {
        continue;
      }
      appliedSplits.add(trade.id);
      const held = open.some((lot) => lot.remainingQty.gt(0));
      if (!held) {
        return true;
      }
      const factor = money(trade.quantity).div(money(trade.price));
      for (const lot of open) {
        if (lot.remainingQty.gt(0)) {
          lot.remainingQty = lot.remainingQty.mul(factor);
        }
      }
      continue;
    }
    if (trade.side === "adjustment") {
      if (!open.some((lot) => lot.remainingQty.gt(0))) {
        return true;
      }
      continue;
    }

    let toClose = money(allocation.quantity);
    for (const lot of open) {
      if (toClose.lte(0)) {
        break;
      }
      if (lot.memberId !== allocation.memberId || lot.remainingQty.lte(0)) {
        continue;
      }
      const take = Decimal.min(lot.remainingQty, toClose);
      lot.remainingQty = lot.remainingQty.minus(take);
      toClose = toClose.minus(take);
    }
    if (toClose.gt(0)) {
      return true;
    }
  }
  return false;
}

function assertSafeToRemoveTrade(
  trades: Trade[],
  allocations: TradeAllocation[],
  tradeId: string,
): void {
  if (removalLeavesLaterShort(trades, allocations, tradeId)) {
    throw new Error(DELETE_BLOCKED_BY_LATER);
  }
}
