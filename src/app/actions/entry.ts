"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/auth/session";
import { createDrizzleStore } from "@/db/drizzle-store";
import { withLedgerTransaction } from "@/db/ledger-tx";
import { checkDeleteEntry, createAdjustment, createCashFlow, createSplit, createTrade, deleteEntry, deleteLot, dividendNote } from "@/ledger";
import { getCurrentMembership } from "@/lib/current-book";
import { ISO_DATE_INVALID, requireIsoDate } from "@/lib/format";
import { humanFormError } from "@/lib/human-error";
import { refreshMarksAfterSplit } from "@/quotes";

function readOccurredOn(formData: FormData): { occurredOn: string } | { error: string } {
  try {
    return { occurredOn: requireIsoDate(String(formData.get("occurredOn") ?? "")) };
  } catch (error) {
    return { error: error instanceof Error ? error.message : ISO_DATE_INVALID };
  }
}

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

  const occurredOn = readOccurredOn(formData);
  if ("error" in occurredOn) {
    return occurredOn;
  }

  try {
    const store = createDrizzleStore();
    await createCashFlow(store, {
      bookId: ctx.book.id,
      memberId: member.id,
      ledgerAccountId: account.id,
      amountHkd: String(formData.get("amountHkd") ?? ""),
      fxRate: String(formData.get("fxRate") ?? ""),
      occurredOn: occurredOn.occurredOn,
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
  if (!account) {
    return { error: "搵唔到帳簿" };
  }
  const joint = account.kind === "joint";
  const memberId = account.memberId ?? ctx.members[0]?.id;
  if ((!joint && !account.memberId) || !memberId) {
    return { error: "搵唔到帳簿" };
  }

  const occurredOn = readOccurredOn(formData);
  if ("error" in occurredOn) {
    return occurredOn;
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
        occurredOn: occurredOn.occurredOn,
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

export async function createBookkeepingAction(
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
  if (!account) {
    return { error: "搵唔到帳簿" };
  }
  const joint = account.kind === "joint";
  const memberId = account.memberId ?? ctx.members[0]?.id;
  if ((!joint && !account.memberId) || !memberId) {
    return { error: "搵唔到帳簿" };
  }

  const kind = String(formData.get("kind") ?? "adjustment");
  const symbol = String(formData.get("symbol") ?? "");
  const occurredOn = readOccurredOn(formData);
  if ("error" in occurredOn) {
    return occurredOn;
  }
  try {
    await withLedgerTransaction((store) => {
      if (kind === "split") {
        return createSplit(store, {
          bookId: ctx.book.id,
          ledgerAccountId: account.id,
          memberId,
          symbol,
          newShares: String(formData.get("newShares") ?? ""),
          oldShares: String(formData.get("oldShares") ?? ""),
          occurredOn: occurredOn.occurredOn,
          note: String(formData.get("note") ?? "") || null,
        });
      }
      if (kind === "dividend") {
        const amountUsd = String(formData.get("amountUsd") ?? "").trim();
        if (!amountUsd) {
          throw new Error("請填股息美金");
        }
        return createAdjustment(store, {
          bookId: ctx.book.id,
          ledgerAccountId: account.id,
          memberId,
          occurredOn: occurredOn.occurredOn,
          note: dividendNote(String(formData.get("note") ?? "") || symbol),
          symbol: symbol || null,
          amountUsd,
        });
      }
      return createAdjustment(store, {
        bookId: ctx.book.id,
        ledgerAccountId: account.id,
        memberId,
        occurredOn: occurredOn.occurredOn,
        note: String(formData.get("note") ?? ""),
        symbol: symbol || null,
        amountUsd: String(formData.get("amountUsd") ?? "") || null,
      });
    });
  } catch (error) {
    return { error: humanFormError(error instanceof Error ? error.message : "記帳失敗") };
  }
  if (kind === "split") {
    try {
      await refreshMarksAfterSplit([symbol]);
    } catch {
      // Quote refresh must not break bookkeeping that already committed.
    }
  }

  revalidatePath("/overview");
  revalidatePath("/holdings");
  revalidatePath("/ledger");
  return { ok: kind === "split" ? "已記入拆股" : kind === "dividend" ? "已記入股息" : "已記入調整" };
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
        memberId: String(formData.get("memberId") ?? "") || "_",
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

export async function deleteLedgerEntryAction(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return { error: "未有記帳表" };
  }
  if (String(formData.get("confirm") ?? "") !== "1") {
    return { error: "要確認先刪" };
  }
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "cash" && kind !== "trade") {
    return { error: "唔識呢種類型" };
  }
  try {
    await withLedgerTransaction((store) =>
      deleteEntry(store, {
        bookId: ctx.book.id,
        kind,
        id: String(formData.get("entryId") ?? ""),
      }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "刪除失敗" };
  }
  revalidatePath("/overview");
  revalidatePath("/holdings");
  revalidatePath("/ledger");
  revalidatePath("/returns");
  revalidatePath("/entry");
  return { ok: "已刪呢筆" };
}

export async function checkDeleteLedgerEntryAction(
  _prev: EntryState,
  formData: FormData,
): Promise<EntryState> {
  const user = await requireUser();
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    return { error: "未有記帳表" };
  }
  const kind = String(formData.get("kind") ?? "");
  if (kind !== "cash" && kind !== "trade") {
    return { error: "唔識呢種類型" };
  }
  try {
    const store = createDrizzleStore();
    await checkDeleteEntry(store, {
      bookId: ctx.book.id,
      kind,
      id: String(formData.get("entryId") ?? ""),
    });
  } catch (error) {
    return { error: error instanceof Error ? error.message : "刪除失敗" };
  }
  return { ok: "可以刪" };
}
