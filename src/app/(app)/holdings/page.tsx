import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { DelayBadge } from "@/components/delay-badge";
import { HoldingsWorkspace } from "@/components/holdings-workspace";
import { loadBookView } from "@/lib/book-view";
import { instrumentTags } from "@/ohlcv";
import { DELAY_15, resolveInstrument } from "@/quotes";

export const dynamic = "force-dynamic";
export const metadata = { title: "持倉" };

export default async function HoldingsPage() {
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

  const lots = view.lots.map((lot) => {
    const quote = view.quoteViews[lot.symbol];
    const instrument = resolveInstrument(lot.symbol);
    return {
      tradeId: lot.tradeId,
      symbol: lot.symbol,
      quantity: lot.quantity,
      lastDisplay: lot.lastDisplay,
      percentChange: lot.percentChange,
      marketValueUsd: lot.marketValueUsd,
      costUsd: lot.costUsd,
      planLimited: lot.planLimited,
      isEtfProxy: quote?.isEtfProxy ?? false,
      delayLabel: quote?.delayLabel ?? delayLabel,
      lastUpdateLabel: quote?.lastUpdateLabel ?? null,
      name: quote?.name ?? null,
      tags: instrument ? instrumentTags(instrument) : [],
    };
  });

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="display">持倉</h1>
        {view.lots.length > 0 ? <DelayBadge label={delayLabel} /> : null}
      </div>
      {view.all.partial && view.lots.length > 0 ? (
        <p className="meta muted">部分市值 · 未有標記嘅持股唔計入 NAV</p>
      ) : null}
      {view.lots.length === 0 ? (
        <section className="card">
          <p className="empty">未有持倉</p>
        </section>
      ) : (
        <HoldingsWorkspace lots={lots} delayLabel={delayLabel} />
      )}
    </div>
  );
}
