import { issueId } from "./issue-id";
import { refreshPlanCounts } from "./plan";
import type { ImportPlan } from "./types";

type DestMember = {
  id: string;
  displayName: string;
  userId: string | null;
  hasPendingInvite?: boolean;
};
type DestSchedule = {
  legs: { memberId: string }[];
};

function isClaimedSeat(member: DestMember): boolean {
  return Boolean(member.userId || member.hasPendingInvite);
}

/**
 * Preview warnings for re-import onto an existing book: claimed seats stay,
 * unclaimed leftovers are named as remove-on-replace, and a kept schedule may
 * name people the file does not list.
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
  const scheduleMemberIds = new Set(
    dest.schedules.flatMap((schedule) => schedule.legs.map((leg) => leg.memberId)),
  );

  for (const member of dest.members) {
    const key = member.displayName.trim().toLowerCase();
    if (!key || listed.has(key)) {
      continue;
    }
    if (isClaimedSeat(member)) {
      plan.issues.push({
        id: issueId("kept-member", 0, member.displayName),
        sheet: "members",
        row: 0,
        own: member.displayName,
        kind: "kept_member",
        message: `已認領或已邀請成員「${member.displayName}」唔喺檔案 Members；取代同追加都會留低，之後聯名分帳會一齊攤。`,
        pending: false,
      });
      continue;
    }
    if (!plan.hasAllocationSheet && scheduleMemberIds.has(member.id)) {
      continue;
    }
    plan.issues.push({
      id: issueId("removed-member", 0, member.displayName),
      sheet: "members",
      row: 0,
      own: member.displayName,
      kind: "removed_member",
      message: `取代會刪走未認領成員「${member.displayName}」。追加唔會刪。`,
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
        message: `檔案無 Allocation 表，會保留現有分配；分配裏嘅「${name}」唔喺檔案 Members，之後聯名買賣仍會按呢份分配攤。`,
        pending: false,
      });
    }
  }

  refreshPlanCounts(plan);
  return plan;
}
