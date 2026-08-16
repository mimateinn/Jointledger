import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { loadBookView } from "@/lib/book-view";
import { OverviewClient } from "./overview-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "總覽" };

export default async function OverviewPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const view = await loadBookView(user);
  if (!view) {
    redirect("/first-use");
  }

  return (
    <OverviewClient
      currentMemberId={view.member.id}
      members={view.members.map((m) => ({ id: m.id, displayName: m.displayName }))}
      accounts={view.accounts.map((a) => ({
        id: a.id,
        memberId: a.memberId,
        name: a.name,
        kind: a.kind,
      }))}
      all={view.all}
      joint={view.joint}
      byMember={view.byMember.map((row) => ({
        memberId: row.member.id,
        displayName: row.member.displayName,
        cashUsd: row.cashUsd,
        navUsd: row.navUsd,
      }))}
      lots={view.lots.map((lot) => ({
        tradeId: lot.tradeId,
        memberId: lot.memberId,
        ledgerAccountId: lot.ledgerAccountId,
        symbol: lot.symbol,
        quantity: lot.quantity,
        costUsd: lot.costUsd,
      }))}
    />
  );
}
