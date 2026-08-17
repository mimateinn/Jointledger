export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { AppChrome } from "@/components/app-chrome";
import { TickerTape } from "@/components/ticker-tape";
import { listOpenLotSymbols } from "@/lib/book-view";
import { emptyTapeViews, refreshAndLoadTape } from "@/quotes";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const lotSymbols = await listOpenLotSymbols(user).catch(() => []);
  const tape = await refreshAndLoadTape(lotSymbols, { refresh: "background" }).catch(() =>
    emptyTapeViews(),
  );

  return (
    <AppChrome
      displayName={user.displayName}
      tape={<TickerTape items={tape.items} fx={tape.fx} delayLabel={tape.delayLabel} />}
    >
      {children}
    </AppChrome>
  );
}
