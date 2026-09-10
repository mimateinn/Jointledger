import { money, moneyString } from "./money";
import type { CreateTradeLeg } from "./types";

function splitByPercents(total: string, percents: string[]): string[] {
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

/**
 * Joint buy/sell legs from the allocation schedule in force.
 * When no schedule exists, split equally across book members (same 50/50 as import's Hey/Sze default on a two-member book).
 */
export function jointTradeLegs(input: {
  scheduleLegs: { memberId: string; percent: string }[] | null | undefined;
  members: { id: string }[];
  quantity: string;
  total: string;
  field?: "cost" | "proceeds";
}): CreateTradeLeg[] {
  const scheduled = (input.scheduleLegs ?? []).filter((leg) => money(leg.percent).gt(0));
  const source =
    scheduled.length > 0
      ? scheduled
      : input.members.map((member) => ({
          memberId: member.id,
          percent: money("1").div(Math.max(input.members.length, 1)).toString(),
        }));
  if (source.length === 0) {
    return [];
  }
  const percents = source.map((leg) => leg.percent);
  const quantities = splitByPercents(input.quantity, percents);
  const amounts = splitByPercents(input.total, percents);
  const field = input.field ?? "cost";
  return source.map((leg, index) => ({
    memberId: leg.memberId,
    quantity: quantities[index],
    costUsd: field === "cost" ? amounts[index] : "0",
    proceedsUsd: field === "proceeds" ? amounts[index] : "0",
  }));
}
