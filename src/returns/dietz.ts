import { Decimal } from "decimal.js";
import { money, moneyString } from "@/ledger/money";
import { daysBetween } from "./dates";

/** Average capital below this is treated as ≈ 0. One cent in USD. */
export const CAPITAL_EPS = money("0.01");

export type ExternalFlow = {
  occurredOn: string;
  amountUsd: string;
};

export type DietzInput = {
  startNavUsd: string;
  endNavUsd: string;
  flows: ExternalFlow[];
  periodStart: string;
  periodEnd: string;
  /** True when a start or end lot is unmarked. $ still computed; % is —. */
  missingMark: boolean;
};

export type DietzResult = {
  periodPnlUsd: string;
  dietzPercent: string | null;
  averageCapitalUsd: string;
  externalCfUsd: string;
  startNavUsd: string;
  endNavUsd: string;
  percentBlocked: "missing_mark" | "zero_capital" | null;
};

/**
 * Period P/L = end NAV − start NAV − external CashFlows.
 * Buys/sells are not external flows.
 */
export function periodPnlUsd(endNavUsd: string, startNavUsd: string, externalCfUsd: string): Decimal {
  return money(endNavUsd).minus(money(startNavUsd)).minus(money(externalCfUsd));
}

export function netExternalFlows(flows: ExternalFlow[]): Decimal {
  return flows.reduce((sum, flow) => sum.plus(money(flow.amountUsd)), new Decimal(0));
}

/**
 * Modified Dietz weight: w_i = (T − t_i) / T
 * t_i = calendar days from period start to the flow date.
 * Periods shorter than one year are not annualized.
 */
export function flowWeight(periodStart: string, periodEnd: string, occurredOn: string): Decimal {
  const total = daysBetween(periodStart, periodEnd);
  if (total <= 0) {
    return new Decimal(0);
  }
  const elapsed = daysBetween(periodStart, occurredOn);
  const clamped = Math.min(Math.max(elapsed, 0), total);
  return new Decimal(total - clamped).div(total);
}

export function averageCapital(
  startNavUsd: string,
  flows: ExternalFlow[],
  periodStart: string,
  periodEnd: string,
): Decimal {
  let weighted = new Decimal(0);
  for (const flow of flows) {
    weighted = weighted.plus(money(flow.amountUsd).times(flowWeight(periodStart, periodEnd, flow.occurredOn)));
  }
  return money(startNavUsd).plus(weighted);
}

/**
 * Modified Dietz. Never uses cost as a mark. Never annualizes when the window is under a year.
 * No TWR.
 */
export function modifiedDietz(input: DietzInput): DietzResult {
  const externalCf = netExternalFlows(input.flows);
  const pnl = periodPnlUsd(input.endNavUsd, input.startNavUsd, moneyString(externalCf));
  const capital = averageCapital(input.startNavUsd, input.flows, input.periodStart, input.periodEnd);
  const days = daysBetween(input.periodStart, input.periodEnd);

  if (input.missingMark) {
    return {
      periodPnlUsd: moneyString(pnl),
      dietzPercent: null,
      averageCapitalUsd: moneyString(capital),
      externalCfUsd: moneyString(externalCf),
      startNavUsd: moneyString(input.startNavUsd),
      endNavUsd: moneyString(input.endNavUsd),
      percentBlocked: "missing_mark",
    };
  }

  if (capital.abs().lt(CAPITAL_EPS)) {
    return {
      periodPnlUsd: moneyString(pnl),
      dietzPercent: null,
      averageCapitalUsd: moneyString(capital),
      externalCfUsd: moneyString(externalCf),
      startNavUsd: moneyString(input.startNavUsd),
      endNavUsd: moneyString(input.endNavUsd),
      percentBlocked: "zero_capital",
    };
  }

  const raw = pnl.div(capital);
  // Short of one year: do not annualize. M5 never annualizes.
  void days;
  return {
    periodPnlUsd: moneyString(pnl),
    dietzPercent: moneyString(raw.times(100), 8),
    averageCapitalUsd: moneyString(capital),
    externalCfUsd: moneyString(externalCf),
    startNavUsd: moneyString(input.startNavUsd),
    endNavUsd: moneyString(input.endNavUsd),
    percentBlocked: null,
  };
}
