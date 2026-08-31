import { isPositive, money, moneyString } from "./money";
import type { LedgerStore } from "./store";
import type { CreateSplitInput, Trade, TradeAllocation } from "./types";

function compactQty(value: string): string {
  return money(value).toFixed(8).replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export async function createSplit(
  store: LedgerStore,
  input: CreateSplitInput,
): Promise<{ trade: Trade; allocation: TradeAllocation }> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) {
    throw new Error("要寫代碼");
  }
  if (!isPositive(input.newShares)) {
    throw new Error("拆股新股必須大於 0");
  }
  if (!isPositive(input.oldShares)) {
    throw new Error("拆股舊股必須大於 0");
  }

  const newShares = moneyString(input.newShares);
  const oldShares = moneyString(input.oldShares);
  const note = input.note?.trim()
    ? input.note.trim()
    : `拆股 ${compactQty(newShares)}:${compactQty(oldShares)}`;

  const trade = await store.insertTrade({
    bookId: input.bookId,
    ledgerAccountId: input.ledgerAccountId,
    symbol,
    side: "split",
    quantity: newShares,
    price: oldShares,
    feeUsd: moneyString("0"),
    occurredOn: input.occurredOn,
    note,
  });

  const allocation = await store.insertTradeAllocation({
    tradeId: trade.id,
    memberId: input.memberId,
    quantity: newShares,
    costUsd: moneyString("0"),
    proceedsUsd: moneyString("0"),
  });

  return { trade, allocation };
}
