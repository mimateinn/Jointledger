"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/session";
import { createDrizzleStore } from "@/db/drizzle-store";
import { createCashFlow, createTrade } from "@/ledger";
import { getCurrentMembership } from "@/lib/current-book";

export type EntryState = { error?: string; ok?: string };

export async function createDepositAction(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return { error: "未有記帳表" };
  }

  const memberId = String(formData.get("memberId") ?? "");
  const member = ctx.members.find((row) => row.id === memberId);
  const account = ctx.accounts.find((row) => row.memberId === memberId && row.kind === "personal");
  if (!member || !account) {
    return { error: "搵唔到呢個成員" };
  }

  try {
    const store = createDrizzleStore();
    await createCashFlow(store, {
      bookId: ctx.book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: String(formData.get("amountHkd") ?? ""),
      fxRate: String(formData.get("fxRate") ?? ""),
      occurredOn: String(formData.get("occurredOn") ?? ""),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "入金失敗" };
  }

  revalidatePath("/overview");
  revalidatePath("/ledger");
  revalidatePath("/entry");
  return { ok: "已記入入金" };
}

export async function createBuyAction(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return { error: "未有記帳表" };
  }

  const ledgerAccountId = String(formData.get("ledgerAccountId") ?? "");
  const account = ctx.accounts.find((row) => row.id === ledgerAccountId);
  if (!account?.memberId) {
    return { error: "搵唔到帳簿" };
  }

  try {
    const store = createDrizzleStore();
    await createTrade(store, {
      bookId: ctx.book.id,
      ledgerAccountId: account.id,
      memberId: account.memberId,
      symbol: String(formData.get("symbol") ?? ""),
      quantity: String(formData.get("quantity") ?? ""),
      price: String(formData.get("price") ?? ""),
      occurredOn: String(formData.get("occurredOn") ?? ""),
      note: String(formData.get("note") ?? "") || null,
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "記帳失敗" };
  }

  revalidatePath("/overview");
  revalidatePath("/holdings");
  revalidatePath("/ledger");
  revalidatePath("/entry");
  return { ok: "已記入加倉" };
}
