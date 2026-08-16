import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { DelayBadge } from "@/components/delay-badge";
import { loadInstrumentView } from "@/quotes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  return { title: decodeURIComponent(code).toUpperCase() };
}

export default async function InstrumentPage({ params }: { params: Promise<{ code: string }> }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const { code } = await params;
  const display = decodeURIComponent(code).trim().toUpperCase();
  if (!display) {
    notFound();
  }
  const view = await loadInstrumentView(display).catch(() => null);
  const item = view ?? {
    display,
    name: null,
    last: null,
    percentChange: null,
    delayLabel: "延遲 15 分",
    lastUpdateLabel: null,
    isEtfProxy: false,
    planLimited: false,
  };

  return (
    <div className="stack">
      <div className="page-head">
        <div>
          <h1 className="display">{item.display}</h1>
          {item.name ? <p className="muted">{item.name}</p> : null}
        </div>
        <DelayBadge label={item.delayLabel} lastUpdate={item.lastUpdateLabel} />
      </div>
      <section className="card stack">
        <div className="meta muted">現價</div>
        <div className="display tabular">{item.last ?? "—"}</div>
        <div className={item.percentChange?.startsWith("-") ? "down" : item.percentChange?.startsWith("+") ? "up" : "muted"}>
          {item.last ? (item.percentChange ?? "—") : "—"}
        </div>
        {item.isEtfProxy ? <span className="chip">代理</span> : null}
        {item.planLimited && !item.last ? <span className="chip chip-delay">延遲／升級</span> : null}
        <p className="muted">呢啲唔係投資建議，只係整理帳簿同公開資料。</p>
      </section>
    </div>
  );
}
