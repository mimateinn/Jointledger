import { money, moneyString } from "@/ledger/money";

export const MEMBER_HEY = "Hey";
export const MEMBER_SZE = "Sze";
export const MEMBER_WAH = "Wah";

export function normalizeScheduleLegs(legs: readonly { name: string; raw: string }[]) {
  const total = legs.reduce((sum, leg) => sum.plus(money(leg.raw)), money("0"));
  return legs.map((leg) => ({
    name: leg.name,
    percent: moneyString(money(leg.raw).div(total)),
  }));
}

export function splitByPercents(total: string, percents: string[]): string[] {
  const value = money(total);
  const out: string[] = [];
  let left = value;
  for (let i = 0; i < percents.length; i += 1) {
    if (i === percents.length - 1) {
      out.push(moneyString(left));
      break;
    }
    const part = value.mul(money(percents[i]));
    left = left.minus(part);
    out.push(moneyString(part));
  }
  return out;
}
