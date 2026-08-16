import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { getCurrentMembership } from "@/lib/current-book";

export const dynamic = "force-dynamic";
export const metadata = { title: "收益率" };

export default async function ReturnsPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    redirect("/first-use");
  }

  return (
    <div className="stack">
      <h1 className="display">收益率</h1>
      <section className="card">
        <p className="empty">未有足夠紀錄。有買賣或滿一個選定期再睇。</p>
      </section>
    </div>
  );
}
