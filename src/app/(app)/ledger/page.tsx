import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { loadBookView } from "@/lib/book-view";
import { ensureCurrentBook } from "@/lib/ensure-book";
import { LedgerClient } from "./ledger-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "流水" };

export default async function LedgerPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  await ensureCurrentBook(user);
  const view = await loadBookView(user);
  if (!view) {
    redirect("/first-use");
  }

  const memberName = (id: string) =>
    view.members.find((m) => m.id === id)?.displayName ?? "—";

  return (
    <LedgerClient
      cashFlows={view.cashFlows.map((row) => ({
        id: row.id,
        memberName: memberName(row.memberId),
        amountUsd: row.amountUsd,
        amountHkd: row.amountHkd,
        fxRate: row.fxRate,
        occurredOn: row.occurredOn,
      }))}
      trades={view.trades.map((row) => ({
        id: row.id,
        symbol: row.symbol,
        quantity: row.quantity,
        price: row.price,
        occurredOn: row.occurredOn,
        note: row.note,
      }))}
    />
  );
}
