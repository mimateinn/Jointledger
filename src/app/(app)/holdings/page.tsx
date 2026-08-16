import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { formatMoney } from "@/lib/format";
import { loadBookView } from "@/lib/book-view";

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

  return (
    <div className="stack">
      <h1 className="display">持倉</h1>
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
                <th>成本</th>
              </tr>
            </thead>
            <tbody>
              {view.lots.map((lot) => (
                <tr key={lot.tradeId}>
                  <td>{lot.symbol}</td>
                  <td className="tabular">{formatMoney(lot.quantity, 4)}</td>
                  <td className="muted">暫時用買入價，未有市場價</td>
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
