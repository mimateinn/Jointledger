import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { loadBookView } from "@/lib/book-view";
import { ensureCurrentBook } from "@/lib/ensure-book";
import { parseLedgerFilters, type LedgerKind } from "@/lib/ledger-filter";
import { resolveInstrument } from "@/quotes";
import { LedgerClient } from "./ledger-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "流水" };

export default async function LedgerPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  await ensureCurrentBook(user);
  const view = await loadBookView(user);
  if (!view) {
    redirect("/first-use");
  }

  const memberName = (id: string) => view.members.find((m) => m.id === id)?.displayName ?? "—";
  const accountMember = (ledgerAccountId: string) => {
    const account = view.accounts.find((a) => a.id === ledgerAccountId);
    if (!account) return "—";
    if (account.memberId) return memberName(account.memberId);
    return account.name;
  };
  const filters = parseLedgerFilters(await searchParams);

  return (
    <LedgerClient
      filters={filters}
      members={view.members.map((m) => m.displayName)}
      cashFlows={view.cashFlows.map((row) => ({
        id: row.id,
        kind: row.kind as LedgerKind,
        memberName: memberName(row.memberId),
        amountUsd: row.amountUsd,
        amountHkd: row.amountHkd,
        fxRate: row.fxRate,
        occurredOn: row.occurredOn,
        note: null,
      }))}
      trades={view.trades.map((row) => ({
        id: row.id,
        kind: row.side as LedgerKind,
        memberName: accountMember(row.ledgerAccountId),
        symbol: row.symbol,
        name: resolveInstrument(row.symbol)?.displayName ?? null,
        quantity: row.quantity,
        price: row.price,
        occurredOn: row.occurredOn,
        note: row.note,
      }))}
    />
  );
}
