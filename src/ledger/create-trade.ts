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

function sideAmount(
  side: "buy" | "sell",
  quantity: string,
  price: string,
  override: string | undefined,
  kind: "cost" | "proceeds",
): string {
  if (override != null && override.trim() !== "") {
    if (!isPositive(override)) {
      throw new Error(kind === "cost" ? "成本必須大於 0" : "賣出金額必須大於 0");
    }
    return moneyString(override);
  }
  const matches = (side === "buy" && kind === "cost") || (side === "sell" && kind === "proceeds");
  return matches ? deriveCostUsd(quantity, price) : "0";
}

export async function createTrade(
  store: LedgerStore,
  input: CreateTradeInput,
): Promise<{ trade: Trade; allocation: TradeAllocation; allocations: TradeAllocation[] }> {
  const symbol = input.symbol.trim().toUpperCase();
  if (!symbol) {
    throw new Error("要寫代碼");
  }

  const side = input.side ?? "buy";
  const costUsd = sideAmount(side, input.quantity, input.price, input.costUsd, "cost");
  const proceedsUsd = sideAmount(side, input.quantity, input.price, input.proceedsUsd, "proceeds");
  const feeUsd = input.feeUsd && input.feeUsd.trim() !== "" ? moneyString(input.feeUsd) : "0";

  const trade = await store.insertTrade({
    bookId: input.bookId,
    ledgerAccountId: input.ledgerAccountId,
    symbol,
    side,
    quantity: moneyString(input.quantity),
    price: moneyString(input.price),
    feeUsd,
    occurredOn: input.occurredOn,
    note: input.note?.trim() ? input.note.trim() : null,
  });

  const sources = input.legs?.length
    ? input.legs
    : [
        {
          memberId: input.memberId,
          quantity: input.quantity,
          costUsd,
          proceedsUsd,
        },
      ];

  const totalQty = sources.reduce((sum, leg) => sum.plus(money(leg.quantity)), money("0"));
  const allocations: TradeAllocation[] = [];
  let costLeft = money(costUsd);
  let proceedsLeft = money(proceedsUsd);
  for (const [index, leg] of sources.entries()) {
    const last = index === sources.length - 1;
    const share = totalQty.gt(0) ? money(leg.quantity).div(totalQty) : money("0");
    const legCost =
      leg.costUsd != null && leg.costUsd.trim() !== ""
        ? money(leg.costUsd)
        : last
          ? costLeft
          : money(costUsd).mul(share);
    const legProceeds =
      leg.proceedsUsd != null && leg.proceedsUsd.trim() !== ""
        ? money(leg.proceedsUsd)
        : last
          ? proceedsLeft
          : money(proceedsUsd).mul(share);
    costLeft = costLeft.minus(legCost);
    proceedsLeft = proceedsLeft.minus(legProceeds);
    allocations.push(
      await store.insertTradeAllocation({
        tradeId: trade.id,
        memberId: leg.memberId,
        quantity: moneyString(leg.quantity),
        costUsd: moneyString(legCost),
        proceedsUsd: moneyString(legProceeds),
      }),
    );
  }

  const allocation = allocations[0];
  if (!allocation) {
    throw new Error("要有分配");
  }
  return { trade, allocation, allocations };
}
