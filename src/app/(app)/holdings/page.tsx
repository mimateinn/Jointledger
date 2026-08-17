import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { DelayBadge } from "@/components/delay-badge";
import { HoldingsWorkspace } from "@/components/holdings-workspace";
import { positionLotsFromTrades } from "@/ledger";
import { loadBookView } from "@/lib/book-view";
import { ensureCurrentBook } from "@/lib/ensure-book";
import { instrumentTags } from "@/ohlcv";
import { DELAY_15, loadMarksForLots, resolveInstrument } from "@/quotes";
import { resolveWatchSymbol } from "@/quotes/symbol-map";
import { listWatchItems } from "@/watchlist/repo";

export const dynamic = "force-dynamic";
export const metadata = { title: "持倉" };

export default async function HoldingsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  await ensureCurrentBook(user);
  const view = await loadBookView(user);
  if (!view) {
    redirect("/first-use");
  }

  const anyPrice = view.lots.some((lot) => lot.lastDisplay);
  const delayLabel = anyPrice ? DELAY_15 : view.lots.some((lot) => lot.planLimited) ? "延遲／升級" : DELAY_15;

  const closedLots = positionLotsFromTrades(view.trades, view.allocations)
    .filter((lot) => lot.closed)
    .map((lot) => ({
      tradeId: lot.tradeId,
      memberId: lot.memberId,
      symbol: lot.symbol,
      quantity: lot.quantity,
      lastDisplay: null,
      percentChange: null,
      marketValueUsd: null,
      costUsd: lot.costUsd,
      planLimited: false,
      isEtfProxy: false,
      delayLabel,
      lastUpdateLabel: null,
      name: null,
      tags: [] as string[],
      closed: true,
    }));

  const lots = view.lots.map((lot) => {
    const quote = view.quoteViews[lot.symbol];
    const instrument = resolveInstrument(lot.symbol);
    return {
      tradeId: lot.tradeId,
      memberId: lot.memberId,
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

  const watched = await listWatchItems(view.book.id);
  const watchQuotes = await loadMarksForLots(watched.map((row) => row.displayCode), {
    refresh: "background",
  }).catch(() => ({
    views: {} as typeof view.quoteViews,
  }));
  const watchItems = watched.map((item) => {
    const resolved = resolveWatchSymbol(item.displayCode);
    const quote = watchQuotes.views[item.displayCode] ?? view.quoteViews[item.displayCode];
    return {
      id: item.id,
      displayCode: item.displayCode,
      muted: item.muted,
      market: resolved?.market ?? "US",
      marketLabel: resolved?.marketLabel ?? "—",
      lastDisplay: quote?.last ?? null,
      percentChange: quote?.percentChange ?? null,
    };
  });

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="display">持倉</h1>
        {view.lots.length > 0 || watchItems.length > 0 ? <DelayBadge label={delayLabel} /> : null}
      </div>
      {view.all.partial && view.lots.length > 0 ? (
        <p className="meta muted">部分市值 · 未有標記嘅持股唔計入 NAV</p>
      ) : null}
      <HoldingsWorkspace
        lots={lots}
        closedLots={closedLots}
        watchItems={watchItems}
        delayLabel={delayLabel}
      />
    </div>
  );
}
