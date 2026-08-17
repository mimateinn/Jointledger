import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth/session";
import { emptyOhlcvView, loadOhlcv } from "@/ohlcv";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = new URL(request.url);
  const symbol = (url.searchParams.get("symbol") ?? "").trim();
  const view = await loadOhlcv(symbol).catch(() => emptyOhlcvView(symbol.toUpperCase()));
  return NextResponse.json({
    display: view.display,
    bars: view.bars,
    status: view.status,
    planLimited: view.planLimited,
  });
}
