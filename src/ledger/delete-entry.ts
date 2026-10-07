import type { LedgerStore } from "./store";

export type DeleteEntryKind = "cash" | "trade";

export type DeleteEntryInput = {
  bookId: string;
  kind: DeleteEntryKind;
  id: string;
};

/**
 * Remove one ledger row. Cash is whatever the remaining rows say — never rewritten.
 * Callers must keep the 8s undo window so the user can still restore.
 */
export async function deleteEntry(store: LedgerStore, input: DeleteEntryInput): Promise<void> {
  if (input.kind === "cash") {
    const flows = await store.listCashFlows(input.bookId);
    if (!flows.some((row) => row.id === input.id)) {
      throw new Error("搵唔到呢筆記錄");
    }
    await store.deleteCashFlows([input.id]);
    return;
  }

  const trades = await store.listTrades(input.bookId);
  if (!trades.some((row) => row.id === input.id)) {
    throw new Error("搵唔到呢筆記錄");
  }
  const allocations = await store.listTradeAllocations(input.bookId);
  const remove = allocations.filter((row) => row.tradeId === input.id);
  await store.deleteAllocations(remove.map((row) => row.id));
  await store.deleteTradesIfUnused(input.bookId, [input.id]);
}
