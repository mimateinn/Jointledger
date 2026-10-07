import { isJointMemberFilter } from "./ledger-filter";
import { formatSignedUsd, formatUsd } from "./format";

export type LedgerAmountShare = {
  memberId: string;
  amountUsd: string;
};

/** Joint/all view uses the trade total; a member filter uses that member's share. */
export function ledgerRowAmountUsd(
  row: { amountUsd: string; memberAmounts?: LedgerAmountShare[] },
  member = "",
): string {
  if (member && !isJointMemberFilter(member) && row.memberAmounts?.length) {
    const hit = row.memberAmounts.find((leg) => leg.memberId === member);
    if (hit) {
      return hit.amountUsd;
    }
  }
  return row.amountUsd;
}

export function formatLedgerTradeAmount(kind: string, amountUsd: string): string {
  if (kind === "adjustment") {
    return formatSignedUsd(amountUsd);
  }
  return formatUsd(amountUsd);
}

/** Dividend / adjustment rows store price 0; the amount column holds the cash. */
export function formatLedgerTradePrice(kind: string, price: string): string {
  if (kind === "adjustment") {
    return "—";
  }
  return formatUsd(price);
}
