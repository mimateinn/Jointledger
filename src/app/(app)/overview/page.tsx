import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { loadBookView } from "@/lib/book-view";
import { DELAY_15 } from "@/quotes";
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

  const anyPrice = view.lots.some((lot) => lot.lastDisplay);
  const delayLabel = anyPrice ? DELAY_15 : view.lots.some((lot) => lot.planLimited) ? "延遲／升級" : DELAY_15;

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
      byMember={view.byMember.map((row) => ({
        memberId: row.member.id,
        displayName: row.member.displayName,
        cashUsd: row.cashUsd,
        navUsd: row.navUsd,
        partial: row.partial,
      }))}
      lots={view.lots.map((lot) => ({
        tradeId: lot.tradeId,
        memberId: lot.memberId,
        ledgerAccountId: lot.ledgerAccountId,
        symbol: lot.symbol,
        quantity: lot.quantity,
        costUsd: lot.costUsd,
        lastDisplay: lot.lastDisplay,
        percentChange: lot.percentChange,
        marketValueUsd: lot.marketValueUsd,
      }))}
      delayLabel={delayLabel}
    />
  );
}
