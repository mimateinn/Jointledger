import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { createDrizzleStore } from "@/db/drizzle-store";
import { getCurrentMembership } from "@/lib/current-book";
import { scheduleInForce } from "@/ledger/set-allocation-schedule";
import { todayIso } from "@/lib/format";
import { AccountClient } from "./account-client";

export const dynamic = "force-dynamic";
export const metadata = { title: "帳戶" };

export default async function AccountPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    redirect("/first-use");
  }

  const store = createDrizzleStore();
  const raw = await store.listAllocationSchedules(ctx.book.id);
  const current = scheduleInForce(raw, todayIso());
  const byId = new Map(ctx.members.map((member) => [member.id, member.displayName]));
  const schedules = raw
    .slice()
    .sort((a, b) => a.effectiveOn.localeCompare(b.effectiveOn))
    .map((row) => ({
      effectiveOn: row.effectiveOn,
      current: current?.id === row.id,
      legs: row.legs.map((leg) => ({
        memberId: leg.memberId,
        displayName: byId.get(leg.memberId) ?? "?",
        percent: leg.percent,
      })),
    }));

  return (
    <AccountClient
      currentUserId={user.id}
      members={ctx.members.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        email: m.email,
        userId: m.userId,
      }))}
      schedules={schedules}
    />
  );
}
