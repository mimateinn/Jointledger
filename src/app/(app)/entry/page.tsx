import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { getCurrentMembership } from "@/lib/current-book";
import { todayIso } from "@/lib/format";
import { EntryForm } from "./entry-form";

export const dynamic = "force-dynamic";
export const metadata = { title: "記一筆" };

export default async function EntryPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const ctx = await getCurrentMembership(user);
  if (!ctx) {
    redirect("/first-use");
  }

  return (
    <EntryForm
      members={ctx.members.map((m) => ({ id: m.id, displayName: m.displayName }))}
      accounts={ctx.accounts.map((a) => ({
        id: a.id,
        name: a.name,
        kind: a.kind,
      }))}
      defaultMemberId={ctx.member.id}
      defaultAccountId={
        ctx.accounts.find((a) => a.memberId === ctx.member.id)?.id ?? ctx.accounts[0]?.id ?? ""
      }
      today={todayIso()}
    />
  );
}
