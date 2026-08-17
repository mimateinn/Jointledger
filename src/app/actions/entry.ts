"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/session";
import { createDrizzleStore } from "@/db/drizzle-store";
import { withLedgerTransaction } from "@/db/ledger-tx";
import { createCashFlow, createTrade, deleteLot } from "@/ledger";
import { getCurrentMembership } from "@/lib/current-book";
import { humanFormError } from "@/lib/human-error";

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
    return { error: humanFormError(error instanceof Error ? error.message : "入金失敗") };
  }

  revalidatePath("/overview");
  revalidatePath("/ledger");
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
  const memberId = account?.memberId;
  if (!account || !memberId) {
    return { error: "搵唔到帳簿" };
  }

  try {
    await withLedgerTransaction((store) =>
      createTrade(store, {
        bookId: ctx.book.id,
        ledgerAccountId: account.id,
        memberId,
        symbol: String(formData.get("symbol") ?? ""),
        quantity: String(formData.get("quantity") ?? ""),
        price: String(formData.get("price") ?? ""),
        occurredOn: String(formData.get("occurredOn") ?? ""),
        note: String(formData.get("note") ?? "") || null,
      }),
    );
  } catch (error) {
    return { error: humanFormError(error instanceof Error ? error.message : "記帳失敗") };
  }

  revalidatePath("/overview");
  revalidatePath("/holdings");
  revalidatePath("/ledger");
  return { ok: "已記入加倉" };
}

export async function deleteHoldingAction(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return { error: "未有記帳表" };
  }
  const confirmed = String(formData.get("confirm") ?? "") === "1";
  if (!confirmed) {
    return { error: "要確認先刪" };
  }
  try {
    await withLedgerTransaction((store) =>
      deleteLot(store, {
        bookId: ctx.book.id,
        tradeId: String(formData.get("tradeId") ?? ""),
        memberId: String(formData.get("memberId") ?? ""),
      }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "刪持倉失敗" };
  }
  revalidatePath("/overview");
  revalidatePath("/holdings");
  revalidatePath("/ledger");
  revalidatePath("/returns");
  revalidatePath("/entry");
  return { ok: "已刪持倉" };
}
