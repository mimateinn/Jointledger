import { and, desc, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { getDb } from "@/db/client";
import { createDrizzleStore } from "@/db/drizzle-store";
import { importBatches } from "@/db/tables";
import { sumSheetPnl } from "@/import/old-sheet";
import type { ImportPlan } from "@/import/types";
import { loadBookView } from "@/lib/book-view";
import { ensureCurrentBook } from "@/lib/ensure-book";
import { todayIso } from "@/lib/format";
import { buildReturnsReport, type PeriodKey } from "@/returns/report";
import { ReturnsClient } from "./returns-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "收益率" };

function asPeriodKey(value: string | undefined): PeriodKey {
  if (value === "3m" || value === "ytd" || value === "custom") {
    return value;
  }
  return "1m";
}

function oldSheetFromPlan(raw: unknown): string | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }
  const payload = raw as { plan?: ImportPlan };
  const plan = payload.plan ?? (raw as ImportPlan);
  if (!plan?.trades) {
    return null;
  }
  return sumSheetPnl(plan);
}

export default async function ReturnsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string; from?: string; to?: string }>;
}) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  await ensureCurrentBook(user);
  const view = await loadBookView(user);
  if (!view) {
    redirect("/first-use");
  }
  const params = await searchParams;
  const store = createDrizzleStore();
  const ledger = {
    cashFlows: await store.listCashFlows(view.book.id),
    trades: await store.listTrades(view.book.id),
    allocations: await store.listTradeAllocations(view.book.id),
  };
  const marks: Record<string, string | null> = {};
  for (const lot of view.lots) {
    marks[lot.symbol] = lot.last;
  }

  const [batch] = await getDb()
    .select()
    .from(importBatches)
    .where(
      and(
        eq(importBatches.bookId, view.book.id),
        inArray(importBatches.status, ["success", "warning"]),
      ),
    )
    .orderBy(desc(importBatches.createdAt))
    .limit(1);

  const report = buildReturnsReport({
    ledger,
    marks,
    members: view.members,
    periodKey: asPeriodKey(params.range),
    today: todayIso(),
    customStart: params.from,
    customEnd: params.to,
    oldSheetPnlUsd: oldSheetFromPlan(batch?.plan),
  });

  const emptyBook = ledger.cashFlows.length === 0 && ledger.trades.length === 0;

  return <ReturnsClient report={report} emptyBook={emptyBook} />;
}
