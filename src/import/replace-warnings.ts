import { issueId } from "./issue-id";
import { refreshPlanCounts } from "./plan";
import type { ImportPlan } from "./types";

type DestMember = { id: string; displayName: string; userId: string | null };
type DestSchedule = {
  legs: { memberId: string }[];
};

/**
 * Preview warnings for replace onto an existing book: claimed members who are
 * not on the file's Members sheet stay, and a kept schedule may name people
 * the file does not list.
 */
export function annotateReplaceWarnings(
  plan: ImportPlan,
  dest: { members: DestMember[]; schedules: DestSchedule[] },
): ImportPlan {
  if (!plan.hasMembersSheet) {
    return plan;
  }
  const listed = new Set(plan.listedMembers.map((name) => name.trim().toLowerCase()));
  const namesById = new Map(dest.members.map((row) => [row.id, row.displayName]));

  for (const member of dest.members) {
    const key = member.displayName.trim().toLowerCase();
    if (!key || listed.has(key) || !member.userId) {
      continue;
    }
    plan.issues.push({
      id: issueId("kept-member", 0, member.displayName),
      sheet: "members",
      row: 0,
      kind: "kept_member",
      message: `取代後會保留已認領成員「${member.displayName}」，之後聯名分帳會一齊攤。`,
      pending: false,
    });
  }

  if (!plan.hasAllocationSheet) {
    const missing = new Set<string>();
    for (const schedule of dest.schedules) {
      for (const leg of schedule.legs) {
        const name = namesById.get(leg.memberId)?.trim();
        if (!name) {
          continue;
        }
        if (!listed.has(name.toLowerCase())) {
          missing.add(name);
        }
      }
    }
    for (const name of missing) {
      plan.issues.push({
        id: issueId("sched-member", 0, name),
        sheet: "allocation",
        row: 0,
        kind: "schedule_member_missing",
        message: `檔案無 Allocation 表，會保留現有分配；分配裏嘅「${name}」唔喺檔案 Members。`,
        pending: false,
      });
    }
  }

  refreshPlanCounts(plan);
  return plan;
}
