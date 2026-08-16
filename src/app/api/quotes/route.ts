import { NextResponse } from "next/server";
import { getSessionUser } from "@/auth/session";
import { listOpenLotSymbols } from "@/lib/book-view";
import { emptyTapeViews, refreshAndLoadTape } from "@/quotes";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const lotSymbols = await listOpenLotSymbols(user).catch(() => []);
  const tape = await refreshAndLoadTape(lotSymbols).catch(() => emptyTapeViews());
  return NextResponse.json({
    items: tape.items,
    fx: tape.fx,
    delayLabel: tape.delayLabel,
  });
}
