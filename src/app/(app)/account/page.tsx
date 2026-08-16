import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { getCurrentMembership } from "@/lib/current-book";
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

  return (
    <AccountClient
      currentUserId={user.id}
      members={ctx.members.map((m) => ({
        id: m.id,
        displayName: m.displayName,
        email: m.email,
        userId: m.userId,
      }))}
    />
  );
}
