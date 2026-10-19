import { money } from "@/ledger/money";
import { normalizeScheduleLegs } from "./canon";
import { headerIndex } from "./columns";
import { issueId } from "./issue-id";
import type { ImportIssue, ParsedSheet, PlannedAllocationSchedule } from "./types";
import { parseDate, parseMoney } from "./values";

function parsePercentRaw(raw: string): string | null {
  return parseMoney(raw.replace(/%/g, ""));
}

function allocIssue(issues: ImportIssue[], id: string, row: number, message: string): void {
  issues.push({
    id,
    sheet: "allocation",
    row,
    kind: "allocation_invalid",
    message,
    pending: false,
  });
}

export function parseAllocationSheet(
  sheet: ParsedSheet | undefined,
  listedMembers: readonly string[],
  issues: ImportIssue[],
): PlannedAllocationSchedule[] {
  if (!sheet) {
    return [];
  }
  const dateIndex = headerIndex(sheet.headers, ["effectivedate", "effectiveon", "date", "生效日", "日期"]);
  const memberIndex = headerIndex(sheet.headers, ["member", "name", "holder", "成員", "姓名"]);
  const percentIndex = headerIndex(sheet.headers, ["percent", "percentage", "ratio", "share", "比例", "百分比"]);
  if (dateIndex < 0 || memberIndex < 0 || percentIndex < 0) {
    allocIssue(issues, "alloc-headers", 0, "Allocation 表頭缺必要欄（Effective Date / Member / Percent）。");
    return [];
  }

  const listed = new Set(listedMembers.map((name) => name.trim().toLowerCase()));
  const groups = new Map<string, { name: string; raw: string; row: number }[]>();
  const seenOnDate = new Map<string, Map<string, number>>();
  const invalidDates = new Set<string>();
  for (const [index, row] of sheet.rows.entries()) {
    const excelRow = index + 2;
    const dateRaw = (row[dateIndex] ?? "").trim();
    const name = (row[memberIndex] ?? "").trim();
    const raw = (row[percentIndex] ?? "").trim();
    if (!dateRaw && !name && !raw) {
      continue;
    }
    const date = parseDate(dateRaw);
    if (!date || !name || !raw) {
      allocIssue(issues, issueId("alloc-row", excelRow), excelRow, `Allocation 第 ${excelRow} 行缺生效日／成員／比例。`);
      continue;
    }
    const percent = parsePercentRaw(raw);
    let valid = false;
    if (percent) {
      try {
        valid = money(percent).gt(0);
      } catch {
        valid = false;
      }
    }
    if (!percent || !valid) {
      allocIssue(
        issues,
        issueId("alloc-pct", excelRow),
        excelRow,
        `Allocation 第 ${excelRow} 行 percent「${raw}」無效。`,
      );
      continue;
    }
    if (!listed.has(name.toLowerCase())) {
      allocIssue(
        issues,
        issueId("alloc-member", excelRow, name),
        excelRow,
        `Allocation 第 ${excelRow} 行成員「${name}」唔喺 Members 表，無自動開戶。`,
      );
      continue;
    }
    const byMember = seenOnDate.get(date) ?? new Map<string, number>();
    const priorRow = byMember.get(name.toLowerCase());
    if (priorRow) {
      allocIssue(
        issues,
        issueId("alloc-dup", excelRow, name),
        excelRow,
        `Allocation 第 ${excelRow} 行成員「${name}」同第 ${priorRow} 行重複（同一生效日 ${date}）。`,
      );
      invalidDates.add(date);
      continue;
    }
    byMember.set(name.toLowerCase(), excelRow);
    seenOnDate.set(date, byMember);
    const list = groups.get(date) ?? [];
    list.push({ name, raw: percent, row: excelRow });
    groups.set(date, list);
  }

  const schedules: PlannedAllocationSchedule[] = [];
  for (const [effectiveOn, legs] of [...groups.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (invalidDates.has(effectiveOn)) {
      continue;
    }
    try {
      schedules.push({
        effectiveOn,
        legs: normalizeScheduleLegs(legs).map((leg) => ({
          memberName: leg.name,
          percent: leg.percent,
        })),
      });
    } catch {
      const row = legs[0]?.row ?? 0;
      allocIssue(issues, issueId("alloc-sum", row), row, `Allocation 第 ${row} 行 percent 無法正規化。`);
    }
  }
  return schedules;
}
