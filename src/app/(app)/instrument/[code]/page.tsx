import { notFound, redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { InstrumentKline } from "@/components/instrument-kline";
import { instrumentTags } from "@/ohlcv";
import { loadInstrumentView, resolveInstrument } from "@/quotes";

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
    <div className="stack">
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
      />
    </div>
  );
}
