"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/session";
import { createDrizzleStore } from "@/db/drizzle-store";
import { addMember } from "@/ledger";
import { getCurrentMembership } from "@/lib/current-book";

export type MemberState = { error?: string; ok?: string };

export async function addMemberAction(
  _prev: MemberState,
  formData: FormData,
): Promise<MemberState> {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return { error: "未有記帳表" };
  }

  try {
    const store = createDrizzleStore();
    await addMember(store, {
      bookId: ctx.book.id,
      displayName: String(formData.get("displayName") ?? ""),
      email: String(formData.get("email") ?? "") || null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "加成員失敗" };
  }

  revalidatePath("/account");
  revalidatePath("/overview");
  revalidatePath("/entry");
  return { ok: "已加入成員" };
}
