import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { Icon } from "@/components/icons";
import { InstrumentKline } from "@/components/instrument-kline";
import { instrumentTags } from "@/ohlcv";
import { loadInstrumentView, resolveInstrument } from "@/quotes";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const display = decodeURIComponent(code).trim().toUpperCase();
  const name = resolveInstrument(display)?.displayName;
  return { title: name ? `${name} ${display}` : display };
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
  const instrument = resolveInstrument(display);
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
    <div className="page">
      <div className="page-head page-head-stack">
        <Link href="/holdings" className="btn btn-ghost">
          <Icon name="chevron-left" size={16} />
          持倉
        </Link>
        <p className="page-eyebrow">走勢</p>
        <h1 className="page-title">
          {item.name && item.name !== item.display ? (
            <>
              {item.name} <span className="meta muted">{item.display}</span>
            </>
          ) : (
            item.display
          )}
        </h1>
      </div>
      <div className="grid-12">
        <div className="col-8">
          <InstrumentKline
            display={item.display}
            name={item.name}
            last={item.last}
            percentChange={item.percentChange}
            delayLabel={item.delayLabel}
            lastUpdateLabel={item.lastUpdateLabel}
            isEtfProxy={item.isEtfProxy}
            planLimited={item.planLimited}
            tags={instrument ? instrumentTags(instrument) : []}
            containInShell
          />
        </div>
        <aside className="col-4 stack">
          <section className="card">
            <h2 className="card-title">注意</h2>
            <p className="meta muted">呢啲唔係投資建議，只係整理帳簿同公開資料。</p>
          </section>
        </aside>
      </div>
    </div>
  );
}
