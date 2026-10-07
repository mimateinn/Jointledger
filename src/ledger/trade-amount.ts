import { money, moneyString } from "./money";

export type TradeAmountLeg = {
  memberId?: string;
  costUsd?: string;
  proceedsUsd?: string;
};

/**
 * Cash amount shown for a ledger / export trade row.
 * Adjustments and dividends are proceeds − cost (qty × price is always 0).
 * Buys and sells stay qty × price. Splits have no cash amount.
 */
export function tradeCashAmountUsd(input: {
  side: string;
  quantity?: string;
  price?: string;
  allocations?: TradeAmountLeg[];
  memberId?: string | null;
}): string {
  const legs = (input.allocations ?? []).filter((leg) =>
    input.memberId ? leg.memberId === input.memberId : true,
  );
  if (input.side === "adjustment") {
    const signed = legs.reduce(
      (sum, leg) => sum.plus(money(leg.proceedsUsd ?? "0")).minus(money(leg.costUsd ?? "0")),
      money("0"),
    );
    return moneyString(signed);
  }
  if (input.side === "split") {
    return moneyString("0");
  }
  return moneyString(money(input.quantity ?? "0").mul(money(input.price ?? "0")));
}

export function tradeMemberAmounts(
  input: {
    side: string;
    quantity?: string;
    price?: string;
    allocations?: TradeAmountLeg[];
  },
): { memberId: string; amountUsd: string }[] {
  const seen = new Set<string>();
  const out: { memberId: string; amountUsd: string }[] = [];
  for (const leg of input.allocations ?? []) {
    if (!leg.memberId || seen.has(leg.memberId)) {
      continue;
    }
    seen.add(leg.memberId);
    out.push({
      memberId: leg.memberId,
      amountUsd: tradeCashAmountUsd({ ...input, memberId: leg.memberId }),
    });
  }
  return out;
}
