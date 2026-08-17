"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { hashPassword } from "@/auth/password";
import { inviteExpiry, mintInviteSecret } from "@/auth/invite";
import { requireUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { createDrizzleStore } from "@/db/drizzle-store";
import { members } from "@/db/tables";
import { addMember } from "@/ledger";
import { getCurrentMembership } from "@/lib/current-book";

export type MemberState = {
  error?: string;
  ok?: string;
  inviteSecret?: string;
  inviteFor?: string;
};

async function requireBook() {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return { error: "未有記帳表" as const };
  }
  return { user, ctx };
}

async function writeInvite(memberId: string, bookId: string): Promise<string> {
  const secret = mintInviteSecret();
  const db = getDb();
  await db
    .update(members)
    .set({
      inviteSecretHash: await hashPassword(secret),
      inviteExpiresAt: inviteExpiry(),
    })
    .where(and(eq(members.id, memberId), eq(members.bookId, bookId)));
  return secret;
}

export async function addMemberAction(
  _prev: MemberState,
  formData: FormData,
): Promise<MemberState> {
  const loaded = await requireBook();
  if ("error" in loaded) {
    return { error: loaded.error };
  }

  try {
    const store = createDrizzleStore();
    const added = await addMember(store, {
      bookId: loaded.ctx.book.id,
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? "") || null,
    });
    const inviteSecret = await writeInvite(added.member.id, loaded.ctx.book.id);
    revalidatePath("/account");
    revalidatePath("/overview");
    revalidatePath("/entry");
    return {
      ok: "已加入成員。密鑰只顯示一次，抄低之後離線交俾對方。",
      inviteSecret,
      inviteFor: added.member.displayName,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "加成員失敗" };
  }
}

/** Mint a new single-use secret for an unclaimed member of this book. */
export async function issueInviteAction(
  _prev: MemberState,
  formData: FormData,
): Promise<MemberState> {
  const loaded = await requireBook();
  if ("error" in loaded) {
    return { error: loaded.error };
  }
  const memberId = String(formData.get("memberId") ?? "");
  const target = loaded.ctx.members.find((row) => row.id === memberId);
  if (!target || target.userId) {
    return { error: "只能向未設密碼嘅成員發邀請" };
  }
  try {
    const inviteSecret = await writeInvite(target.id, loaded.ctx.book.id);
    revalidatePath("/account");
    return {
      ok: "已發出邀請密鑰。只顯示一次，抄低之後離線交俾對方。",
      inviteSecret,
      inviteFor: target.displayName,
    };
  } catch (error) {
    return { error: error instanceof Error ? error.message : "發邀請失敗" };
  }
}
