"use server";

import { redirect } from "next/navigation";
import { requireUser } from "@/auth/session";
import { withLedgerTransaction } from "@/db/ledger-tx";
import { createBook } from "@/ledger";
import { getCurrentMembership } from "@/lib/current-book";

export type BookState = { error?: string };

export async function createBookAction(
  _prev: BookState,
  formData: FormData,
): Promise<BookState> {
  const user = await requireUser();
  const existing = await getCurrentMembership(user);
  if (existing) {
    redirect("/overview");
  }

  const name = String(formData.get("name") ?? "").trim();
  try {
    await withLedgerTransaction((store) =>
      createBook(store, {
        name,
        createdByUserId: user.id,
        creatorDisplayName: user.displayName,
        creatorEmail: user.email,
        tradeCurrency: "USD",
        depositCurrency: "HKD",
      }),
    );
  } catch (error) {
    return { error: error instanceof Error ? error.message : "開表失敗" };
  }
  redirect("/overview");
}
