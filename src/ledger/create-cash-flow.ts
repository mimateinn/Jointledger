import { isPositive, money, moneyString } from "./money";
import type { LedgerStore } from "./store";
import type { CashFlow, CreateCashFlowInput } from "./types";

export function deriveAmountUsd(amountHkd: string, fxRate: string): string {
  const hkd = money(amountHkd);
  const rate = money(fxRate);
  if (!isPositive(hkd)) {
    throw new Error("金額必須大於 0");
  }
  if (!isPositive(rate)) {
    throw new Error("匯率必須大於 0");
  }
  return moneyString(hkd.div(rate));
}

export async function createCashFlow(
  store: LedgerStore,
  input: CreateCashFlowInput,
): Promise<CashFlow> {
  const amountUsd = deriveAmountUsd(input.amountHkd, input.fxRate);
  const kind = input.kind ?? "deposit";
  const signedUsd = kind === "withdrawal" ? money(amountUsd).negated() : money(amountUsd);

  return store.insertCashFlow({
    bookId: input.bookId,
    memberId: input.memberId,
    ledgerAccountId: input.ledgerAccountId,
    kind,
    amountHkd: moneyString(input.amountHkd),
    fxRate: moneyString(input.fxRate),
    amountUsd: moneyString(signedUsd),
    occurredOn: input.occurredOn,
  });
}
