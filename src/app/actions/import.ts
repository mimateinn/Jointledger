"use server";

import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { writeInvite } from "@/auth/invite-persist";
import { requireUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { createDrizzleStore } from "@/db/drizzle-store";
import { withLedgerTransaction } from "@/db/ledger-tx";
import { importBatches } from "@/db/tables";
import { applyImport } from "@/import/apply";
import { commitBlockingResponse, previewBlockingMessage } from "@/import/blocking";
import { applyManualMap, mapUpload } from "@/import/columns";
import { readInviteSecret } from "@/import/invite-secrets";
import { parseUpload, pickOptionalSheets, pickSheets } from "@/import/parse";
import { buildPlan } from "@/import/plan";
import { annotateReplaceWarnings } from "@/import/replace-warnings";
import type { ColumnTarget, ImportDecisions, ImportPlan, PendingChoice } from "@/import/types";
import { getCurrentMembership } from "@/lib/current-book";

export type IssuedInvite = { displayName: string; inviteSecret: string };

export type ImportActionState = {
  error?: string;
  draftId?: string;
  filename?: string;
  fileHash?: string;
  blocking?: boolean;
  needsMap?: boolean;
  needsReimport?: boolean;
  preview?: ImportPlan;
  transinfoHeaders?: string[];
  accountHeaders?: string[];
  transinfoTargets?: Array<ColumnTarget | null>;
  accountTargets?: Array<ColumnTarget | null>;
  issuedInvites?: IssuedInvite[];
};

type DraftPayload = {
  filename: string;
  fileHash: string;
  transinfo: { name: string; headers: string[]; rows: string[][] };
  account: { name: string; headers: string[]; rows: string[][] };
  membersSheet?: { name: string; headers: string[]; rows: string[][] };
  allocationSheet?: { name: string; headers: string[]; rows: string[][] };
  tradeSplitsSheet?: { name: string; headers: string[]; rows: string[][] };
  plan: ImportPlan;
  transinfoTargets: Array<ColumnTarget | null>;
  accountTargets: Array<ColumnTarget | null>;
};

async function readFiles(formData: FormData): Promise<{ name: string; bytes: Uint8Array }[]> {
  const files = formData
    .getAll("files")
    .filter((item): item is File => typeof File !== "undefined" && item instanceof File && item.size > 0);
  if (files.length === 0) {
    throw new Error("要上傳 csv 或 xlsx");
  }
  return Promise.all(
    files.map(async (file) => ({
      name: file.name,
      bytes: new Uint8Array(await file.arrayBuffer()),
    })),
  );
}

function asPreview(plan: ImportPlan): ImportPlan {
  return plan;
}

function isReimport(formData: FormData): boolean {
  return String(formData.get("reimport") ?? "") === "1";
}

export async function parseImportAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const user = await requireUser();
  const existing = await getCurrentMembership(user);
  const reimport = isReimport(formData);
  if (existing && !reimport) {
    redirect("/overview");
  }
  if (reimport && !existing) {
    return { error: "再匯入只限現有記帳表" };
  }

  try {
    const files = await readFiles(formData);
    const parsed = await parseUpload(files);
    const { transinfo, account } = pickSheets(parsed);
    const extras = pickOptionalSheets(parsed);
    const mapping = mapUpload(transinfo, account);
    const plan = buildPlan(parsed.filename, parsed.fileHash, transinfo, account, mapping, extras);
    if (reimport && existing) {
      const destStore = createDrizzleStore();
      annotateReplaceWarnings(plan, {
        members: await destStore.listMembers(existing.book.id),
        schedules: await destStore.listAllocationSchedules(existing.book.id),
      });
    }
    const db = getDb();
    const payload: DraftPayload = {
      filename: parsed.filename,
      fileHash: parsed.fileHash,
      transinfo: { name: transinfo.name, headers: transinfo.headers, rows: transinfo.rows },
      account: { name: account.name, headers: account.headers, rows: account.rows },
      membersSheet: extras.members
        ? { name: extras.members.name, headers: extras.members.headers, rows: extras.members.rows }
        : undefined,
      allocationSheet: extras.allocation
        ? {
            name: extras.allocation.name,
            headers: extras.allocation.headers,
            rows: extras.allocation.rows,
          }
        : undefined,
      tradeSplitsSheet: extras.tradeSplits
        ? {
            name: extras.tradeSplits.name,
            headers: extras.tradeSplits.headers,
            rows: extras.tradeSplits.rows,
          }
        : undefined,
      plan,
      transinfoTargets: mapping.transinfo.targets,
      accountTargets: mapping.account.targets,
    };
    const [draft] = await db
      .insert(importBatches)
      .values({
        createdByUserId: user.id,
        filename: parsed.filename,
        fileHash: parsed.fileHash,
        status: "draft",
        plan: payload,
      })
      .returning();

    return {
      draftId: draft.id,
      filename: parsed.filename,
      fileHash: parsed.fileHash,
      blocking: plan.blocking,
      needsMap: mapping.blocking,
      preview: asPreview(plan),
      transinfoHeaders: transinfo.headers,
      accountHeaders: account.headers,
      transinfoTargets: mapping.transinfo.targets,
      accountTargets: mapping.account.targets,
      error: mapping.blocking ? undefined : previewBlockingMessage(plan) ?? undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "匯入失敗" };
  }
}

