import { Decimal } from "decimal.js";

Decimal.set({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

export type MoneyInput = string | Decimal;

export function money(value: MoneyInput): Decimal {
  if (value instanceof Decimal) {
    return value;
  }
  const trimmed = value.trim();
  if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) {
    throw new Error("金額格式不正確");
  }
  return new Decimal(trimmed);
}

export function moneyString(value: MoneyInput, scale = 8): string {
  return money(value).toFixed(scale);
}

export function isPositive(value: MoneyInput): boolean {
  return money(value).gt(0);
}
