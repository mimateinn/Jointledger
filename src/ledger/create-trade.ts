import { isPositive, money, moneyString } from "./money";
import type { LedgerStore } from "./store";
import type { CreateTradeInput, Trade, TradeAllocation } from "./types";

export function deriveCostUsd(quantity: string, price: string): string {
  const qty = money(quantity);
  const px = money(price);
  if (!isPositive(qty)) {
    throw new Error("數量必須大於 0");
  }
  if (!isPositive(px)) {
    throw new Error("價格必須大於 0");
  }
  return moneyString(qty.mul(px));
}

export async function createTrade(
  store: LedgerStore,
  input: CreateTradeInput,
): Promise<{ trade: Trade; allocation: TradeAllocation }> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) {
    throw new Error("要寫代碼");
  }

  const side = input.side ?? "buy";
  const costUsd = side === "buy" ? deriveCostUsd(input.quantity, input.price) : "0";
  const proceedsUsd = side === "sell" ? deriveCostUsd(input.quantity, input.price) : "0";

  const trade = await store.insertTrade({
    bookId: input.bookId,
    ledgerAccountId: input.ledgerAccountId,
    symbol,
    side,
    quantity: moneyString(input.quantity),
    price: moneyString(input.price),
    feeUsd: "0",
    occurredOn: input.occurredOn,
    note: input.note?.trim() ? input.note.trim() : null,
  });

  const allocation = await store.insertTradeAllocation({
    tradeId: trade.id,
    memberId: input.memberId,
    quantity: moneyString(input.quantity),
    costUsd,
    proceedsUsd,
  });

  return { trade, allocation };
}