export async function confirmMapAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const user = await requireUser();
  const draftId = String(formData.get("draftId") ?? "");
  if (!draftId) {
    return { error: "找不到草稿" };
  }

  try {
    const db = getDb();
    const [draft] = await db
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, draftId), eq(importBatches.createdByUserId, user.id)))
      .limit(1);
    if (!draft?.plan || draft.status !== "draft") {
      return { error: "草稿已失效" };
    }
    const payload = draft.plan as DraftPayload;
    const transinfoTargets = payload.transinfo.headers.map((_, index) =>
      String(formData.get(`ti-${index}`) || "ignore"),
    ) as Array<ColumnTarget | null>;
    const accountTargets = payload.account.headers.map((_, index) =>
      String(formData.get(`ad-${index}`) || "ignore"),
    ) as Array<ColumnTarget | null>;

    const transinfo = { ...payload.transinfo, kind: "transinfo" as const };
    const account = { ...payload.account, kind: "account" as const };
    const extras = {
      members: payload.membersSheet
        ? { ...payload.membersSheet, kind: "members" as const }
        : undefined,
      allocation: payload.allocationSheet
        ? { ...payload.allocationSheet, kind: "allocation" as const }
        : undefined,
      tradeSplits: payload.tradeSplitsSheet
        ? { ...payload.tradeSplitsSheet, kind: "tradesplits" as const }
        : undefined,
    };
    const ti = applyManualMap("transinfo", transinfo.headers, transinfoTargets);
    const ad = applyManualMap("account", account.headers, accountTargets);
    const mapping = {
      transinfo: ti.map,
      account: ad.map,
      issues: [...ti.issues, ...ad.issues],
      blocking: ti.issues.length + ad.issues.length > 0,
    };
    const plan = buildPlan(payload.filename, payload.fileHash, transinfo, account, mapping, extras);
    const membership = await getCurrentMembership(user);
    if (isReimport(formData) && membership) {
      const destStore = createDrizzleStore();
      annotateReplaceWarnings(plan, {
        members: await destStore.listMembers(membership.book.id),
        schedules: await destStore.listAllocationSchedules(membership.book.id),
      });
    }
    const next: DraftPayload = {
      ...payload,
      plan,
      transinfoTargets: mapping.transinfo.targets,
      accountTargets: mapping.account.targets,
    };
    await db.update(importBatches).set({ plan: next }).where(eq(importBatches.id, draftId));

    return {
      draftId,
      filename: payload.filename,
      fileHash: payload.fileHash,
      blocking: plan.blocking,
      needsMap: mapping.blocking,
      preview: asPreview(plan),
      transinfoHeaders: transinfo.headers,
      accountHeaders: account.headers,
      transinfoTargets: mapping.transinfo.targets,
      accountTargets: mapping.account.targets,
      error: mapping.blocking ? undefined : previewBlockingMessage(plan) ?? undefined,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "欄位對唔上" };
  }
}

