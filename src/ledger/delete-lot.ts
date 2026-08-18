import { positionLotsFromTrades } from "./summary";
import type { LedgerStore } from "./store";

export type DeleteLotInput = {
  bookId: string;
  tradeId: string;
  memberId: string;
};

/**
 * Correction: remove this member's buy allocation (and FIFO-linked sells).
 * Cash is whatever the invariant says on the remaining rows — never rewritten.
 */
export async function deleteLot(store: LedgerStore, input: DeleteLotInput): Promise<void> {
  const trades = await store.listTrades(input.bookId);
  const allocations = await store.listTradeAllocations(input.bookId);
  const lot = positionLotsFromTrades(trades, allocations).find(
    (row) => row.tradeId === input.tradeId && row.memberId === input.memberId,
  );
  if (!lot) {
    throw new Error("搵唔到呢筆持倉");
  }

  const tradeIds = [lot.tradeId, ...lot.sellTradeIds];
  const remove = allocations.filter(
    (row) => tradeIds.includes(row.tradeId) && row.memberId === input.memberId,
  );
  if (remove.length === 0) {
    throw new Error("搵唔到呢筆持倉");
  }
  await store.deleteAllocations(remove.map((row) => row.id));
  await store.deleteTradesIfUnused(input.bookId, tradeIds);
}
