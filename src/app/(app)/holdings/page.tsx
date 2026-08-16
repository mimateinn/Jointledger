import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { DelayBadge } from "@/components/delay-badge";
import { formatMoney } from "@/lib/format";
import { loadBookView } from "@/lib/book-view";
import { DELAY_15 } from "@/quotes";

export const dynamic = "force-dynamic";
export const metadata = { title: "持倉" };

function changeClass(change: string | null): string | undefined {
  if (!change) {
    return "muted";
  }
  if (change.startsWith("+")) {
    return "up";
  }
  if (change.startsWith("-")) {
    return "down";
  }
  return "muted";
}

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

  return (
    <div className="stack">
      <div className="page-head">
        <h1 className="display">持倉</h1>
        {view.lots.length > 0 ? <DelayBadge label={delayLabel} /> : null}
      </div>
      {view.all.partial && view.lots.length > 0 ? (
        <p className="meta muted">部分市值 · 未有標記嘅持股唔計入 NAV</p>
      ) : null}
      <section className="card">
        {view.lots.length === 0 ? (
          <p className="empty">未有持倉</p>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>代碼</th>
                <th>數量</th>
                <th>現價</th>
                <th>今日</th>
                <th>市值</th>
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              {view.lots.map((lot) => (
                <tr key={lot.tradeId}>
                  <td>
                    <Link href={`/instrument/${encodeURIComponent(lot.symbol)}`}>{lot.symbol}</Link>
                  </td>
                  <td className="tabular">{formatMoney(lot.quantity, 4)}</td>
                  <td className="tabular">{lot.lastDisplay ?? "—"}</td>
                  <td className={`tabular ${changeClass(lot.percentChange)}`}>
                    {lot.lastDisplay ? (lot.percentChange ?? "—") : "—"}
                  </td>
                  <td className="tabular">{lot.marketValueUsd ? formatMoney(lot.marketValueUsd) : "—"}</td>
                  <td className="tabular">{formatMoney(lot.costUsd)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