export async function commitImportAction(
  _prev: ImportActionState,
  formData: FormData,
): Promise<ImportActionState> {
  const user = await requireUser();
  const membership = await getCurrentMembership(user);
  const reimport = isReimport(formData);
  if (membership && !reimport) {
    redirect("/overview");
  }
  if (reimport && !membership) {
    return { error: "再匯入只限現有記帳表" };
  }

  const draftId = String(formData.get("draftId") ?? "");
  const bookName = String(formData.get("bookName") ?? "聯倉").trim() || "聯倉";
  const reimportMode = String(formData.get("reimportMode") ?? "") as ImportDecisions["reimportMode"] | "";

  try {
    const db = getDb();
    const [draft] = await db
      .select()
      .from(importBatches)
      .where(and(eq(importBatches.id, draftId), eq(importBatches.createdByUserId, user.id)))
      .limit(1);
    if (!draft?.plan || draft.status !== "draft") {
      return { error: "草稿已失效" };
    }
    const payload = draft.plan as DraftPayload;
    const blocked = commitBlockingResponse(payload.plan);
    if (blocked) {
      return {
        error: blocked.error,
        draftId,
        blocking: true,
        needsMap: blocked.needsMap,
        preview: payload.plan,
        transinfoHeaders: payload.transinfo.headers,
        accountHeaders: payload.account.headers,
        transinfoTargets: payload.transinfoTargets,
        accountTargets: payload.accountTargets,
      };
    }

    const [prior] = await db
      .select()
      .from(importBatches)
      .where(
        and(
          eq(importBatches.fileHash, payload.fileHash),
          eq(importBatches.createdByUserId, user.id),
          inArray(importBatches.status, ["success", "warning"]),
        ),
      )
      .limit(1);
    if (reimport && reimportMode !== "append" && reimportMode !== "replace") {
      return {
        draftId,
        filename: payload.filename,
        fileHash: payload.fileHash,
        needsReimport: true,
        preview: payload.plan,
        error: "再匯入要明示追加或取代。",
      };
    }
    if (prior && !reimport && reimportMode !== "append" && reimportMode !== "replace") {
      return {
        draftId,
        filename: payload.filename,
        fileHash: payload.fileHash,
        needsReimport: true,
        preview: payload.plan,
        error: "呢份檔已匯入過。揀追加或取代，唔會默認重複入數。",
      };
    }

    const decisions: ImportDecisions = {
      pending: {},
      reimportMode:
        reimportMode === "append" || reimportMode === "replace" ? reimportMode : "initial",
      bookName,
    };
    for (const issue of payload.plan.issues.filter((item) => item.pending)) {
      const pick = String(formData.get(`pending-${issue.id}`) ?? "") as PendingChoice | "";
      if (pick === "import" || pick === "skip") {
        decisions.pending[issue.id] = pick;
      }
    }
    const bulk = String(formData.get("pendingBulk") ?? "") as PendingChoice | "";
    if (bulk === "import" || bulk === "skip") {
      for (const issue of payload.plan.issues.filter((item) => item.pending)) {
        if (!decisions.pending[issue.id]) {
          decisions.pending[issue.id] = bulk;
        }
      }
    }

    await db.update(importBatches).set({ status: "pending", mode: decisions.reimportMode ?? "initial" }).where(eq(importBatches.id, draftId));

    try {
      const result = await withLedgerTransaction((store) =>
        applyImport(store, payload.plan, {
          createdByUserId: user.id,
          creatorDisplayName: user.displayName,
          creatorEmail: user.email,
          bookName,
          decisions,
          existingBookId: reimport ? membership?.book.id : undefined,
        }),
      );
      const status = result.warningCount > 0 ? "warning" : result.cashFlowCount + result.tradeCount === 0 ? "skipped" : "success";
      await db
        .update(importBatches)
        .set({
          bookId: result.bookId,
          status,
          cashFlowCount: result.cashFlowCount,
          tradeCount: result.tradeCount,
          warningCount: result.warningCount,
          skippedCount: result.skippedCount,
          rowLog: result.rowLog,
          mode: decisions.reimportMode ?? "initial",
        })
        .where(eq(importBatches.id, draftId));

      if (!reimport) {
        const store = createDrizzleStore();
        const bookMembers = await store.listMembers(result.bookId);
        const issuedInvites: IssuedInvite[] = [];
        for (const member of bookMembers) {
          if (member.userId) {
            continue;
          }
          const inviteSecret = await writeInvite(
            member.id,
            result.bookId,
            readInviteSecret(formData, member.displayName),
          );
          issuedInvites.push({ displayName: member.displayName, inviteSecret });
        }
        if (issuedInvites.length > 0) {
          return {
            draftId,
            filename: payload.filename,
            fileHash: payload.fileHash,
            preview: payload.plan,
            issuedInvites,
          };
        }
      }
    } catch (error) {
      await db
        .update(importBatches)
        .set({
          status: "failed",
          rowLog: [{ id: "commit", status: "skipped", message: error instanceof Error ? error.message : "寫入失敗" }],
        })
        .where(eq(importBatches.id, draftId));
      return {
        draftId,
        error: error instanceof Error ? error.message : "寫入失敗",
        preview: payload.plan,
      };
    }
  } catch (error) {
    return { error: error instanceof Error ? error.message : "匯入失敗" };
  }

  redirect("/overview");
}
