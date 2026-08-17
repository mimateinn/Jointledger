import type { ImportPlan } from "./types";
import { money, moneyString } from "@/ledger/money";

/** Sum old-sheet Net P/L from an import plan. Never a ledger write. */
export function sumSheetPnl(plan: ImportPlan): string | null {
  const values = plan.trades.map((row) => row.sheetPnl).filter((row): row is string => Boolean(row));
  if (values.length === 0) {
    return null;
  }
  return moneyString(values.reduce((sum, row) => sum.plus(money(row)), money("0")));
}
