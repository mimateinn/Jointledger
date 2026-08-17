import type { Member } from "@/ledger/types";
import type { LotMarks } from "@/ledger/summary";
import { money } from "@/ledger/money";
import { addMonths, eachDay, yearStart } from "./dates";
import { modifiedDietz, type DietzResult } from "./dietz";
import {
  externalFlowsInWindow,
  snapshotAt,
  startAsOf,
  unmarkedSymbols,
  type DatedLedger,
} from "./snapshot";

export type PeriodKey = "1m" | "3m" | "ytd" | "custom";

export type MemberCurvePoint = {
  date: string;
  percent: string | null;
  periodPnlUsd: string;
};

export type MemberReturn = DietzResult & {
  memberId: string;
  displayName: string;
  points: MemberCurvePoint[];
};

export type ReturnsReport = {
  periodStart: string;
  periodEnd: string;
  periodKey: PeriodKey;
  book: DietzResult;
  members: MemberReturn[];
  plotMode: "percent" | "usd" | "insufficient";
  oldSheetPnlUsd: string | null;
};

export function resolvePeriod(
  key: PeriodKey,
  today: string,
  customStart?: string,
  customEnd?: string,
): { start: string; end: string } {
  if (key === "custom" && customStart && customEnd && customStart <= customEnd) {
    return { start: customStart, end: customEnd };
  }
  if (key === "3m") {
    return { start: addMonths(today, -3), end: today };
  }
  if (key === "ytd") {
    return { start: yearStart(today), end: today };
  }
  return { start: addMonths(today, -1), end: today };
}

function dietzForSlice(
  ledger: DatedLedger,
  marks: LotMarks,
  periodStart: string,
  periodEnd: string,
  memberId?: string | null,
): DietzResult {
  const startSnap = snapshotAt(ledger, startAsOf(periodStart), marks, memberId);
  const endSnap = snapshotAt(ledger, periodEnd, marks, memberId);
  const missingMark =
    unmarkedSymbols(startSnap.lots, marks).length > 0 || unmarkedSymbols(endSnap.lots, marks).length > 0;
  return modifiedDietz({
    startNavUsd: startSnap.navUsd,
    endNavUsd: endSnap.navUsd,
    flows: externalFlowsInWindow(ledger.cashFlows, periodStart, periodEnd, memberId),
    periodStart,
    periodEnd,
    missingMark,
  });
}

function curveForMember(
  ledger: DatedLedger,
  marks: LotMarks,
  periodStart: string,
  periodEnd: string,
  memberId: string,
): MemberCurvePoint[] {
  return eachDay(periodStart, periodEnd).map((date) => {
    const point = dietzForSlice(ledger, marks, periodStart, date, memberId);
    return { date, percent: point.dietzPercent, periodPnlUsd: point.periodPnlUsd };
  });
}

export function buildReturnsReport(input: {
  ledger: DatedLedger;
  marks: LotMarks;
  members: Member[];
  periodKey: PeriodKey;
  today: string;
  customStart?: string;
  customEnd?: string;
  oldSheetPnlUsd?: string | null;
}): ReturnsReport {
  const { start, end } = resolvePeriod(input.periodKey, input.today, input.customStart, input.customEnd);
  const book = dietzForSlice(input.ledger, input.marks, start, end);
  const members = input.members.map((member) => {
    const slice = dietzForSlice(input.ledger, input.marks, start, end, member.id);
    return {
      ...slice,
      memberId: member.id,
      displayName: member.displayName,
      points: curveForMember(input.ledger, input.marks, start, end, member.id),
    };
  });

  const anyMissing = book.percentBlocked === "missing_mark" || members.some((row) => row.percentBlocked === "missing_mark");
  const anyZero = book.percentBlocked === "zero_capital" && members.every((row) => row.percentBlocked === "zero_capital");
  const anyPercent = book.dietzPercent != null || members.some((row) => row.dietzPercent != null);

  let plotMode: ReturnsReport["plotMode"] = "percent";
  if (anyMissing && !anyPercent) {
    plotMode = "insufficient";
  } else if (!anyPercent || anyZero) {
    plotMode = "usd";
  }

  return {
    periodStart: start,
    periodEnd: end,
    periodKey: input.periodKey,
    book,
    members,
    plotMode,
    oldSheetPnlUsd: input.oldSheetPnlUsd ?? null,
  };
}

export function formatDietzPercent(value: string | null): string {
  if (value == null) {
    return "—";
  }
  const n = money(value);
  const abs = n.abs().toFixed(2);
  if (n.gt(0)) {
    return `+${abs}%`;
  }
  if (n.lt(0)) {
    return `-${abs}%`;
  }
  return `${abs}%`;
}
