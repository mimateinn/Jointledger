import type { ImportIssue, ImportPlan } from "./types";

const HOLDER_KINDS = new Set(["unknown_member", "empty_holder", "ambiguous_holder"]);
const MAP_KINDS = new Set(["unmapped_column", "column_collision", "missing_required"]);

export function holderBlockingIssues(plan: Pick<ImportPlan, "issues">): ImportIssue[] {
  return plan.issues.filter((issue) => HOLDER_KINDS.has(issue.kind));
}

export function allocationBlockingIssues(plan: Pick<ImportPlan, "issues">): ImportIssue[] {
  return plan.issues.filter(
    (issue) =>
      issue.kind === "allocation_invalid" ||
      issue.kind === "tradesplit_invalid" ||
      issue.kind === "duplicate_member",
  );
}

export function mappingBlockingIssues(plan: Pick<ImportPlan, "issues">): ImportIssue[] {
  return plan.issues.filter((issue) => MAP_KINDS.has(issue.kind));
}

export function holderBlockingMessage(plan: Pick<ImportPlan, "issues">): string | null {
  const issues = holderBlockingIssues(plan);
  if (issues.length === 0) {
    return null;
  }
  return issues.map((issue) => issue.message).join("\n");
}

/** How confirm should fail when the plan is already blocking. Mapping form only for column-map issues. */
export function commitBlockingResponse(
  plan: Pick<ImportPlan, "issues" | "blocking">,
): { error: string; needsMap: boolean } | null {
  if (!plan.blocking) {
    return null;
  }
  const holder = holderBlockingMessage(plan);
  if (holder) {
    return { error: holder, needsMap: false };
  }
  const allocation = allocationBlockingIssues(plan)[0];
  if (allocation) {
    return { error: allocation.message, needsMap: false };
  }
  if (mappingBlockingIssues(plan).length > 0) {
    return { error: "欄位未確認，零寫入。", needsMap: true };
  }
  return { error: "欄位未確認，零寫入。", needsMap: true };
}
