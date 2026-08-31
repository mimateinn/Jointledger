import { money, moneyString } from "./money";
import type { LedgerStore } from "./store";
import type { CreateAdjustmentInput, Trade, TradeAllocation } from "./types";

export async function createAdjustment(
  store: LedgerStore,
  input: CreateAdjustmentInput,
): Promise<{ trade: Trade; allocation: TradeAllocation }> {
  const note = input.note.trim();
  if (!note) {
    throw new Error("調整要寫備註");
  }

  const rawAmount = (input.amountUsd ?? "").trim().replace(/^\+/, "");
  let costUsd = "0";
  let proceedsUsd = "0";
  if (rawAmount !== "") {
    const amount = money(rawAmount);
    if (amount.gt(0)) {
      proceedsUsd = moneyString(amount);
    } else if (amount.lt(0)) {
      costUsd = moneyString(amount.abs());
    }
  }

  const symbol = input.symbol?.trim().toUpperCase() || "—";

  const trade = await store.insertTrade({
    bookId: input.bookId,
    ledgerAccountId: input.ledgerAccountId,
    symbol,
    side: "adjustment",
    quantity: "0",
    price: "0",
    feeUsd: "0",
    occurredOn: input.occurredOn,
    note,
  });

  const allocation = await store.insertTradeAllocation({
    tradeId: trade.id,
    memberId: input.memberId,
    quantity: "0",
    costUsd,
    proceedsUsd,
  });

  return { trade, allocation };
}
