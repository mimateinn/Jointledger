export const dynamic = "force-dynamic";

import { redirect } from "next/navigation";
import { getSessionUser } from "@/auth/session";
import { getCurrentMembership } from "@/lib/current-book";

export default async function HomePage() {
  const user = await getSessionUser();
  if (!user) {
    redirect("/login");
  }
  const membership = await getCurrentMembership(user);
  redirect(membership ? "/overview" : "/first-use");
}
